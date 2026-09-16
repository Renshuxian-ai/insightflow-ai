import "server-only";

import type { DiagnosticCase } from "@/lib/diagnostics/types";
import { getInvestigationResult } from "@/lib/investigations/mock-data";

import { evaluateEvidenceSufficiency } from "../evaluation/evidence-sufficiency-evaluator";
import {
  buildLlmEvidenceEvaluationMessages,
  parseLlmEvidenceEvaluation,
} from "../evaluation/llm-evidence-evaluator";
import {
  createFunctionCallingProvider,
  type FunctionCallingProvider,
} from "../providers/function-calling-provider";
import { getAllowedTools } from "../tools/tool-registry";
import { executeToolRequest } from "../tools/tool-executor";
import type {
  ToolDefinition,
  ToolExecutionContext,
  ToolExecutionResult,
  ToolName,
} from "../tools/types";
import type { AgentModelProvider } from "../provider";
import type { InvestigationModelDefinition } from "../types";
import { appendTraceEvent, createAgentTrace } from "./agent-trace";
import {
  buildFinalGenerationMessage,
  buildInitialAgentMessages,
} from "./agent-prompt";
import { buildInvestigationAgentSystemMessage } from "./investigation-agent-prompt";
import type {
  AgentMessage,
  AgentModelTurn,
  AgentToolCall,
  AgentProviderRequest,
  BoundedInvestigationAgentResult,
} from "./types";

export const MAX_AGENT_ITERATIONS = 5;
export const MAX_TOOL_ROUNDS = MAX_AGENT_ITERATIONS;
export const MAX_TOOL_CALLS = 3;
export const MAX_EVIDENCE_ITERATIONS = MAX_AGENT_ITERATIONS;

const RETENTION_ANALYTICS_TOOLS = [
  "retention_analysis",
  "segment_analysis",
  "feedback_analysis",
] as const satisfies readonly ToolName[];
const FUNNEL_ANALYTICS_TOOLS = [
  "funnel_analysis",
  "segment_analysis",
] as const satisfies readonly ToolName[];
const FEEDBACK_ANALYTICS_TOOLS = [
  "feedback_analysis",
  "retention_analysis",
] as const satisfies readonly ToolName[];

type BoundedInvestigationAgentInput = {
  diagnosticCase: DiagnosticCase;
  model: InvestigationModelDefinition;
  provider: AgentModelProvider;
  initialMessages?: AgentMessage[];
  toolPolicy?: {
    allowedToolNames: readonly ToolName[];
    executionScope: NonNullable<ToolExecutionContext["executionScope"]>;
    datasetAnalyticsContext?: ToolExecutionContext["datasetAnalyticsContext"];
  };
};

export function getAnalyticsInvestigationToolNames(
  diagnosticCase: DiagnosticCase,
): readonly ToolName[] | null {
  if (diagnosticCase.source !== "dataset" || !diagnosticCase.primarySignal) {
    return null;
  }

  if (diagnosticCase.metric.id.startsWith("retention-")) {
    return RETENTION_ANALYTICS_TOOLS;
  }

  if (diagnosticCase.metric.id === "funnel-conversion") {
    return FUNNEL_ANALYTICS_TOOLS;
  }

  if (diagnosticCase.metric.id === "feedback-topic-mentions") {
    return FEEDBACK_ANALYTICS_TOOLS;
  }

  return null;
}

function getDeterministicToolCalls(
  diagnosticCase: DiagnosticCase,
  completedToolCalls: number,
): AgentToolCall[] {
  const feedbackSignal = diagnosticCase.evidence.feedbackSignals[0];

  if (completedToolCalls > 0) {
    return [
      {
        id: "tool-call-" + diagnosticCase.id + "-feedback",
        name: "search_feedback",
        input: { feedbackSignalId: feedbackSignal.id },
      },
    ];
  }

  return [
    {
      id: "tool-call-" + diagnosticCase.id + "-metric",
      name: "query_metric",
      input: { metricId: diagnosticCase.metric.id },
    },
    {
      id: "tool-call-" + diagnosticCase.id + "-segment",
      name: "analyze_segment",
      input: { segmentId: diagnosticCase.context.segment.id },
    },
  ];
}

function createPrototypeTurn(
  diagnosticCase: DiagnosticCase,
  request: AgentProviderRequest,
): AgentModelTurn {
  if (request.phase === "tool-selection") {
    const completedToolCalls = request.messages.filter(
      (message) => message.role === "tool",
    ).length;
    const toolCalls = getDeterministicToolCalls(
      diagnosticCase,
      completedToolCalls,
    );

    return {
      kind: "tool-calls",
      message: {
        role: "assistant",
        content: null,
        toolCalls,
      },
      toolCalls,
    };
  }

  if (request.phase === "evidence-evaluation") {
    return {
      kind: "final",
      message: {
        role: "assistant",
        content: JSON.stringify({
          sufficient: true,
          reasoning: "The deterministic prototype accepted the available evidence.",
          missingEvidence: [],
        }),
        toolCalls: [],
      },
      output: {
        sufficient: true,
        reasoning: "The deterministic prototype accepted the available evidence.",
        missingEvidence: [],
      },
    };
  }

  const result = getInvestigationResult(diagnosticCase.id);

  if (!result) {
    throw new Error(
      "No mock investigation is available for this DiagnosticCase.",
    );
  }

  return {
    kind: "final",
    message: {
      role: "assistant",
      content:
        "Mock investigation result generated from deterministic tool observations.",
      toolCalls: [],
    },
    output: result,
  };
}

function getPrototypeTurn(
  provider: FunctionCallingProvider,
  diagnosticCase: DiagnosticCase,
  request: AgentProviderRequest,
): AgentModelTurn | undefined {
  return provider.id === "mock"
    ? createPrototypeTurn(diagnosticCase, request)
    : undefined;
}

function getToolDefinitions(
  allowedToolNames?: readonly ToolName[],
): readonly ToolDefinition[] {
  return getAllowedTools(allowedToolNames);
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;

    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`)
      .join(",")}}`;
  }

  const serialized = JSON.stringify(value);

  return serialized ?? String(value);
}

function getToolFingerprint(toolCall: AgentToolCall): string {
  return `${toolCall.name}:${stableSerialize(toolCall.input)}`;
}

function createRejectedObservation(
  toolCall: AgentToolCall,
  message: string,
): ToolExecutionResult {
  return {
    toolName: toolCall.name,
    status: "rejected",
    observation: {
      summary: `${toolCall.name} was not executed.`,
      facts: {},
      sourceReferences: [],
      limitations: [message],
    },
    message,
  };
}

function createToolMessage(
  toolCall: AgentToolCall,
  result: ToolExecutionResult,
): AgentMessage {
  return {
    role: "tool",
    toolCallId: toolCall.id,
    name: toolCall.name,
    content: JSON.stringify({
      toolName: result.toolName,
      status: result.status,
      observation: result.observation,
      message: result.message,
    }),
  };
}

function appendToolTrace(
  trace: BoundedInvestigationAgentResult["trace"],
  toolCall: AgentToolCall,
  result: ToolExecutionResult,
): void {
  appendTraceEvent(trace, "tool-call", `Requested ${toolCall.name}.`, {
    toolName: toolCall.name,
  });
  appendTraceEvent(
    trace,
    "observation",
    result.observation.summary,
    {
      toolName: result.toolName,
      toolResult: {
        status: result.status,
        message: result.message,
      },
    },
  );
}

function buildEvidenceEvaluationMessage(
  evaluation: Awaited<ReturnType<typeof evaluateEvidenceSufficiency>>,
): AgentMessage {
  return {
    role: "user",
    content: [
      `Evidence evaluation status: ${evaluation.status}.`,
      `Evidence score: ${evaluation.evidenceScore}.`,
      `Missing evidence: ${evaluation.missingEvidence.join(", ") || "none"}.`,
      `Recommended next tools: ${evaluation.recommendedNextTools.join(", ") || "none"}.`,
      evaluation.status === "insufficient"
        ? "Continue with one or more recommended tools when available."
        : "The evidence gate passed. Prepare the final grounded investigation result.",
    ].join(" "),
  };
}

function getAllowedEvidenceSources(
  diagnosticCase: DiagnosticCase,
  toolObservations: readonly ToolExecutionResult[],
) {
  const sources = [
    { sourceType: "metric", sourceId: diagnosticCase.metric.id },
    ...Object.values(diagnosticCase.context).map((contextItem) => ({
      sourceType: "context",
      sourceId: contextItem.id,
    })),
    ...diagnosticCase.evidence.behaviorSignals.map((signal) => ({
      sourceType: "behavior-signal",
      sourceId: signal.id,
    })),
    ...diagnosticCase.evidence.feedbackSignals.map((signal) => ({
      sourceType: "feedback-signal",
      sourceId: signal.id,
    })),
    ...toolObservations.flatMap((result) =>
      result.status === "success" ? result.observation.sourceReferences : [],
    ),
  ];

  return sources.filter(
    (source, index) =>
      sources.findIndex(
        (candidate) =>
          candidate.sourceType === source.sourceType &&
          candidate.sourceId === source.sourceId,
      ) === index,
  );
}

async function evaluateCurrentEvidence({
  diagnosticCase,
  model,
  provider,
  toolObservations,
  availableTools,
}: {
  diagnosticCase: DiagnosticCase;
  model: InvestigationModelDefinition;
  provider: FunctionCallingProvider;
  toolObservations: readonly ToolExecutionResult[];
  availableTools: readonly ToolName[];
}) {
  const evaluatorInput = {
    diagnosticCase,
    toolObservations,
    availableTools,
  };

  return evaluateEvidenceSufficiency(evaluatorInput, async (input) => {
    const messages = buildLlmEvidenceEvaluationMessages(input);
    const prototypeRequest: AgentProviderRequest = {
      phase: "evidence-evaluation",
      messages,
      tools: [],
    };
    const prototypeTurn = getPrototypeTurn(
      provider,
      diagnosticCase,
      prototypeRequest,
    );
    const turn = await provider.run({
      model,
      phase: "evidence-evaluation",
      messages,
      tools: [],
      ...(prototypeTurn ? { prototypeTurn } : {}),
    });

    if (turn.kind !== "assistant") {
      throw new Error("The evidence evaluator requested an unsupported tool call.");
    }

    return parseLlmEvidenceEvaluation(turn.output);
  });
}

export async function runBoundedInvestigationAgent({
  diagnosticCase,
  model,
  provider,
  initialMessages,
  toolPolicy,
}: BoundedInvestigationAgentInput): Promise<BoundedInvestigationAgentResult> {
  const functionCallingProvider = createFunctionCallingProvider(provider);
  const availableToolDefinitions = getToolDefinitions(
    toolPolicy?.allowedToolNames,
  );
  const availableToolNames = availableToolDefinitions.map((tool) => tool.name);
  const trace = createAgentTrace(diagnosticCase.id, model.id, {
    maxToolRounds: MAX_TOOL_ROUNDS,
    maxToolCalls: MAX_TOOL_CALLS,
    ...(toolPolicy?.executionScope === "analytics-dataset"
      ? { maxEvidenceIterations: MAX_EVIDENCE_ITERATIONS }
      : {}),
  });
  const evidenceEvaluationEnabled =
    toolPolicy?.executionScope === "analytics-dataset";
  const executedToolFingerprints = new Set<string>();
  const toolEvidence: BoundedInvestigationAgentResult["toolEvidence"] = [];
  const toolObservations: ToolExecutionResult[] = [];
  let messages = [
    buildInvestigationAgentSystemMessage(
      diagnosticCase,
      availableToolDefinitions,
    ),
    ...(initialMessages ?? buildInitialAgentMessages(diagnosticCase)),
  ];
  let activeToolNames = [...availableToolNames];
  let toolCalls = 0;
  let evidenceIterations = 0;
  let agentIterations = 0;

  while (
    agentIterations < MAX_AGENT_ITERATIONS &&
    toolCalls < MAX_TOOL_CALLS &&
    evidenceIterations < MAX_EVIDENCE_ITERATIONS &&
    activeToolNames.length > 0
  ) {
    agentIterations += 1;
    appendTraceEvent(
      trace,
      "model-request",
      `Requested LLM tool decision ${agentIterations}.`,
    );
    const activeTools = availableToolDefinitions.filter((tool) =>
      activeToolNames.includes(tool.name),
    );
    const prototypeRequest: AgentProviderRequest = {
      phase: "tool-selection",
      messages,
      tools: [],
    };
    const prototypeTurn = getPrototypeTurn(
      functionCallingProvider,
      diagnosticCase,
      prototypeRequest,
    );
    const turn = await functionCallingProvider.run({
      model,
      phase: "tool-selection",
      messages,
      tools: activeTools,
      ...(prototypeTurn ? { prototypeTurn } : {}),
    });

    if (turn.kind === "assistant") {
      if (evidenceEvaluationEnabled) {
        messages = [...messages, turn.message];
        appendTraceEvent(
          trace,
          "model-request",
          `Evaluated evidence sufficiency iteration ${evidenceIterations + 1}.`,
        );
        const evaluation = await evaluateCurrentEvidence({
          diagnosticCase,
          model,
          provider: functionCallingProvider,
          toolObservations,
          availableTools: availableToolNames,
        });
        evidenceIterations += 1;
        messages = [...messages, buildEvidenceEvaluationMessage(evaluation)];

        if (evaluation.status === "insufficient") {
          activeToolNames = evaluation.recommendedNextTools;

          if (activeToolNames.length > 0) {
            continue;
          }

          break;
        }
      }

      appendTraceEvent(
        trace,
        "final-generation",
        "The model returned a final investigation result without more tool calls.",
      );

      return { output: turn.output, trace, toolEvidence };
    }

    messages = [...messages, turn.message];
    const remainingToolCalls = MAX_TOOL_CALLS - toolCalls;
    const toolCallsToProcess: AgentToolCall[] = turn.toolCalls
      .slice(0, remainingToolCalls)
      .map((toolCall) => ({
        id: toolCall.id,
        name: toolCall.toolName,
        input: toolCall.arguments,
      }));

    if (turn.toolCalls.length > toolCallsToProcess.length) {
      appendTraceEvent(
        trace,
        "observation",
        "Additional tool calls were not executed because the call limit was reached.",
      );
    }

    for (const toolCall of toolCallsToProcess) {
      const fingerprint = getToolFingerprint(toolCall);
      toolCalls += 1;
      const result = executedToolFingerprints.has(fingerprint)
        ? createRejectedObservation(
            toolCall,
            "An identical tool request was already attempted in this agent run.",
          )
        : await executeToolRequest(toolCall, {
            diagnosticCase,
            ...(toolPolicy
              ? {
                  executionScope: toolPolicy.executionScope,
                  allowedToolNames: toolPolicy.allowedToolNames,
                  ...(toolPolicy.datasetAnalyticsContext
                    ? {
                        datasetAnalyticsContext:
                          toolPolicy.datasetAnalyticsContext,
                      }
                    : {}),
                }
              : {}),
          });

      executedToolFingerprints.add(fingerprint);
      messages = [...messages, createToolMessage(toolCall, result)];
      toolEvidence.push({
        toolName: result.toolName,
        status: result.status,
        observation: result.observation,
        sourceReferences: result.observation.sourceReferences,
      });
      toolObservations.push(result);
      appendToolTrace(trace, toolCall, result);
    }

    if (evidenceEvaluationEnabled) {
      appendTraceEvent(
        trace,
        "model-request",
        `Evaluated evidence sufficiency iteration ${evidenceIterations + 1}.`,
      );
      const evaluation = await evaluateCurrentEvidence({
        diagnosticCase,
        model,
        provider: functionCallingProvider,
        toolObservations,
        availableTools: availableToolNames,
      });
      evidenceIterations += 1;
      messages = [...messages, buildEvidenceEvaluationMessage(evaluation)];

      if (evaluation.status === "sufficient") {
        break;
      }

      activeToolNames = evaluation.recommendedNextTools;
    }
  }

  messages = [
    ...messages,
    buildFinalGenerationMessage(
      getAllowedEvidenceSources(diagnosticCase, toolObservations),
      diagnosticCase.primarySignal,
    ),
  ];
  appendTraceEvent(
    trace,
    "model-request",
    "Requested final investigation generation with tool calling disabled.",
  );
  const finalPrototypeRequest: AgentProviderRequest = {
    phase: "final-generation",
    messages,
    tools: [],
  };
  const finalPrototypeTurn = getPrototypeTurn(
    functionCallingProvider,
    diagnosticCase,
    finalPrototypeRequest,
  );
  const finalTurn = await functionCallingProvider.run({
    model,
    phase: "final-generation",
    messages,
    tools: [],
    ...(finalPrototypeTurn ? { prototypeTurn: finalPrototypeTurn } : {}),
  });

  if (finalTurn.kind !== "assistant") {
    throw new Error("The model requested tools after the agent tool limit was reached.");
  }

  appendTraceEvent(
    trace,
    "final-generation",
    "The model returned a final investigation result after bounded tool use.",
  );

  return { output: finalTurn.output, trace, toolEvidence };
}
