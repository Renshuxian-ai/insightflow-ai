import "server-only";

import type { DatasetAnalyticsContext } from "@/lib/analytics/dataset-context";
import type { BehaviorSignal, DiagnosticCase } from "@/lib/diagnostics/types";
import type {
  EvidenceReference,
  InvestigationResult,
} from "@/lib/investigations/types";

import {
  getAnalyticsInvestigationToolNames,
  runBoundedInvestigationAgent,
} from "./agent/investigation-agent";
import type {
  AgentMessage,
  BoundedInvestigationAgentResult,
} from "./agent/types";
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
import {
  routeInvestigationModel,
  routeStructuredJsonModel,
} from "./model-router";
import type { ToolName } from "./tools/types";
import type {
  InvestigationFallbackReason,
  InvestigationGenerationResult,
} from "./types";

const DATASET_MODEL_ID = "deepseek-v3" as const;
const FALLBACK_MODEL_ID = "mock-prototype" as const;
const RETENTION_EVIDENCE_IDS = [
  "analytics-retention-metric-evidence",
  "analytics-retention-segment-evidence",
  "analytics-retention-cohort-evidence",
] as const;
const FUNNEL_EVIDENCE_IDS = [
  "analytics-funnel-primary-dropoff-evidence",
  "analytics-funnel-version-context-evidence",
  "analytics-funnel-transition-comparison-evidence",
] as const;
const FEEDBACK_EVIDENCE_IDS = [
  "analytics-feedback-topic-volume-evidence",
  "analytics-feedback-sentiment-evidence",
  "analytics-feedback-user-quotes-evidence",
  "analytics-feedback-related-signal-evidence",
] as const;

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function attachServerMetadata(
  value: unknown,
  diagnosticCase: DiagnosticCase,
  investigationCaseId = diagnosticCase.id,
): unknown {
  if (!isRecord(value)) {
    return value;
  }

  const workingHypothesis = value.workingHypothesis;

  return {
    ...value,
    id: `investigation-${investigationCaseId}-${DATASET_MODEL_ID}`,
    diagnosticCaseId: diagnosticCase.id,
    source: "deepseek",
    status: "generated-draft",
    workingHypothesis: isRecord(workingHypothesis)
      ? {
          ...workingHypothesis,
          id: `hypothesis-${investigationCaseId}-${DATASET_MODEL_ID}`,
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
  const primarySignalRules = diagnosticCase.primarySignal
    ? [
        "Primary signal is the investigation anchor.",
        "All investigation summaries, hypotheses, and recommended validations must explain or validate the primary signal first.",
        "Secondary evidence can only provide supporting context and must not replace the primary signal as the investigation subject.",
        "Do not combine a secondary cohort interval change with an unsupported cause for the primary segment signal.",
        `Primary signal JSON:\n${JSON.stringify(diagnosticCase.primarySignal, null, 2)}`,
      ]
    : [];

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
      ...primarySignalRules,
      "For every evidenceUsed item, copy one exact sourceType and sourceId pair from the initial allowed evidence sources below or from a successful tool observation sourceReferences array. Never mix a sourceType with an ID from another pair.",
      "Do not use the DiagnosticCase ID, reasoning evidenceReferenceIds, trace step IDs, or nextValidation IDs as evidenceUsed.sourceId.",
      "The id of an evidenceUsed item is a new reference ID. All later evidenceReferenceIds must point to those new evidenceUsed.id values, never directly to a DiagnosticCase sourceId.",
      "For every recommendedValidations item, copy one exact validationId from the allowed validation IDs below.",
      "Do not infer feedback, segment, platform, release, or version effects when the case does not contain that evidence.",
      `Initial allowed evidence sources:\n${JSON.stringify(allowedEvidenceSources, null, 2)}`,
      `Allowed validation IDs:\n${JSON.stringify(allowedValidationIds)}`,
      INVESTIGATION_OUTPUT_CONTRACT,
      `Required JSON shape:\n${INVESTIGATION_RESULT_SHAPE}`,
      `Dataset DiagnosticCase JSON:\n${JSON.stringify(diagnosticCase, null, 2)}`,
    ].join("\n\n"),
  };
}

function describePrimarySignal(diagnosticCase: DiagnosticCase): string | null {
  const signal = diagnosticCase.primarySignal;

  if (!signal) {
    return null;
  }

  if (isFunnelAnalyticsCase(diagnosticCase)) {
    return `${signal.interval} funnel conversion is ${signal.currentValue}% versus ${signal.baselineValue}% (${signal.gap > 0 ? "+" : ""}${signal.gap} pp), with ${signal.affectedUsers.toLocaleString("en-US")} users lost`;
  }

  if (isFeedbackAnalyticsCase(diagnosticCase)) {
    return `${signal.segment} feedback has ${signal.affectedUsers.toLocaleString("en-US")} mentions and changed ${diagnosticCase.metric.changeValue > 0 ? "+" : ""}${diagnosticCase.metric.changeValue}% versus the previous period`;
  }

  return `${signal.segment} ${signal.interval} ${signal.metric} is ${signal.currentValue}% versus ${signal.baselineValue}% (${signal.gap > 0 ? "+" : ""}${signal.gap} pp) across ${signal.affectedUsers.toLocaleString("en-US")} affected users`;
}

function isRetentionAnalyticsCase(diagnosticCase: DiagnosticCase): boolean {
  const evidenceIds = new Set(
    diagnosticCase.evidence.behaviorSignals.map((signal) => signal.id),
  );

  return (
    diagnosticCase.source === "dataset" &&
    diagnosticCase.metric.id.startsWith("retention-") &&
    diagnosticCase.context.dateRange.id === "analytics-retention-cohort" &&
    diagnosticCase.context.segment.id === "analytics-retention-segment" &&
    RETENTION_EVIDENCE_IDS.every((evidenceId) => evidenceIds.has(evidenceId))
  );
}

function isFunnelAnalyticsCase(diagnosticCase: DiagnosticCase): boolean {
  const evidenceIds = new Set(
    diagnosticCase.evidence.behaviorSignals.map((signal) => signal.id),
  );

  return (
    diagnosticCase.source === "dataset" &&
    diagnosticCase.metric.id === "funnel-conversion" &&
    diagnosticCase.context.segment.id === "analytics-funnel-transition" &&
    FUNNEL_EVIDENCE_IDS.every((evidenceId) => evidenceIds.has(evidenceId))
  );
}

function isFeedbackAnalyticsCase(diagnosticCase: DiagnosticCase): boolean {
  const evidenceIds = new Set([
    ...diagnosticCase.evidence.behaviorSignals.map((signal) => signal.id),
    ...diagnosticCase.evidence.feedbackSignals.map((signal) => signal.id),
  ]);

  return (
    diagnosticCase.source === "dataset" &&
    diagnosticCase.metric.id === "feedback-topic-mentions" &&
    diagnosticCase.context.segment.id ===
      "analytics-feedback-affected-segment" &&
    FEEDBACK_EVIDENCE_IDS.every((evidenceId) => evidenceIds.has(evidenceId))
  );
}

function describePrimarySignalSubject(diagnosticCase: DiagnosticCase): string {
  const primarySignal = diagnosticCase.primarySignal;

  if (!primarySignal) {
    return `${diagnosticCase.metric.label} change`;
  }

  if (isFunnelAnalyticsCase(diagnosticCase)) {
    return `${primarySignal.interval} funnel transition drop-off`;
  }

  if (isRetentionAnalyticsCase(diagnosticCase)) {
    return `${primarySignal.segment} ${primarySignal.interval} retention gap`;
  }

  if (isFeedbackAnalyticsCase(diagnosticCase)) {
    return `${primarySignal.segment} feedback topic increase`;
  }

  return `${primarySignal.segment} ${primarySignal.interval} ${primarySignal.metric} gap`;
}

function toAgentMessages(
  prompts: ReturnType<typeof buildDatasetPrompts>,
): AgentMessage[] {
  return [
    { role: "system", content: prompts.systemPrompt },
    { role: "user", content: prompts.userPrompt },
  ];
}

function assertToolEvidenceUsed(
  result: InvestigationResult,
  toolEvidence: BoundedInvestigationAgentResult["toolEvidence"],
): void {
  const evidenceSources = new Set(
    result.evidenceUsed.map(
      (reference) => `${reference.sourceType}:${reference.sourceId}`,
    ),
  );
  const ungroundedTool = toolEvidence.find(
    (toolResult) =>
      toolResult.status === "success" &&
      !toolResult.sourceReferences.some((reference) =>
        evidenceSources.has(`${reference.sourceType}:${reference.sourceId}`),
      ),
  );

  if (ungroundedTool) {
    throw new InvestigationOutputValidationError({
      path: "investigationResult.evidenceUsed",
      issue: `missing evidence from ${ungroundedTool.toolName} observation.`,
      expected:
        "at least one exact source reference from every successful tool observation",
      receivedType: "array",
      received: `array(length=${result.evidenceUsed.length})`,
    });
  }
}

type DatasetInvestigationAdditionalEvidence = Readonly<{
  existingEvidence: DiagnosticCase["evidence"];
  toolEvidence: BoundedInvestigationAgentResult["toolEvidence"];
}>;

function assertAdditionalEvidenceGrounded(
  diagnosticCase: DiagnosticCase,
  additionalEvidence: DatasetInvestigationAdditionalEvidence,
): void {
  const availableSources = new Set([
    `metric:${diagnosticCase.metric.id}`,
    ...Object.values(diagnosticCase.context).map(
      (contextItem) => `context:${contextItem.id}`,
    ),
    ...additionalEvidence.existingEvidence.behaviorSignals.map(
      (signal) => `behavior-signal:${signal.id}`,
    ),
    ...additionalEvidence.existingEvidence.feedbackSignals.map(
      (signal) => `feedback-signal:${signal.id}`,
    ),
  ]);
  const ungroundedReference = additionalEvidence.toolEvidence
    .filter((toolResult) => toolResult.status === "success")
    .flatMap((toolResult) => toolResult.sourceReferences)
    .find(
      (reference) =>
        !availableSources.has(`${reference.sourceType}:${reference.sourceId}`),
    );

  if (ungroundedReference) {
    throw new InvestigationOutputValidationError({
      path: "additionalEvidence.toolEvidence.sourceReferences",
      issue: "tool observation contains an ungrounded source reference.",
      expected: "an existing source ID from the requested DiagnosticCase",
      receivedType: "string",
      received: "string(reference not found)",
    });
  }
}

function assertPrimarySignalAnchoring(
  result: InvestigationResult,
  diagnosticCase: DiagnosticCase,
): void {
  const primarySignal = diagnosticCase.primarySignal;

  if (!primarySignal) {
    return;
  }

  const anchorTerms = [primarySignal.segment, primarySignal.interval].map(
    (term) => term.trim().toLocaleLowerCase("en-US"),
  );
  const anchoredFields = [
    {
      path: "investigationResult.focus",
      value: `${result.focus.title} ${result.focus.description}`,
    },
    {
      path: "investigationResult.summary.text",
      value: result.summary.text,
    },
    {
      path: "investigationResult.workingHypothesis.statement",
      value: result.workingHypothesis.statement,
    },
    ...result.recommendedValidations.map((validation, index) => ({
      path: `investigationResult.recommendedValidations[${index}].rationale`,
      value: validation.rationale,
    })),
  ];
  const unanchoredField = anchoredFields.find(({ value }) => {
    const normalizedValue = value.toLocaleLowerCase("en-US");

    return anchorTerms.some((term) => !normalizedValue.includes(term));
  });

  if (unanchoredField) {
    throw new InvestigationOutputValidationError({
      path: unanchoredField.path,
      issue: "text is not anchored to the DiagnosticCase primary signal.",
      expected: `text identifying segment ${primarySignal.segment} and interval ${primarySignal.interval}`,
      receivedType: "string",
      received: `string(length=${unanchoredField.value.length})`,
    });
  }
}

async function generateAnalyticsAgentInvestigation(
  diagnosticCase: DiagnosticCase,
  allowedToolNames: readonly ToolName[],
  executionScope: "retention-dataset" | "analytics-dataset",
  datasetAnalyticsContext?: DatasetAnalyticsContext,
  investigationCaseId?: string,
): Promise<{
  result: InvestigationResult;
  trace: BoundedInvestigationAgentResult["trace"];
}> {
  const { model, provider } = routeInvestigationModel(DATASET_MODEL_ID);

  if (!provider.isAvailable()) {
    throw new ProviderUnavailableError(provider.id);
  }

  const agentResult = await runBoundedInvestigationAgent({
    diagnosticCase,
    model,
    provider,
    initialMessages: toAgentMessages(buildDatasetPrompts(diagnosticCase)),
    toolPolicy: {
      allowedToolNames,
      executionScope,
      ...(datasetAnalyticsContext ? { datasetAnalyticsContext } : {}),
    },
  });
  const additionalEvidence = {
    existingEvidence: diagnosticCase.evidence,
    toolEvidence: agentResult.toolEvidence,
  } satisfies DatasetInvestigationAdditionalEvidence;

  assertAdditionalEvidenceGrounded(diagnosticCase, additionalEvidence);
  const result = parseInvestigationResult(
    attachServerMetadata(agentResult.output, diagnosticCase, investigationCaseId),
    diagnosticCase,
  );

  if (isRetentionAnalyticsCase(diagnosticCase)) {
    assertPrimarySignalAnchoring(result, diagnosticCase);
  }
  assertToolEvidenceUsed(result, agentResult.toolEvidence);

  return { result, trace: agentResult.trace };
}

function createFallbackEvidence(
  diagnosticCase: DiagnosticCase,
): EvidenceReference[] {
  const maximumSourceReferences = 11;
  const metricBaseline = diagnosticCase.metric.previousValue
    ? ` from the ${diagnosticCase.metric.previousValue} baseline to ${diagnosticCase.metric.currentValue}`
    : ` at ${diagnosticCase.metric.currentValue}`;
  const metricReference: EvidenceReference = {
    id: "dataset-fallback-metric",
    sourceType: "metric",
    sourceId: diagnosticCase.metric.id,
    relevance: `Describes the ${diagnosticCase.metric.label} metric change${metricBaseline} for the selected comparison period.`,
  };
  const behaviorReferences = diagnosticCase.evidence.behaviorSignals
    .slice(0, maximumSourceReferences)
    .map(
      (signal, index): EvidenceReference => ({
        id: `dataset-fallback-evidence-${index + 1}`,
        sourceType: "behavior-signal",
        sourceId: signal.id,
        relevance: createFallbackBehaviorRelevance(signal, diagnosticCase),
      }),
    );
  const feedbackReferences = diagnosticCase.evidence.feedbackSignals
    .slice(0, maximumSourceReferences - behaviorReferences.length)
    .map(
      (signal, index): EvidenceReference => ({
        id: `dataset-fallback-feedback-${index + 1}`,
        sourceType: "feedback-signal",
        sourceId: signal.id,
        relevance: `Provides representative user feedback for the ${signal.topic} topic and preserves its qualitative evidence.`,
      }),
    );

  return [metricReference, ...behaviorReferences, ...feedbackReferences];
}

function createFallbackBehaviorRelevance(
  signal: BehaviorSignal,
  diagnosticCase: DiagnosticCase,
): string {
  const normalizedId = signal.id.toLocaleLowerCase("en-US");
  const normalizedLabel = signal.label.toLocaleLowerCase("en-US");
  const primarySignal = diagnosticCase.primarySignal;

  if (isFeedbackAnalyticsCase(diagnosticCase)) {
    if (normalizedId.includes("topic-volume")) {
      return `Describes the measured mention volume and period-over-period growth for the primary ${primarySignal?.segment ?? signal.label} feedback topic.`;
    }

    if (normalizedId.includes("sentiment")) {
      return `Provides aggregate sentiment evidence for the primary ${primarySignal?.segment ?? signal.label} feedback topic.`;
    }

    if (normalizedId.includes("related-signal")) {
      return `Provides the linked product signal as supporting context without asserting a causal relationship.`;
    }

    return `Describes the ${signal.label} aggregate feedback evidence linked to the selected topic.`;
  }

  if (isFunnelAnalyticsCase(diagnosticCase)) {
    if (normalizedId.includes("primary-dropoff")) {
      return `Describes the measured user drop-off at the primary ${primarySignal?.interval ?? "funnel transition"}.`;
    }

    if (normalizedId.includes("version-context")) {
      return `Provides the ${diagnosticCase.context.version.label} version context for the measured funnel signal.`;
    }

    if (normalizedId.includes("transition-comparison")) {
      return `Compares current and baseline completion for the primary ${primarySignal?.interval ?? "funnel transition"}.`;
    }

    return `Describes the ${signal.label} funnel evidence linked to the selected transition.`;
  }

  if (
    normalizedId.includes("cohort-evidence") ||
    normalizedLabel.includes("cohort")
  ) {
    const primarySignalContext = primarySignal
      ? ` for the primary ${primarySignal.segment} ${primarySignal.interval} ${primarySignal.metric} signal`
      : " for the measured anomaly";

    return `Provides cohort timing (${diagnosticCase.context.dateRange.label}) and baseline-comparison context${primarySignalContext}.`;
  }

  if (
    normalizedId.includes("segment-evidence") ||
    signal.source.toLocaleLowerCase("en-US").includes("segment") ||
    (primarySignal &&
      normalizedLabel.includes(
        primarySignal.segment.toLocaleLowerCase("en-US"),
      ))
  ) {
    return primarySignal
      ? `Describes the ${primarySignal.segment} ${primarySignal.segmentDimension} user-segment behavior difference at ${primarySignal.interval} retention.`
      : `Describes the ${signal.label} user-segment behavior difference linked to this anomaly.`;
  }

  if (
    normalizedId.includes("metric-evidence") ||
    normalizedLabel.includes("retention")
  ) {
    return `Describes the selected cohort's ${signal.label} metric difference against its retention baseline.`;
  }

  return `Describes the ${signal.label} behavior evidence linked to this anomaly.`;
}

function createDatasetFallbackResult(
  diagnosticCase: DiagnosticCase,
  investigationCaseId = diagnosticCase.id,
): InvestigationResult {
  const evidenceUsed = createFallbackEvidence(diagnosticCase);
  const evidenceReferenceIds = evidenceUsed.map((reference) => reference.id);
  const primarySignalDescription = describePrimarySignal(diagnosticCase);
  const primarySignalSubject = describePrimarySignalSubject(diagnosticCase);
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
    id: `investigation-${investigationCaseId}-${FALLBACK_MODEL_ID}`,
    diagnosticCaseId: diagnosticCase.id,
    source: "mock",
    status: "prototype-draft",
    focus: {
      title: diagnosticCase.primarySignal
        ? `Validate the ${primarySignalSubject}`
        : `Validate the ${diagnosticCase.metric.label} change`,
      description: primarySignalDescription
        ? `${primarySignalDescription}. Validate this primary signal before using secondary evidence as supporting context.`
        : "Use the available aggregate evidence to verify where the change is concentrated before proposing a cause.",
    },
    summary: {
      text: primarySignalDescription
        ? `${primarySignalDescription}. The current DiagnosticCase supports this primary signal but does not establish why it occurred.`
        : `${diagnosticCase.summary.changed} The current DiagnosticCase supports the observed anomaly but does not establish why it occurred.`,
      evidenceReferenceIds,
    },
    evidenceUsed,
    possibleExplanations: [
      {
        id: "dataset-fallback-unmeasured-driver",
        statement: diagnosticCase.primarySignal
          ? `An unmeasured behavior may be associated with the ${primarySignalSubject}.`
          : "An unmeasured behavior or segment difference may be associated with the observed change.",
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
      id: `hypothesis-${investigationCaseId}-${FALLBACK_MODEL_ID}`,
      statement: diagnosticCase.primarySignal
        ? `Behavior-level validation may identify where the ${primarySignalSubject} is concentrated.`
        : "Further segmented or behavior-level validation may identify where the observed metric change is concentrated.",
      status: "unvalidated",
      evidenceReferenceIds,
    },
    recommendedValidations: diagnosticCase.nextValidations.map(
      (validation, index) => ({
        validationId: validation.id,
        priority: index === 0 ? "primary" : "supporting",
        rationale:
          index === 0
            ? diagnosticCase.primarySignal
              ? `Use this validation to investigate the primary ${primarySignalSubject}.`
              : "Start with the first available validation to add evidence beyond the aggregate metric."
            : diagnosticCase.primarySignal
              ? `Use this only as supporting analysis for the primary ${primarySignalSubject}.`
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
  options: {
    datasetAnalyticsContext?: DatasetAnalyticsContext;
    analyticsToolNames?: readonly ToolName[];
    investigationCaseId?: string;
  } = {},
): Promise<InvestigationGenerationResult> {
  const model = getAIModel(DATASET_MODEL_ID);

  try {
    const analyticsToolNames =
      options.analyticsToolNames ??
      getAnalyticsInvestigationToolNames(diagnosticCase);

    if (analyticsToolNames) {
      const generation = await generateAnalyticsAgentInvestigation(
        diagnosticCase,
        analyticsToolNames,
        "analytics-dataset",
        options.datasetAnalyticsContext,
        options.investigationCaseId,
      );

      return {
        result: generation.result,
        trace: generation.trace,
        requestedModelId: DATASET_MODEL_ID,
        usedModelId: DATASET_MODEL_ID,
        fallback: null,
      };
    }

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
      attachServerMetadata(output, diagnosticCase, options.investigationCaseId),
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
      createDatasetFallbackResult(diagnosticCase, options.investigationCaseId),
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
