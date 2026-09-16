import "server-only";

import type { DiagnosticCase } from "@/lib/diagnostics/types";

import type { ToolExecutionResult, ToolName } from "../tools/types";
import { evaluateEvidenceSufficiency } from "./evidence-sufficiency-evaluator";
import type { LlmEvidenceEvaluator } from "./llm-evidence-evaluator";

function assertFixture(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Evidence evaluator fixture failed: ${message}`);
  }
}

function createDiagnosticCase(
  surface: "retention" | "funnel" | "feedback",
): DiagnosticCase {
  const metricId = {
    retention: "retention-d1",
    funnel: "funnel-conversion",
    feedback: "feedback-topic-mentions",
  }[surface];

  return {
    id: `evidence-evaluator-${surface}`,
    source: "dataset",
    status: "ready",
    severity: "HIGH",
    title: `${surface} evidence fixture`,
    primarySignal: {
      metric: surface,
      interval: surface === "retention" ? "D1" : "current period",
      segmentDimension: "Segment",
      segment: "Affected users",
      currentValue: 38,
      baselineValue: 51,
      gap: -13,
      affectedUsers: 100,
    },
    metric: {
      id: metricId,
      label: surface,
      currentValue: "38",
      previousValue: "51",
      changeValue: -13,
      comparison: "current vs. baseline",
    },
    context: {
      dateRange: { id: "fixture-period", label: "Current period" },
      segment: { id: "fixture-segment", label: "Affected users" },
      platform: { id: "fixture-platform", label: "All platforms" },
      version: { id: "fixture-version", label: "V3.2" },
    },
    summary: {
      changed: "The metric changed.",
      affected: "An affected segment exists.",
      started: "Timing is not established.",
    },
    evidence: {
      behaviorSignals: [
        {
          id: "fixture-behavior",
          label: "Fixture evidence",
          value: "38",
          finding: "The aggregate metric changed.",
          detail: "Fixture-only evidence.",
          source: "Fixture",
        },
      ],
      feedbackSignals: [],
    },
    reasoning: {
      observation: {
        statement: "The metric changed.",
        evidenceIds: ["fixture-behavior"],
      },
      inference: {
        statement: "The change requires investigation.",
        evidenceIds: ["fixture-behavior"],
      },
      hypothesis: {
        statement: "No cause is established.",
        evidenceIds: ["fixture-behavior"],
      },
    },
    traceSteps: [],
    nextValidations: [
      {
        id: "fixture-validation",
        label: "Validate evidence",
        description: "Collect supporting evidence.",
      },
    ],
  };
}

function createObservation(
  toolName: ToolName,
  facts: ToolExecutionResult["observation"]["facts"],
): ToolExecutionResult {
  return {
    toolName,
    status: "success",
    observation: {
      summary: `${toolName} returned aggregate evidence.`,
      facts,
      sourceReferences: [
        { sourceType: "behavior-signal", sourceId: "fixture-behavior" },
      ],
      limitations: ["Fixture observation only."],
    },
    message: null,
  };
}

const acceptingLlmEvaluator: LlmEvidenceEvaluator = async () => ({
  sufficient: true,
  reasoning: "The supplied observations cover the required evidence.",
  missingEvidence: [],
});

export async function runEvidenceEvaluatorFixtures() {
  const retentionCase = createDiagnosticCase("retention");
  const retentionTool = createObservation("retention_analysis", {
    metric: "D1 retention",
    currentValue: 38.4,
    baselineValue: 51.4,
    gap: -13,
    affectedSegment: "Android new users",
    evidence: ["D1 retention is below baseline."],
  });
  const segmentTool = createObservation("segment_analysis", {
    segment: "Android new users",
    metricDifference: -13,
    evidence: ["The difference is concentrated in Android new users."],
  });
  const feedbackTool = createObservation("feedback_analysis", {
    topic: "Onboarding clarity",
    mentions: 21,
    sentiment: "Negative",
    representativeQuotes: ["The next onboarding step was unclear."],
    evidence: ["Onboarding clarity is an emerging feedback topic."],
  });
  const retentionOnly = await evaluateEvidenceSufficiency(
    {
      diagnosticCase: retentionCase,
      toolObservations: [retentionTool],
      availableTools: [
        "retention_analysis",
        "segment_analysis",
        "feedback_analysis",
      ],
    },
    acceptingLlmEvaluator,
  );

  assertFixture(
    retentionOnly.status === "insufficient" &&
      retentionOnly.missingEvidence.includes("affected user segment") &&
      retentionOnly.recommendedNextTools.includes("segment_analysis"),
    "Retention metric evidence alone must request segment evidence.",
  );

  const completeRetention = await evaluateEvidenceSufficiency(
    {
      diagnosticCase: retentionCase,
      toolObservations: [retentionTool, segmentTool, feedbackTool],
      availableTools: [
        "retention_analysis",
        "segment_analysis",
        "feedback_analysis",
      ],
    },
    acceptingLlmEvaluator,
  );

  assertFixture(
    completeRetention.status === "sufficient" &&
      completeRetention.evidenceScore >= 0.8,
    "Retention metric, segment, and feedback evidence must pass.",
  );

  const funnelOnly = await evaluateEvidenceSufficiency(
    {
      diagnosticCase: createDiagnosticCase("funnel"),
      toolObservations: [
        createObservation("funnel_analysis", {
          stepTransition: "Step 2 → Step 3",
          completionRate: 32.5,
          dropOffRate: 67.5,
          affectedUsers: 27,
          evidence: ["The transition has the largest drop-off."],
        }),
      ],
      availableTools: ["funnel_analysis", "segment_analysis"],
    },
    acceptingLlmEvaluator,
  );

  assertFixture(
    funnelOnly.status === "insufficient" &&
      funnelOnly.missingEvidence.includes("affected user segment") &&
      funnelOnly.recommendedNextTools.includes("segment_analysis"),
    "Funnel transition evidence alone must request segment evidence.",
  );

  const feedbackEvidence = await evaluateEvidenceSufficiency(
    {
      diagnosticCase: createDiagnosticCase("feedback"),
      toolObservations: [feedbackTool],
      availableTools: ["feedback_analysis", "retention_analysis"],
    },
    acceptingLlmEvaluator,
  );

  assertFixture(
    feedbackEvidence.status === "sufficient" &&
      feedbackEvidence.evidenceScore >= 0.8,
    "Feedback topic and representative quotes must pass.",
  );

  return {
    retentionOnly,
    completeRetention,
    funnelOnly,
    feedbackEvidence,
  };
}
