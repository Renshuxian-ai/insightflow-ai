import "server-only";

import type { DiagnosticCase } from "@/lib/diagnostics/types";
import type {
  EvidenceReference,
  InvestigationResult,
} from "@/lib/investigations/types";

import {
  INVESTIGATION_OUTPUT_CONTRACT,
  INVESTIGATION_RESULT_SHAPE,
} from "./agent/agent-prompt";
import { appendTraceEvent, createAgentTrace } from "./agent/agent-trace";
import { getAIModel } from "./model-registry";
import {
  InvestigationOutputValidationError,
  parseInvestigationResult,
} from "./output-schema";
import {
  ProviderRequestError,
  ProviderUnavailableError,
} from "./provider";
import { routeStructuredJsonModel } from "./model-router";
import type {
  InvestigationFallbackReason,
  InvestigationGenerationResult,
} from "./types";

const DATASET_MODEL_ID = "deepseek-v3" as const;
const FALLBACK_MODEL_ID = "mock-prototype" as const;

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function attachServerMetadata(
  value: unknown,
  diagnosticCase: DiagnosticCase,
): unknown {
  if (!isRecord(value)) {
    return value;
  }

  const workingHypothesis = value.workingHypothesis;

  return {
    ...value,
    id: `investigation-${diagnosticCase.id}-${DATASET_MODEL_ID}`,
    diagnosticCaseId: diagnosticCase.id,
    source: "deepseek",
    status: "generated-draft",
    workingHypothesis: isRecord(workingHypothesis)
      ? {
          ...workingHypothesis,
          id: `hypothesis-${diagnosticCase.id}-${DATASET_MODEL_ID}`,
          status: "unvalidated",
        }
      : workingHypothesis,
  };
}

function buildDatasetPrompts(diagnosticCase: DiagnosticCase) {
  const allowedEvidenceSources = [
    {
      sourceType: "metric",
      sourceId: diagnosticCase.metric.id,
    },
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
  ];
  const allowedValidationIds = diagnosticCase.nextValidations.map(
    (validation) => validation.id,
  );

  return {
    systemPrompt: [
      "You are an evidence-grounded product investigation assistant.",
      "Use only the supplied aggregate DiagnosticCase and its existing evidence.",
      "Do not invent segments, feedback, version effects, user behavior findings, metrics, dates, or causal claims.",
      "Never present a cause as confirmed.",
      "The working hypothesis must remain explicitly unvalidated and should propose what to test next, not assert what happened.",
      "When evidence is insufficient, state the gap clearly in confidence rationale, uncertainty, and limitations.",
      "Return one JSON object and no Markdown.",
    ].join(" "),
    userPrompt: [
      "Create a concise investigation draft from this Dataset DiagnosticCase.",
      "Separate evidence-backed observations from possible explanations and an unvalidated working hypothesis.",
      "For every evidenceUsed item, copy one exact sourceType and sourceId pair from the allowed evidence sources below. Never mix a sourceType with an ID from another pair.",
      "Do not use the DiagnosticCase ID, reasoning evidenceReferenceIds, trace step IDs, or nextValidation IDs as evidenceUsed.sourceId.",
      "The id of an evidenceUsed item is a new reference ID. All later evidenceReferenceIds must point to those new evidenceUsed.id values, never directly to a DiagnosticCase sourceId.",
      "For every recommendedValidations item, copy one exact validationId from the allowed validation IDs below.",
      "Do not infer feedback, segment, platform, release, or version effects when the case does not contain that evidence.",
      `Allowed evidence sources:\n${JSON.stringify(allowedEvidenceSources, null, 2)}`,
      `Allowed validation IDs:\n${JSON.stringify(allowedValidationIds)}`,
      INVESTIGATION_OUTPUT_CONTRACT,
      `Required JSON shape:\n${INVESTIGATION_RESULT_SHAPE}`,
      `Dataset DiagnosticCase JSON:\n${JSON.stringify(diagnosticCase, null, 2)}`,
    ].join("\n\n"),
  };
}

function createFallbackEvidence(
  diagnosticCase: DiagnosticCase,
): EvidenceReference[] {
  const metricReference: EvidenceReference = {
    id: "dataset-fallback-metric",
    sourceType: "metric",
    sourceId: diagnosticCase.metric.id,
    relevance: "Defines the measured anomaly and its comparison period.",
  };
  const behaviorReferences = diagnosticCase.evidence.behaviorSignals
    .slice(0, 10)
    .map(
      (signal, index): EvidenceReference => ({
        id: `dataset-fallback-evidence-${index + 1}`,
        sourceType: "behavior-signal",
        sourceId: signal.id,
        relevance: "Provides the aggregate dataset evidence linked to this anomaly.",
      }),
    );

  return [metricReference, ...behaviorReferences];
}

function createDatasetFallbackResult(
  diagnosticCase: DiagnosticCase,
): InvestigationResult {
  const evidenceUsed = createFallbackEvidence(diagnosticCase);
  const evidenceReferenceIds = evidenceUsed.map((reference) => reference.id);
  const limitations = [
    "The configured AI model was unavailable or did not return a valid draft.",
    "The aggregate evidence does not identify a confirmed cause.",
  ];

  if (diagnosticCase.evidence.feedbackSignals.length === 0) {
    limitations.push("No feedback evidence is available in this DiagnosticCase.");
  }

  if (diagnosticCase.context.segment.label === "Not segmented") {
    limitations.push("No segment breakdown is available in this DiagnosticCase.");
  }

  return {
    id: `investigation-${diagnosticCase.id}-${FALLBACK_MODEL_ID}`,
    diagnosticCaseId: diagnosticCase.id,
    source: "mock",
    status: "prototype-draft",
    focus: {
      title: `Validate the ${diagnosticCase.metric.label} change`,
      description:
        "Use the available aggregate evidence to verify where the change is concentrated before proposing a cause.",
    },
    summary: {
      text: `${diagnosticCase.summary.changed} The current DiagnosticCase supports the observed anomaly but does not establish why it occurred.`,
      evidenceReferenceIds,
    },
    evidenceUsed,
    possibleExplanations: [
      {
        id: "dataset-fallback-unmeasured-driver",
        statement:
          "An unmeasured behavior or segment difference may be associated with the observed change.",
        qualification: "possible-not-confirmed",
        evidenceRelationship: "context-only",
        confidence: "low",
        confidenceRationale:
          "The supplied aggregate evidence confirms the metric pattern but contains no direct evidence for a driver.",
        evidenceReferenceIds,
        uncertainty:
          "The current case does not show which behavior, segment, or qualitative factor could explain the change.",
      },
    ],
    workingHypothesis: {
      id: `hypothesis-${diagnosticCase.id}-${FALLBACK_MODEL_ID}`,
      statement:
        "Further segmented or behavior-level validation may identify where the observed metric change is concentrated.",
      status: "unvalidated",
      evidenceReferenceIds,
    },
    recommendedValidations: diagnosticCase.nextValidations.map(
      (validation, index) => ({
        validationId: validation.id,
        priority: index === 0 ? "primary" : "supporting",
        rationale:
          index === 0
            ? "Start with the first available validation to add evidence beyond the aggregate metric."
            : "Use this as supporting analysis after the primary validation.",
      }),
    ),
    limitations,
  };
}

function getFallbackReason(error: unknown): InvestigationFallbackReason {
  if (error instanceof ProviderUnavailableError) {
    return "provider-unavailable";
  }

  if (
    error instanceof InvestigationOutputValidationError ||
    error instanceof SyntaxError ||
    (error instanceof ProviderRequestError && error.code === "invalid-json")
  ) {
    return "invalid-output";
  }

  return "provider-error";
}

const fallbackMessages: Record<InvestigationFallbackReason, string> = {
  "provider-unavailable":
    "DeepSeek is not configured. A deterministic prototype draft was used instead.",
  "provider-error":
    "DeepSeek could not complete this request. A deterministic prototype draft was used instead.",
  "invalid-output":
    "DeepSeek returned an invalid draft. A deterministic prototype draft was used instead.",
};

export async function generateDatasetInvestigation(
  diagnosticCase: DiagnosticCase,
): Promise<InvestigationGenerationResult> {
  const model = getAIModel(DATASET_MODEL_ID);

  try {
    const { provider } = routeStructuredJsonModel(DATASET_MODEL_ID);

    if (!provider.isAvailable()) {
      throw new ProviderUnavailableError(provider.id);
    }

    const prompts = buildDatasetPrompts(diagnosticCase);
    const trace = createAgentTrace(diagnosticCase.id, DATASET_MODEL_ID, {
      maxToolRounds: 0,
      maxToolCalls: 0,
    });
    appendTraceEvent(
      trace,
      "model-request",
      "Requested one structured investigation draft from the aggregate Dataset DiagnosticCase.",
    );
    const output = await provider.generateStructuredJson({
      model,
      ...prompts,
      temperature: 0.2,
      maxTokens: 3_000,
    });
    const result = parseInvestigationResult(
      attachServerMetadata(output, diagnosticCase),
      diagnosticCase,
    );
    appendTraceEvent(
      trace,
      "final-generation",
      "Validated the structured investigation draft against the Dataset DiagnosticCase evidence.",
    );

    return {
      result,
      trace,
      requestedModelId: DATASET_MODEL_ID,
      usedModelId: DATASET_MODEL_ID,
      fallback: null,
    };
  } catch (error) {
    if (
      process.env.NODE_ENV === "development" &&
      error instanceof InvestigationOutputValidationError
    ) {
      const { path, issue, expected, receivedType, received } =
        error.diagnostic;

      console.error(
        [
          "Dataset investigation validation failed:",
          `path=${path}`,
          `reason=${issue}`,
          `expected=${expected}`,
          `receivedType=${receivedType}`,
          `receivedSummary=${received}`,
        ].join("\n"),
      );
    }

    const fallbackReason = getFallbackReason(error);
    const result = parseInvestigationResult(
      createDatasetFallbackResult(diagnosticCase),
      diagnosticCase,
    );
    const trace = createAgentTrace(diagnosticCase.id, FALLBACK_MODEL_ID, {
      maxToolRounds: 0,
      maxToolCalls: 0,
    });
    appendTraceEvent(
      trace,
      "final-generation",
      "Created a deterministic prototype draft from the existing Dataset DiagnosticCase evidence.",
    );

    return {
      result,
      trace,
      requestedModelId: DATASET_MODEL_ID,
      usedModelId: FALLBACK_MODEL_ID,
      fallback: {
        reason: fallbackReason,
        message: fallbackMessages[fallbackReason],
      },
    };
  }
}
