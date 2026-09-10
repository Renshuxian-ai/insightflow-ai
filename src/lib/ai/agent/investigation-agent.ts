import "server-only";

import { getAllowedTools } from "../tools/tool-registry";
import { executeToolRequest } from "../tools/tool-executor";
import type { ToolExecutionResult } from "../tools/types";
import type {
  InvestigationProvider,
  InvestigationProviderInput,
} from "../provider";
import { appendTraceEvent, createAgentTrace } from "./agent-trace";
import {
  buildFinalGenerationMessage,
  buildInitialAgentMessages,
} from "./agent-prompt";
import type {
  AgentMessage,
  AgentToolCall,
  BoundedInvestigationAgentResult,
  ProviderToolDefinition,
} from "./types";

export const MAX_TOOL_ROUNDS = 2;
export const MAX_TOOL_CALLS = 3;

type BoundedInvestigationAgentInput = InvestigationProviderInput & {
  provider: InvestigationProvider;
};

function getProviderToolDefinitions(): ProviderToolDefinition[] {
  return getAllowedTools().map(({ name, description, inputSchema }) => ({
    name,
    description,
    inputSchema,
  }));
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

export async function runBoundedInvestigationAgent({
  diagnosticCase,
  model,
  provider,
}: BoundedInvestigationAgentInput): Promise<BoundedInvestigationAgentResult> {
  const trace = createAgentTrace(diagnosticCase.id, model.id, {
    maxToolRounds: MAX_TOOL_ROUNDS,
    maxToolCalls: MAX_TOOL_CALLS,
  });
  const providerTools = getProviderToolDefinitions();
  const executedToolFingerprints = new Set<string>();
  let messages = buildInitialAgentMessages(diagnosticCase);
  let toolRounds = 0;
  let toolCalls = 0;

  while (toolRounds < MAX_TOOL_ROUNDS && toolCalls < MAX_TOOL_CALLS) {
    appendTraceEvent(
      trace,
      "model-request",
      `Requested tool selection round ${toolRounds + 1}.`,
    );
    const turn = await provider.runAgentTurn({
      diagnosticCase,
      model,
      request: {
        phase: "tool-selection",
        messages,
        tools: providerTools,
      },
    });

    if (turn.kind === "final") {
      appendTraceEvent(
        trace,
        "final-generation",
        "The model returned a final investigation result without more tool calls.",
      );

      return { output: turn.output, trace };
    }

    messages = [...messages, turn.message];
    const remainingToolCalls = MAX_TOOL_CALLS - toolCalls;
    const toolCallsToProcess = turn.toolCalls.slice(0, remainingToolCalls);

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
        : await executeToolRequest(toolCall, { diagnosticCase });

      executedToolFingerprints.add(fingerprint);
      messages = [...messages, createToolMessage(toolCall, result)];
      appendToolTrace(trace, toolCall, result);
    }

    toolRounds += 1;
  }

  messages = [...messages, buildFinalGenerationMessage()];
  appendTraceEvent(
    trace,
    "model-request",
    "Requested final investigation generation with tool calling disabled.",
  );
  const finalTurn = await provider.runAgentTurn({
    diagnosticCase,
    model,
    request: {
      phase: "final-generation",
      messages,
      tools: [],
    },
  });

  if (finalTurn.kind !== "final") {
    throw new Error("The model requested tools after the agent tool limit was reached.");
  }

  appendTraceEvent(
    trace,
    "final-generation",
    "The model returned a final investigation result after bounded tool use.",
  );

  return { output: finalTurn.output, trace };
}
