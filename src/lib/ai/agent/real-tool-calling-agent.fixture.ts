import "server-only";

import type { DiagnosticCase } from "@/lib/diagnostics/types";

import type { AgentModelProvider } from "../provider";
import { adaptToolDefinitionToFunctionSchema } from "../providers/tool-schema-adapter";
import { getAllowedTools } from "../tools/tool-registry";
import type { ToolName } from "../tools/types";
import type { InvestigationModelDefinition } from "../types";
import { runBoundedInvestigationAgent } from "./investigation-agent";
import type {
  AgentMessage,
  AgentModelTurn,
  AgentProviderRequest,
} from "./types";

type FixtureSurface = "retention" | "funnel" | "feedback";

type FixtureScenario = {
  surface: FixtureSurface;
  expectedToolOrder: readonly ToolName[];
  toolInputs: Partial<Record<ToolName, Record<string, string>>>;
};

const fixtureModel: InvestigationModelDefinition = {
  id: "deepseek-v3",
  label: "Fixture function-calling model",
  description: "A local fake LLM used only by the function-calling fixture.",
  providerId: "deepseek",
  providerModel: "fixture-function-calling-model",
  capabilities: ["agent-tool-calling"],
};

function assertFixture(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Real tool-calling agent fixture failed: ${message}`);
  }
}

function createDiagnosticCase(surface: FixtureSurface): DiagnosticCase {
  const surfaceValues = {
    retention: {
      metricId: "retention-d1",
      metric: "retention",
      interval: "D1",
      segmentDimension: "Platform",
      segment: "Android new users",
      evidenceId: "fixture-retention-evidence",
    },
    funnel: {
      metricId: "funnel-conversion",
      metric: "funnel_conversion",
      interval: "Complete Step2 to Complete Step3",
      segmentDimension: "Funnel step",
      segment: "Complete Step3",
      evidenceId: "fixture-funnel-evidence",
    },
    feedback: {
      metricId: "feedback-topic-mentions",
      metric: "feedback_topic",
      interval: "Current period",
      segmentDimension: "Feedback topic",
      segment: "Search relevance",
      evidenceId: "fixture-feedback-evidence",
    },
  }[surface];

  return {
    id: `real-tool-calling-${surface}`,
    source: "dataset",
    status: "ready",
    severity: "HIGH",
    title: `${surfaceValues.segment} investigation`,
    primarySignal: {
      metric: surfaceValues.metric,
      interval: surfaceValues.interval,
      segmentDimension: surfaceValues.segmentDimension,
      segment: surfaceValues.segment,
      currentValue: 38,
      baselineValue: 51,
      gap: -13,
      affectedUsers: 100,
    },
    metric: {
      id: surfaceValues.metricId,
      label: surfaceValues.metric,
      currentValue: "38",
      previousValue: "51",
      changeValue: -13,
      comparison: "Current vs. baseline",
    },
    context: {
      dateRange: { id: "fixture-period", label: "Current period" },
      segment: { id: "fixture-segment", label: surfaceValues.segment },
      platform: { id: "fixture-platform", label: "All platforms" },
      version: { id: "fixture-version", label: "V3.2" },
    },
    summary: {
      changed: "The primary metric is below its baseline.",
      affected: `${surfaceValues.segment} is the affected segment.`,
      started: "The available evidence does not establish a cause.",
    },
    evidence: {
      behaviorSignals: [
        {
          id: surfaceValues.evidenceId,
          label: `${surface} evidence`,
          value: "38 vs. 51",
          finding: "The primary metric is below baseline.",
          detail: "Aggregate fixture evidence.",
          source: `${surface} fixture`,
        },
      ],
      feedbackSignals:
        surface === "feedback"
          ? [
              {
                id: "fixture-feedback-quote",
                topic: "Search relevance",
                mentionCount: 38,
                change: "+37% vs. previous period",
                sentiment: "Negative",
                finding: "Users report difficulty finding relevant results.",
                source: "Feedback fixture",
                snippets: ["Search results are not relevant after the update."],
              },
            ]
          : [],
    },
    reasoning: {
      observation: {
        statement: "The primary metric is below baseline.",
        evidenceIds: [surfaceValues.evidenceId],
      },
      inference: {
        statement: "The signal requires further investigation.",
        evidenceIds: [surfaceValues.evidenceId],
      },
      hypothesis: {
        statement: "No causal explanation has been established.",
        evidenceIds: [surfaceValues.evidenceId],
      },
    },
    traceSteps: [],
    nextValidations: [
      {
        id: "fixture-validation",
        label: "Validate the signal",
        description: "Collect supporting evidence without assuming a cause.",
      },
    ],
  };
}

function assistantMessage(content: string | null = null): Extract<
  AgentMessage,
  { role: "assistant" }
> {
  return { role: "assistant", content, toolCalls: [] };
}

function createToolCallTurn(
  index: number,
  toolName: ToolName,
  input: Record<string, string>,
): AgentModelTurn {
  const toolCall = {
    id: `fixture-tool-call-${index + 1}`,
    name: toolName,
    input,
  };

  return {
    kind: "tool-calls",
    message: {
      role: "assistant",
      content: null,
      toolCalls: [toolCall],
    },
    toolCalls: [toolCall],
  };
}

function createFixtureProvider(
  scenario: FixtureScenario,
  requests: AgentProviderRequest[],
): AgentModelProvider {
  let toolDecisionIndex = 0;

  return {
    id: "deepseek",
    isAvailable: () => true,
    async runAgentTurn({ request }) {
      requests.push(request);

      if (request.phase === "evidence-evaluation") {
        return {
          kind: "final",
          message: assistantMessage(
            JSON.stringify({
              sufficient: true,
              reasoning: "The available structured observations can be evaluated.",
              missingEvidence: [],
            }),
          ),
          output: {
            sufficient: true,
            reasoning: "The available structured observations can be evaluated.",
            missingEvidence: [],
          },
        };
      }

      if (request.phase === "final-generation") {
        return {
          kind: "final",
          message: assistantMessage('{"fixture":"complete"}'),
          output: { fixture: "complete", surface: scenario.surface },
        };
      }

      const toolName = scenario.expectedToolOrder[toolDecisionIndex];

      assertFixture(
        toolName,
        `${scenario.surface} requested more tool decisions than expected.`,
      );
      assertFixture(
        request.tools.some((tool) => tool.name === toolName),
        `${toolName} was not exposed to the fixture LLM.`,
      );
      const input = scenario.toolInputs[toolName];

      assertFixture(input, `${toolName} is missing fixture arguments.`);
      toolDecisionIndex += 1;
      return createToolCallTurn(toolDecisionIndex - 1, toolName, input);
    },
  };
}

const scenarios: readonly FixtureScenario[] = [
  {
    surface: "retention",
    expectedToolOrder: ["retention_analysis", "segment_analysis"],
    toolInputs: {
      retention_analysis: {
        metric: "D1 retention",
        segment: "Android new users",
        period: "D1",
      },
      segment_analysis: {
        dimension: "Platform",
        value: "Android new users",
      },
    },
  },
  {
    surface: "funnel",
    expectedToolOrder: ["funnel_analysis", "segment_analysis"],
    toolInputs: {
      funnel_analysis: { step: "Complete Step2 to Complete Step3" },
      segment_analysis: {
        dimension: "Funnel step",
        value: "Complete Step3",
      },
    },
  },
  {
    surface: "feedback",
    expectedToolOrder: ["feedback_analysis"],
    toolInputs: {
      feedback_analysis: {
        topic: "Search relevance",
        sentiment: "negative",
      },
    },
  },
];

export async function runRealToolCallingAgentFixture() {
  const schema = adaptToolDefinitionToFunctionSchema(
    getAllowedTools(["retention_analysis"])[0],
  );

  assertFixture(schema.type === "function", "tool schema type must be function.");
  assertFixture(
    schema.function.name === "retention_analysis" &&
      schema.function.parameters.type === "object",
    "ToolDefinition must be converted to an LLM function schema.",
  );

  const results = [];

  for (const scenario of scenarios) {
    const diagnosticCase = createDiagnosticCase(scenario.surface);
    const requests: AgentProviderRequest[] = [];
    const provider = createFixtureProvider(scenario, requests);
    const output = await runBoundedInvestigationAgent({
      diagnosticCase,
      model: fixtureModel,
      provider,
      toolPolicy: {
        allowedToolNames:
          scenario.surface === "retention"
            ? ["retention_analysis", "segment_analysis", "feedback_analysis"]
            : scenario.surface === "funnel"
              ? ["funnel_analysis", "segment_analysis"]
              : ["feedback_analysis", "retention_analysis"],
        executionScope: "analytics-dataset",
      },
    });
    const calledTools = output.trace.events.flatMap((event) =>
      event.type === "tool-call" && event.toolName
        ? [event.toolName]
        : [],
    );
    const firstToolRequest = requests.find(
      (request) => request.phase === "tool-selection",
    );
    const systemPrompt = firstToolRequest?.messages[0];

    assertFixture(
      calledTools.join(",") === scenario.expectedToolOrder.join(","),
      `${scenario.surface} tool order was ${calledTools.join(",")}.`,
    );
    assertFixture(
      systemPrompt?.role === "system" &&
        systemPrompt.content.includes("You are an AI product analyst.") &&
        systemPrompt.content.includes("Do not make causal claims without evidence."),
      `${scenario.surface} did not receive the function-calling system prompt.`,
    );
    assertFixture(
      requests.some((request) => request.phase === "final-generation"),
      `${scenario.surface} did not reach final generation.`,
    );

    results.push({
      case: scenario.surface,
      calledTools,
      finalOutput: output.output,
    });
  }

  return results;
}
