import type { DatasetAnalyticsContext } from "@/lib/analytics/dataset-context";
import type { DiagnosticCase } from "@/lib/diagnostics/types";
import type { EvidenceReference, InvestigationResult } from "@/lib/investigations/types";
import type { ProductReport } from "@/lib/reports/mock-reports";
import type { ValidationPlan } from "@/lib/validations/types";

export type InvestigationReportBuilderInput = {
  diagnosticCase: DiagnosticCase;
  investigationCaseId?: string;
  datasetIdentity?: string;
  investigationResult: InvestigationResult;
  validationPlan: ValidationPlan;
  validationStatus: "draft" | "running" | "completed";
  investigationCreatedAt: string;
  validationCompletedAt: string;
  datasetAnalyticsContext?: DatasetAnalyticsContext;
};

function unique(values: readonly string[]) {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function toDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Report lifecycle metadata contains an invalid date.");
  }

  return date.toISOString().slice(0, 10);
}

function getSource(diagnosticCase: DiagnosticCase): ProductReport["source"] {
  if (diagnosticCase.metric.id === "activity-dau") {
    return "Trends Analytics";
  }
  if (diagnosticCase.metric.id === "funnel-conversion") {
    return "Funnel Analytics";
  }

  if (diagnosticCase.metric.id === "feedback-topic-mentions") {
    return "Feedback Intelligence";
  }

  return "Retention Analytics";
}

function formatGap(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(2)} pp`;
}

function findBehaviorSignal(
  diagnosticCase: DiagnosticCase,
  sourceId: string,
) {
  return diagnosticCase.evidence.behaviorSignals.find(
    (signal) => signal.id === sourceId,
  );
}

function findFeedbackSignal(
  diagnosticCase: DiagnosticCase,
  sourceId: string,
) {
  return diagnosticCase.evidence.feedbackSignals.find(
    (signal) => signal.id === sourceId,
  );
}

function getDatasetStatement(
  reference: EvidenceReference,
  diagnosticCase: DiagnosticCase,
  context: DatasetAnalyticsContext | undefined,
): string | null {
  const interval =
    diagnosticCase.primarySignal?.interval ??
    diagnosticCase.metric.label.match(/D\d+/i)?.[0]?.toLocaleUpperCase("en-US");

  if (context?.retentionEvidence?.comparison && interval?.startsWith("D")) {
    const current = context.retentionEvidence.comparison.current.intervals.find(
      (item) => item.interval === interval,
    );
    const baseline = context.retentionEvidence.comparison.baseline.intervals.find(
      (item) => item.day === current?.day,
    );

    if (current && baseline && reference.sourceType !== "feedback-signal") {
      const gap = current.retentionRate - baseline.retentionRate;

      return `${current.interval} retention is ${current.retentionRate.toFixed(2)}% in the current window versus ${baseline.retentionRate.toFixed(2)}% in the baseline window (${formatGap(gap)}); estimated time-window evidence.`;
    }
  }

  if (context?.funnelEvidence && diagnosticCase.metric.id === "funnel-conversion") {
    const transition = context.funnelEvidence.transitions.find(
      (item) =>
        interval?.includes(item.fromStep) && interval.includes(item.toStep),
    ) ?? context.funnelEvidence.transitions[0];
    const versions = transition?.versions.filter(
      (version) => version.completionRate !== null,
    );
    const current = versions?.at(-1);
    const baseline = versions?.at(-2);

    if (
      transition &&
      current?.completionRate != null &&
      baseline?.completionRate != null
    ) {
      const gap = current.completionRate - baseline.completionRate;

      return `${transition.funnelName} ${transition.fromStep} to ${transition.toStep}: ${current.version} ${current.completionRate.toFixed(2)}% versus ${baseline.version} ${baseline.completionRate.toFixed(2)}% (${formatGap(gap)}), with an estimated ${transition.dropOffUsers?.toLocaleString("en-US") ?? "unavailable"} users dropping off.`;
    }
  }

  if (context?.feedbackEvidence && diagnosticCase.metric.id === "feedback-topic-mentions") {
    const topic = context.feedbackEvidence.topics.find(
      (item) => item.topic === diagnosticCase.primarySignal?.segment,
    ) ?? context.feedbackEvidence.topics[0];

    if (topic) {
      if (reference.sourceType === "feedback-signal") {
        return topic.quotes.length > 0
          ? `${topic.topic} representative quote: “${topic.quotes[0]}”`
          : `${topic.topic} has no representative quote in the available evidence.`;
      }

      return `${topic.topic} has ${topic.mentions.toLocaleString("en-US")} mentions with ${topic.sentiment} sentiment${topic.trend ? ` and ${topic.trend.changePercent > 0 ? "+" : ""}${topic.trend.changePercent.toFixed(2)}% change` : ""}.`;
    }
  }

  return null;
}

function getEvidenceType(
  reference: EvidenceReference,
  diagnosticCase: DiagnosticCase,
): ProductReport["supportingEvidence"][number]["type"] {
  if (
    reference.sourceType === "feedback-signal" ||
    diagnosticCase.metric.id === "feedback-topic-mentions"
  ) {
    return "Feedback evidence";
  }

  if (diagnosticCase.metric.id === "funnel-conversion") {
    return "Funnel evidence";
  }

  return "Metric evidence";
}

function resolveEvidence(
  reference: EvidenceReference,
  diagnosticCase: DiagnosticCase,
  context: DatasetAnalyticsContext | undefined,
  reportLimitations: readonly string[],
): ProductReport["supportingEvidence"][number] {
  const behavior = findBehaviorSignal(diagnosticCase, reference.sourceId);
  const feedback = findFeedbackSignal(diagnosticCase, reference.sourceId);
  const contextItem = Object.values(diagnosticCase.context).find(
    (item) => item.id === reference.sourceId,
  );
  const datasetStatement = getDatasetStatement(
    reference,
    diagnosticCase,
    context,
  );
  const statement =
    datasetStatement ??
    (reference.sourceType === "metric"
      ? `${diagnosticCase.metric.label} is ${diagnosticCase.metric.currentValue}${diagnosticCase.metric.previousValue ? ` versus ${diagnosticCase.metric.previousValue}` : ""} for ${diagnosticCase.metric.comparison}.`
      : feedback
        ? `${feedback.topic} has ${feedback.mentionCount.toLocaleString("en-US")} mentions with ${feedback.sentiment.toLocaleLowerCase("en-US")} sentiment${feedback.snippets[0] ? `. Representative quote: “${feedback.snippets[0]}”` : ""}`
        : behavior
          ? `${behavior.finding} ${behavior.detail}`
          : contextItem?.label ?? reference.relevance);
  const searchable = `${statement} ${reference.relevance} ${reportLimitations.join(" ")}`
    .toLocaleLowerCase("en-US");
  const evidenceQuality = searchable.includes("estimat")
    ? "estimated"
    : datasetStatement
      ? "observed"
      : "derived";

  return {
    id: reference.id,
    type: getEvidenceType(reference, diagnosticCase),
    statement,
    label:
      behavior?.label ??
      feedback?.topic ??
      contextItem?.label ??
      diagnosticCase.metric.label,
    sourceType: reference.sourceType,
    sourceId: reference.sourceId,
    relevance: reference.relevance,
    provenance:
      context?.source === "uploaded-dataset"
        ? `Uploaded dataset · ${context.datasetId}`
        : behavior?.source ?? feedback?.source ?? "DiagnosticCase",
    evidenceQuality,
    limitations:
      evidenceQuality === "estimated"
        ? reportLimitations.filter((limitation) =>
            limitation.toLocaleLowerCase("en-US").includes("estimat"),
          )
        : [],
  };
}

function getReportLimitations(
  diagnosticCase: DiagnosticCase,
  investigationResult: InvestigationResult,
  context: DatasetAnalyticsContext | undefined,
) {
  const isRetention = diagnosticCase.metric.id.startsWith("retention-");
  const isFunnel = diagnosticCase.metric.id === "funnel-conversion";
  const isFeedback = diagnosticCase.metric.id === "feedback-topic-mentions";
  const datasetLimitations = [
    ...(isRetention &&
    context?.retentionEvidence?.comparison?.evidenceQuality === "estimated"
      ? ["Retention comparison uses estimated adjacent time windows."]
      : []),
    ...(isFunnel && context?.funnelEvidence?.transitions.some(
      (transition) => transition.dropOffUsers !== null,
    )
      ? ["Funnel drop-off users are estimated from aggregate completion evidence."]
      : []),
    ...(isFeedback &&
    !diagnosticCase.evidence.behaviorSignals.some((signal) =>
      signal.id.includes("related-signal"),
    )
      ? ["No related product signal is available in the investigation evidence."]
      : []),
  ];

  return unique([...investigationResult.limitations, ...datasetLimitations]);
}

export function buildInvestigationReport(
  input: InvestigationReportBuilderInput,
): ProductReport | null {
  const {
    diagnosticCase,
    investigationResult,
    validationPlan,
    validationStatus,
  } = input;

  if (validationStatus !== "completed") {
    return null;
  }

  if (
    investigationResult.diagnosticCaseId !== diagnosticCase.id ||
    validationPlan.diagnosticCaseId !== diagnosticCase.id ||
    validationPlan.investigationResultId !== investigationResult.id
  ) {
    throw new Error("Report inputs do not belong to the same investigation.");
  }

  const limitations = getReportLimitations(
    diagnosticCase,
    investigationResult,
    input.datasetAnalyticsContext,
  );
  const sortedRecommendations = [...investigationResult.recommendedValidations]
    .sort((left, right) =>
      left.priority === right.priority ? 0 : left.priority === "primary" ? -1 : 1,
    )
    .slice(0, 3);
  const recommendedActions = sortedRecommendations.flatMap(
    (recommendation, index) => {
      const validation = diagnosticCase.nextValidations.find(
        (item) => item.id === recommendation.validationId,
      );

      return validation
        ? [{
            priority: (index + 1) as 1 | 2 | 3,
            title: validation.label,
            description: `${validation.description} ${recommendation.rationale}`,
          }]
        : [];
    },
  );
  const keyFindings = [investigationResult.summary.text];

  return {
    id: `report-${input.investigationCaseId ?? investigationResult.id}`,
    ...(input.datasetIdentity ? { datasetIdentity: input.datasetIdentity } : {}),
    ...(input.investigationCaseId
      ? { investigationCaseId: input.investigationCaseId }
      : {}),
    investigationId: investigationResult.id,
    validationPlanId: validationPlan.id,
    title: diagnosticCase.title,
    source: getSource(diagnosticCase),
    status: "Validated",
    createdAt: toDate(input.investigationCreatedAt),
    updatedAt: toDate(input.validationCompletedAt),
    aiSummary: investigationResult.summary.text,
    aiSummaryEvidenceReferenceIds: [
      ...investigationResult.summary.evidenceReferenceIds,
    ],
    keyFindings,
    keyFindingEvidenceReferences: [{
      finding: keyFindings[0],
      evidenceReferenceIds: [
        ...investigationResult.summary.evidenceReferenceIds,
      ],
    }],
    recommendedActions,
    supportingEvidence: investigationResult.evidenceUsed.map((reference) =>
      resolveEvidence(
        reference,
        diagnosticCase,
        input.datasetAnalyticsContext,
        limitations,
      ),
    ),
    limitations,
  };
}
