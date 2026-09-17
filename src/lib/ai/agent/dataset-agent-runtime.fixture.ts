import "server-only";

import { getAnalyticsInvestigationToolNames } from "@/lib/ai/agent/investigation-agent";
import { generateDatasetInvestigation } from "@/lib/ai/dataset-investigation-generator";
import { parseInvestigationResult } from "@/lib/ai/output-schema";
import { buildFixtureDatasetAnalyticsContext } from "@/lib/analytics/dataset-context/dataset-analytics-context.fixtures";
import { buildDatasetAnalyticsSession } from "@/lib/analytics/dataset-context/session-store";
import type { DatasetAnalyticsSurface } from "@/lib/analytics/dataset-context";
import type { DiagnosticCase } from "@/lib/diagnostics/types";
import type { ToolName } from "@/lib/ai/tools/types";

type JsonRecord = Record<string, unknown>;

function assertFixture(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Dataset agent runtime fixture failed: ${message}`);
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function createModelOutput(diagnosticCase: DiagnosticCase) {
  const primarySignal = diagnosticCase.primarySignal;

  assertFixture(primarySignal, "a primary signal is required for agent generation.");

  const anchor = `${primarySignal.segment} ${primarySignal.interval}`;
  const source = diagnosticCase.evidence.feedbackSignals[0]
    ? {
        sourceType: "feedback-signal" as const,
        sourceId: diagnosticCase.evidence.feedbackSignals[0].id,
      }
    : {
        sourceType: "behavior-signal" as const,
        sourceId: diagnosticCase.evidence.behaviorSignals[0].id,
      };
  const evidenceUsed = [{
    id: "dataset-runtime-tool-evidence",
    ...source,
    relevance: `Provides uploaded dataset evidence for ${anchor}.`,
  }];

  return {
    focus: {
      title: `Validate ${anchor}`,
      description: `Investigate ${anchor} using uploaded dataset observations before proposing a cause.`,
    },
    summary: {
      text: `${anchor} is the primary signal supported by uploaded dataset evidence and requires validation.`,
      evidenceReferenceIds: [evidenceUsed[0].id],
    },
    evidenceUsed,
    possibleExplanations: [
      {
        id: "dataset-runtime-possible-explanation",
        statement: `An unmeasured product behavior may be associated with ${anchor}.`,
        qualification: "possible-not-confirmed",
        evidenceRelationship: "context-only",
        confidence: "low",
        confidenceRationale:
          "The uploaded dataset observations describe the signal but do not establish causation.",
        evidenceReferenceIds: [evidenceUsed[0].id],
        uncertainty: "Segment-level or causal evidence may still be unavailable.",
      },
    ],
    workingHypothesis: {
      statement: `Further validation may explain where ${anchor} is concentrated.`,
      evidenceReferenceIds: [evidenceUsed[0].id],
    },
    recommendedValidations: diagnosticCase.nextValidations.map(
      (validation, index) => ({
        validationId: validation.id,
        priority: index === 0 ? "primary" : "supporting",
        rationale: `Use this analysis to validate ${anchor} without assuming a cause.`,
      }),
    ),
    limitations: [
      "Uploaded evidence is aggregate and may include estimated values.",
      "Tool observations do not establish causation.",
    ],
  };
}

function toolCall(
  id: string,
  name: ToolName,
  input: Record<string, string>,
) {
  return {
    id,
    type: "function",
    function: {
      name,
      arguments: JSON.stringify(input),
    },
  };
}

function createMockDeepSeekFetch(
  surface: DatasetAnalyticsSurface,
  diagnosticCase: DiagnosticCase,
  toolRequests: Array<{ name: string; input: unknown }>,
  evaluationInputs: string[],
) {
  let selectionRound = 0;

  return async (_input: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as JsonRecord;
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const firstMessage = isRecord(messages[0]) ? messages[0] : {};
    const systemContent =
      typeof firstMessage.content === "string" ? firstMessage.content : "";
    const tools = Array.isArray(body.tools) ? body.tools : [];

    if (systemContent.includes("You evaluate whether aggregate product evidence")) {
      const userMessage = messages.find(
        (message) => isRecord(message) && message.role === "user",
      );

      if (isRecord(userMessage) && typeof userMessage.content === "string") {
        evaluationInputs.push(userMessage.content);
      }

      return Response.json({
        choices: [
          {
            finish_reason: "stop",
            message: {
              content: JSON.stringify({
                sufficient: true,
                reasoning:
                  "Structured uploaded-data observations are available; limitations remain explicit.",
                missingEvidence: [],
              }),
            },
          },
        ],
        usage: { completion_tokens: 60 },
      });
    }

    if (tools.length === 0) {
      return Response.json({
        choices: [
          {
            finish_reason: "stop",
            message: {
              content: JSON.stringify(createModelOutput(diagnosticCase)),
            },
          },
        ],
        usage: { completion_tokens: 420 },
      });
    }

    selectionRound += 1;
    const calls =
      surface === "retention"
        ? [
            toolCall("dataset-retention", "retention_analysis", {
              metric: "D1 retention",
              period: "D1",
            }),
            toolCall("dataset-retention-segment", "segment_analysis", {
              dimension: "analysis window",
              value: "Current window",
            }),
            toolCall("dataset-retention-feedback", "feedback_analysis", {
              topic: "Pricing",
              sentiment: "negative",
            }),
          ]
        : surface === "funnel"
          ? selectionRound === 1
            ? [
                toolCall("dataset-funnel", "funnel_analysis", {
                  funnelId: "Activation Funnel",
                  step: "complete_step2 complete_step3",
                }),
                toolCall("dataset-funnel-segment", "segment_analysis", {
                  dimension: "funnel step",
                  value: "complete_step3",
                }),
              ]
            : [
                toolCall("dataset-funnel-segment-repeat", "segment_analysis", {
                  dimension: "funnel step",
                  value: "complete_step3",
                }),
              ]
          : [
              toolCall("dataset-feedback", "feedback_analysis", {
                topic: "Pricing",
                sentiment: "negative",
              }),
            ];

    for (const call of calls) {
      toolRequests.push({
        name: call.function.name,
        input: JSON.parse(call.function.arguments) as unknown,
      });
    }

    return Response.json({
      choices: [
        {
          finish_reason: "tool_calls",
          message: { content: null, tool_calls: calls },
        },
      ],
      usage: { completion_tokens: 80 },
    });
  };
}

export async function runDatasetAgentRuntimeFixture() {
  const datasetContext = await buildFixtureDatasetAnalyticsContext();
  const session = buildDatasetAnalyticsSession(datasetContext);
  const unavailableEvidenceSession = buildDatasetAnalyticsSession({
    ...datasetContext,
    retentionEvidence: datasetContext.retentionEvidence
      ? { ...datasetContext.retentionEvidence, comparison: null }
      : null,
    funnelEvidence: datasetContext.funnelEvidence
      ? {
          ...datasetContext.funnelEvidence,
          transitions: datasetContext.funnelEvidence.transitions.map(
            (transition) => ({
              ...transition,
              versions: transition.versions.slice(-1),
            }),
          ),
        }
      : null,
    feedbackEvidence: datasetContext.feedbackEvidence
      ? {
          ...datasetContext.feedbackEvidence,
          topics: datasetContext.feedbackEvidence.topics.map((topic) => ({
            ...topic,
            trend: null,
          })),
        }
      : null,
  });
  const originalFetch = globalThis.fetch;
  const previousApiKey = process.env.DEEPSEEK_API_KEY;
  const results = [];

  process.env.DEEPSEEK_API_KEY = "dataset-runtime-fixture-only";

  assertFixture(
    unavailableEvidenceSession.availableSurfaces.length === 3,
    "available surfaces must remain discoverable when comparison evidence is incomplete.",
  );
  assertFixture(
    unavailableEvidenceSession.availableAnalysis.length === 0,
    "missing comparison evidence must not create a false primary signal.",
  );
  assertFixture(
    unavailableEvidenceSession.missingEvidence.some((item) =>
      item.includes("Retention current/baseline"),
    ) &&
      unavailableEvidenceSession.missingEvidence.some((item) =>
        item.includes("Funnel version baseline"),
      ) &&
      unavailableEvidenceSession.missingEvidence.some((item) =>
        item.includes("Feedback topic trend"),
      ),
    "unavailable baselines and trends must be surfaced as missing evidence.",
  );

  try {
    for (const surface of [
      "retention",
      "funnel",
      "feedback",
    ] as const satisfies readonly DatasetAnalyticsSurface[]) {
      const diagnosticCase = session.diagnosticCases[surface];

      assertFixture(
        diagnosticCase?.primarySignal,
        `${surface} must provide a real dataset primary signal.`,
      );

      const allowedToolNames = getAnalyticsInvestigationToolNames(diagnosticCase);

      assertFixture(
        allowedToolNames,
        `${surface} must map to the existing analytics tool policy.`,
      );

      const toolRequests: Array<{ name: string; input: unknown }> = [];
      const evaluationInputs: string[] = [];
      globalThis.fetch = createMockDeepSeekFetch(
        surface,
        diagnosticCase,
        toolRequests,
        evaluationInputs,
      );

      const generation = await generateDatasetInvestigation(diagnosticCase, {
        datasetAnalyticsContext: session.analyticsContext,
        analyticsToolNames: allowedToolNames,
      });
      const result = parseInvestigationResult(
        generation.result,
        diagnosticCase,
      );
      const calledTools = generation.trace.events.flatMap((event) =>
        event.type === "tool-call" && event.toolName ? [event.toolName] : [],
      );

      assertFixture(
        generation.fallback === null && result.source === "deepseek",
        `${surface} must produce a schema-valid non-fallback InvestigationResult.`,
      );
      assertFixture(
        calledTools.includes(
          surface === "retention"
            ? "retention_analysis"
            : surface === "funnel"
              ? "funnel_analysis"
              : "feedback_analysis",
        ),
        `${surface} must execute its dataset-backed primary tool.`,
      );
      assertFixture(
        generation.trace.events.some(
          (event) =>
            event.type === "observation" &&
            event.detail.toLocaleLowerCase("en-US").includes("uploaded"),
        ),
        `${surface} trace must contain an uploaded dataset observation.`,
      );
      const evaluatorInput = evaluationInputs.join("\n");

      assertFixture(
        evaluatorInput.includes("uploaded-dataset"),
        `${surface} evaluator input must preserve uploaded dataset provenance.`,
      );

      if (surface === "retention") {
        assertFixture(
          evaluatorInput.includes('"evidenceQuality":"estimated"'),
          "retention evaluator input must identify estimated evidence.",
        );
      } else if (surface === "funnel") {
        assertFixture(
          evaluatorInput.includes('"baselineAvailable":"true"'),
          "funnel evaluator input must identify baseline availability.",
        );
      } else {
        assertFixture(
          evaluatorInput.includes('"trendAvailable":"true"'),
          "feedback evaluator input must identify trend availability.",
        );
      }

      results.push({
        surface,
        primarySignal: diagnosticCase.primarySignal,
        requestedTools: toolRequests,
        calledTools,
        investigationResultId: result.id,
        source: result.source,
        fallback: generation.fallback,
        evaluatorSawUploadedDataset: true,
      });
    }
  } finally {
    globalThis.fetch = originalFetch;

    if (previousApiKey === undefined) {
      delete process.env.DEEPSEEK_API_KEY;
    } else {
      process.env.DEEPSEEK_API_KEY = previousApiKey;
    }
  }

  return {
    session: {
      sessionId: session.sessionId,
      datasetId: session.datasetId,
      availableSurfaces: session.availableSurfaces,
      availableAnalysis: session.availableAnalysis,
      missingEvidence: session.missingEvidence,
      limitations: session.limitations,
      unavailableEvidenceCheck: {
        availableSurfaces: unavailableEvidenceSession.availableSurfaces,
        availableAnalysis: unavailableEvidenceSession.availableAnalysis,
        missingEvidence: unavailableEvidenceSession.missingEvidence,
        limitations: unavailableEvidenceSession.limitations,
      },
    },
    results,
  };
}
