import "server-only";

import { createAnalyticsDiagnosticCase } from "@/lib/analytics/analytics-diagnostic-adapter";
import type { AnalyticsInvestigationContext } from "@/lib/analytics/investigation-context";
import type { DiagnosticCase } from "@/lib/diagnostics/types";

import { generateDatasetInvestigation } from "../dataset-investigation-generator";
import { parseInvestigationResult } from "../output-schema";
import type { ToolName } from "../tools/types";

type AgentToolCallingFixtureCase = {
  name: string;
  diagnosticCase: DiagnosticCase;
  expectedTools: readonly ToolName[];
  toolInputs: Record<string, Record<string, string>>;
  evidenceSourceIds: readonly string[];
};

function assertFixture(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Agent tool-calling fixture failed: ${message}`);
  }
}

function requireDiagnosticCase(
  context: AnalyticsInvestigationContext,
): DiagnosticCase {
  const diagnosticCase = createAnalyticsDiagnosticCase(context);

  assertFixture(diagnosticCase, `could not build the ${context.surface} case.`);
  return diagnosticCase;
}

function createRetentionCase(): DiagnosticCase {
  return {
    id: "fixture-retention-agent-case",
    source: "dataset",
    status: "ready",
    severity: "HIGH",
    title: "D1 retention decline",
    primarySignal: {
      metric: "retention",
      interval: "D1",
      segmentDimension: "Platform",
      segment: "Android new users",
      currentValue: 38.4,
      baselineValue: 51.4,
      gap: -13,
      affectedUsers: 9_800,
    },
    metric: {
      id: "retention-d1",
      label: "D1 retention",
      currentValue: "38.4%",
      previousValue: "51.4%",
      changeValue: -13,
      changeType: "percentage-points",
      comparison: "Current cohort vs. retention baseline",
    },
    context: {
      dateRange: {
        id: "analytics-retention-cohort",
        label: "Current cohort",
      },
      segment: {
        id: "analytics-retention-segment",
        label: "Platform: Android new users",
      },
      platform: {
        id: "analytics-retention-platform",
        label: "Android",
      },
      version: {
        id: "analytics-retention-version",
        label: "V3.2",
      },
    },
    summary: {
      changed: "D1 retention is 13 pp below baseline.",
      affected: "Android new users are the affected segment.",
      started: "The available evidence does not establish a cause.",
    },
    evidence: {
      behaviorSignals: [
        {
          id: "analytics-retention-metric-evidence",
          label: "D1 retention",
          value: "38.4% · -13.0 pp",
          finding: "D1 retention is 38.4% versus a 51.4% baseline.",
          detail: "Aggregate demo retention metric evidence.",
          source: "Retention Analytics · cohort comparison",
        },
        {
          id: "analytics-retention-segment-evidence",
          label: "Platform · Android new users",
          value: "9,800 users",
          finding: "Android new users show the measured D1 retention gap.",
          detail: "Aggregate demo segment evidence.",
          source: "Retention Analytics · segment breakdown",
        },
        {
          id: "analytics-retention-cohort-evidence",
          label: "Current retention cohort",
          value: "Current cohort",
          finding: "The current cohort provides supporting context.",
          detail: "Cohort context only.",
          source: "Retention Analytics · cohort matrix",
        },
      ],
      feedbackSignals: [],
    },
    reasoning: {
      observation: {
        statement: "Android new-user D1 retention is below baseline.",
        evidenceIds: ["analytics-retention-metric-evidence"],
      },
      inference: {
        statement: "The segment difference requires investigation.",
        evidenceIds: ["analytics-retention-segment-evidence"],
      },
      hypothesis: {
        statement: "No cause is established.",
        evidenceIds: ["analytics-retention-metric-evidence"],
      },
    },
    traceSteps: [],
    nextValidations: [
      {
        id: "analytics-compare-onboarding-funnel",
        label: "Compare onboarding funnel",
        description: "Compare onboarding behavior for the affected segment.",
      },
    ],
  };
}

function createFunnelCase(): DiagnosticCase {
  return requireDiagnosticCase({
    surface: "funnel",
    signalId: "funnel:v3-2:step2:step3",
    funnelStepTransition: {
      from: { eventName: "complete_step2", label: "Complete Step2" },
      to: { eventName: "complete_step3", label: "Complete Step3" },
    },
    currentVersion: "V3.2",
    previousVersion: "V3.1",
    currentCompletionRate: 32.5,
    baselineCompletionRate: 100,
    gap: -67.5,
    dropOffUsers: 27,
  });
}

function createFeedbackCase(): DiagnosticCase {
  return requireDiagnosticCase({
    surface: "feedback",
    signalId: "feedback:search-relevance",
    topic: {
      name: "Search relevance",
      mentions: 38,
      change: 37,
      sentiment: "negative",
    },
    affectedSegment: "Search-heavy teams",
    evidenceQuotes: ["Search results are not relevant after the update."],
    relatedSignal: {
      name: "Core conversion declined",
      change: -2.3,
    },
  });
}

function createModelOutput(
  diagnosticCase: DiagnosticCase,
  evidenceSourceIds: readonly string[],
) {
  const primarySignal = diagnosticCase.primarySignal;

  assertFixture(primarySignal, "fixture case must have a primary signal.");
  const anchor = `${primarySignal.segment} ${primarySignal.interval}`;
  const evidenceUsed = evidenceSourceIds.map((sourceId, index) => ({
    id: `fixture-tool-evidence-${index + 1}`,
    sourceType: "behavior-signal" as const,
    sourceId,
    relevance: `Provides read-only analytics evidence from ${sourceId}.`,
  }));
  const evidenceReferenceIds = evidenceUsed.map((reference) => reference.id);

  return {
    focus: {
      title: `Validate ${anchor}`,
      description: `Investigate ${anchor} with the additional analytics tool evidence before proposing a cause.`,
    },
    summary: {
      text: `${anchor} remains the primary measured signal; tool observations add supporting evidence without establishing causation.`,
      evidenceReferenceIds,
    },
    evidenceUsed,
    possibleExplanations: [
      {
        id: "fixture-unmeasured-driver",
        statement: `An unmeasured behavior may be associated with ${anchor}.`,
        qualification: "possible-not-confirmed" as const,
        evidenceRelationship: "context-only" as const,
        confidence: "low" as const,
        confidenceRationale:
          "The tools add aggregate observations but do not identify a causal mechanism.",
        evidenceReferenceIds,
        uncertainty: "Behavior-level causality has not been validated.",
      },
    ],
    workingHypothesis: {
      statement: `Further validation may identify where ${anchor} is concentrated.`,
      evidenceReferenceIds,
    },
    recommendedValidations: diagnosticCase.nextValidations.map(
      (validation, index) => ({
        validationId: validation.id,
        priority: index === 0 ? ("primary" as const) : ("supporting" as const),
        rationale: `Use this next step to validate ${anchor} without assuming a cause.`,
      }),
    ),
    limitations: [
      "Analytics tools use demo aggregate data only.",
      "The observations do not establish causation.",
    ],
  };
}

function parseRequestBody(init: RequestInit | undefined) {
  assertFixture(typeof init?.body === "string", "provider body must be JSON.");
  const body = JSON.parse(init.body) as unknown;

  assertFixture(body && typeof body === "object", "provider body must be an object.");
  return body as Record<string, unknown>;
}

function getAdvertisedTools(body: Record<string, unknown>): string[] {
  const tools = body.tools;

  assertFixture(Array.isArray(tools), "tool-selection request must expose tools.");
  return tools.map((tool) => {
    assertFixture(tool && typeof tool === "object", "tool must be an object.");
    const definition = Reflect.get(tool, "function");

    assertFixture(
      definition && typeof definition === "object",
      "tool must contain a function definition.",
    );
    const name = Reflect.get(definition, "name");

    assertFixture(typeof name === "string", "tool name must be a string.");
    return name;
  });
}

function getToolObservationCount(body: Record<string, unknown>): number {
  const messages = body.messages;

  assertFixture(Array.isArray(messages), "provider request must contain messages.");
  return messages.filter(
    (message) =>
      message &&
      typeof message === "object" &&
      Reflect.get(message, "role") === "tool",
  ).length;
}

const fixtureCases: AgentToolCallingFixtureCase[] = [
  {
    name: "retention",
    diagnosticCase: createRetentionCase(),
    expectedTools: [
      "retention_analysis",
      "segment_analysis",
      "feedback_analysis",
    ],
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
      feedback_analysis: { topic: "Onboarding clarity" },
    },
    evidenceSourceIds: [
      "analytics-retention-metric-evidence",
      "analytics-retention-segment-evidence",
      "analytics-retention-cohort-evidence",
    ],
  },
  {
    name: "funnel",
    diagnosticCase: createFunnelCase(),
    expectedTools: ["funnel_analysis", "segment_analysis"],
    toolInputs: {
      funnel_analysis: { step: "Complete Step2 → Complete Step3" },
      segment_analysis: {
        dimension: "Funnel step",
        value: "Complete Step3",
      },
    },
    evidenceSourceIds: [
      "analytics-funnel-primary-dropoff-evidence",
      "analytics-funnel-transition-comparison-evidence",
    ],
  },
  {
    name: "feedback",
    diagnosticCase: createFeedbackCase(),
    expectedTools: ["feedback_analysis", "retention_analysis"],
    toolInputs: {
      feedback_analysis: {
        topic: "Search relevance",
        sentiment: "negative",
      },
      retention_analysis: {
        metric: "D1 retention",
        segment: "Search-heavy teams",
        period: "D1",
      },
    },
    evidenceSourceIds: [
      "analytics-feedback-topic-volume-evidence",
      "analytics-feedback-related-signal-evidence",
    ],
  },
];

export async function runAgentToolCallingFixture() {
  const originalFetch = globalThis.fetch;
  const previousApiKey = process.env.DEEPSEEK_API_KEY;
  const results = [];

  process.env.DEEPSEEK_API_KEY = "fixture-only-key";

  try {
    for (const fixture of fixtureCases) {
      let requestCount = 0;
      let advertisedTools: string[] = [];
      let observationCount = 0;

      globalThis.fetch = async (_input, init) => {
        const body = parseRequestBody(init);
        requestCount += 1;

        if (requestCount === 1) {
          advertisedTools = getAdvertisedTools(body);

          return new Response(
            JSON.stringify({
              choices: [
                {
                  finish_reason: "tool_calls",
                  message: {
                    content: null,
                    tool_calls: fixture.expectedTools.map((toolName, index) => ({
                      id: `${fixture.name}-tool-call-${index + 1}`,
                      type: "function",
                      function: {
                        name: toolName,
                        arguments: JSON.stringify(fixture.toolInputs[toolName]),
                      },
                    })),
                  },
                },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        observationCount = getToolObservationCount(body);

        if (requestCount === 2) {
          return new Response(
            JSON.stringify({
              choices: [
                {
                  finish_reason: "stop",
                  message: {
                    content: JSON.stringify({
                      sufficient: true,
                      reasoning:
                        "The required aggregate tool evidence is available.",
                      missingEvidence: [],
                    }),
                  },
                },
              ],
              usage: { completion_tokens: 80 },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        return new Response(
          JSON.stringify({
            choices: [
              {
                finish_reason: "stop",
                message: {
                  content: JSON.stringify(
                    createModelOutput(
                      fixture.diagnosticCase,
                      fixture.evidenceSourceIds,
                    ),
                  ),
                },
              },
            ],
            usage: { completion_tokens: 600 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      };

      const generation = await generateDatasetInvestigation(
        fixture.diagnosticCase,
      );
      const result = parseInvestigationResult(
        generation.result,
        {
          ...fixture.diagnosticCase,
          evidence: {
            ...fixture.diagnosticCase.evidence,
            behaviorSignals: [
              ...fixture.diagnosticCase.evidence.behaviorSignals,
              ...fixture.evidenceSourceIds.map((sourceId) => ({
                id: sourceId,
                label: "Fixture tool evidence",
                value: "Fixture",
                finding: "Fixture tool observation.",
                detail: "Fixture-only additional evidence.",
                source: "Agent tool-calling fixture",
              })),
            ],
          },
        },
      );
      const traceToolNames = generation.trace.events.flatMap((event) =>
        event.type === "tool-call" && event.toolName ? [event.toolName] : [],
      );

      assertFixture(
        advertisedTools.join(",") === fixture.expectedTools.join(","),
        `${fixture.name} exposed unexpected tools: ${advertisedTools.join(",")}.`,
      );
      assertFixture(
        traceToolNames.join(",") === fixture.expectedTools.join(","),
        `${fixture.name} did not call the expected tools.`,
      );
      assertFixture(
        observationCount === fixture.expectedTools.length,
        `${fixture.name} did not return every tool observation to the agent.`,
      );
      assertFixture(
        fixture.evidenceSourceIds.every((sourceId) =>
          result.evidenceUsed.some(
            (reference) => reference.sourceId === sourceId,
          ),
        ),
        `${fixture.name} tool evidence was not retained in evidenceUsed.`,
      );

      results.push({
        case: fixture.name,
        calledTools: traceToolNames,
        observationCount,
        investigationResultId: result.id,
      });
    }

    return results;
  } finally {
    globalThis.fetch = originalFetch;

    if (previousApiKey === undefined) {
      delete process.env.DEEPSEEK_API_KEY;
    } else {
      process.env.DEEPSEEK_API_KEY = previousApiKey;
    }
  }
}
