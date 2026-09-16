import { SEMANTIC_TYPE_IDS } from "@/lib/datasets/semantic/semantic-type-registry";
import type { SemanticType } from "@/lib/datasets/semantic/types";
import { buildTrendRuntime } from "@/lib/analytics/build-trend-runtime";
import { buildDatasetAnalyticsRuntime } from "@/lib/analytics/build-analytics-runtime";

import type {
  BuildOverviewRuntimeInput,
  OverviewRuntime,
  OverviewRuntimeAnomaly,
  OverviewRuntimeComparison,
  OverviewRuntimeMetric,
  OverviewRuntimeMetricId,
} from "./overview-runtime";

const RETENTION_DECLINE_THRESHOLD_POINTS = 3;
const CONVERSION_DECLINE_THRESHOLD_POINTS = 5;

function unavailableMetric(
  id: OverviewRuntimeMetricId,
  label: string,
  reason: string,
): OverviewRuntimeMetric {
  return { status: "unavailable", id, label, reason };
}

function createComparison(
  current: number,
  previous: number,
  currentPeriod: string,
  previousPeriod: string,
): OverviewRuntimeComparison {
  return {
    previous,
    absoluteChange: current - previous,
    relativeChange: previous === 0 ? null : (current - previous) / previous,
    currentPeriod,
    previousPeriod,
  };
}

function buildRetentionMetric(
  input: BuildOverviewRuntimeInput,
): OverviewRuntimeMetric {
  const evidence = input.analyticsContext.retentionEvidence;

  if (!evidence) {
    return unavailableMetric(
      "d1-retention",
      "D1 Retention",
      "Retention evidence is unavailable for this dataset.",
    );
  }

  const aggregate = evidence.intervals.find((interval) => interval.day === 1);
  const current = evidence.comparison?.current.intervals.find(
    (interval) => interval.day === 1,
  );
  const baseline = evidence.comparison?.baseline.intervals.find(
    (interval) => interval.day === 1,
  );

  if (!aggregate && !current) {
    return unavailableMetric(
      "d1-retention",
      "D1 Retention",
      "D1 retention evidence is unavailable for this dataset.",
    );
  }

  const currentInterval = current ?? aggregate!;
  const currentPeriod = current && evidence.comparison
    ? `${evidence.comparison.current.start} to ${evidence.comparison.current.end}`
    : `${evidence.dateRange.start} to ${evidence.dateRange.end}`;
  const previousPeriod = evidence.comparison
    ? `${evidence.comparison.baseline.start} to ${evidence.comparison.baseline.end}`
    : null;
  const comparison = baseline && previousPeriod
    ? createComparison(
        currentInterval.retentionRate,
        baseline.retentionRate,
        currentPeriod,
        previousPeriod,
      )
    : null;

  return {
    status: "available",
    id: "d1-retention",
    label: "D1 Retention",
    unit: "percentage",
    current: currentInterval.retentionRate,
    currentPeriod,
    comparison,
    comparisonUnavailableReason: comparison
      ? null
      : "A comparable baseline D1 interval is unavailable.",
  };
}

function buildFunnelMetric(
  input: BuildOverviewRuntimeInput,
): OverviewRuntimeMetric {
  const evidence = input.analyticsContext.funnelEvidence;

  if (!evidence || evidence.transitions.length === 0) {
    return unavailableMetric(
      "core-conversion",
      "Core Conversion",
      "Funnel transition evidence is unavailable for this dataset.",
    );
  }

  const transition = [...evidence.transitions]
    .filter((candidate) => candidate.completionRate !== null)
    .sort(
      (left, right) =>
        (right.dropOffUsers ?? -1) - (left.dropOffUsers ?? -1) ||
        right.observedRows - left.observedRows,
    )[0];

  if (!transition || transition.completionRate === null) {
    return unavailableMetric(
      "core-conversion",
      "Core Conversion",
      "Funnel completion-rate evidence is unavailable for this dataset.",
    );
  }

  const versions = transition.versions.filter(
    (version) => version.completionRate !== null,
  );
  const currentVersion = versions.at(-1);
  const previousVersion = versions.at(-2);
  const current = currentVersion?.completionRate ?? transition.completionRate;
  const currentPeriod = currentVersion
    ? `${transition.funnelName} · ${transition.fromStep} to ${transition.toStep} · ${currentVersion.version}`
    : `${transition.funnelName} · ${transition.fromStep} to ${transition.toStep}`;
  const comparison =
    currentVersion &&
    previousVersion &&
    currentVersion.completionRate !== null &&
    previousVersion.completionRate !== null
      ? createComparison(
          currentVersion.completionRate,
          previousVersion.completionRate,
          currentPeriod,
          `${transition.funnelName} · ${transition.fromStep} to ${transition.toStep} · ${previousVersion.version}`,
        )
      : null;

  return {
    status: "available",
    id: "core-conversion",
    label: "Core Conversion",
    unit: "percentage",
    current,
    currentPeriod,
    comparison,
    comparisonUnavailableReason: comparison
      ? null
      : "A comparable previous funnel version is unavailable.",
  };
}

function buildFeedbackMetric(
  input: BuildOverviewRuntimeInput,
): OverviewRuntimeMetric {
  const evidence = input.analyticsContext.feedbackEvidence;

  if (!evidence) {
    return unavailableMetric(
      "feedback",
      "Feedback",
      "Feedback evidence is unavailable for this dataset.",
    );
  }

  return {
    status: "available",
    id: "feedback",
    label: "Feedback",
    unit: "rows",
    current: evidence.totalFeedback,
    currentPeriod: "Entire dataset",
    comparison: null,
    comparisonUnavailableReason:
      "A dataset-level feedback period comparison is unavailable.",
  };
}

function metricAnomaly(
  metric: OverviewRuntimeMetric,
  anomalyMetric: "D1 Retention" | "Core Conversion",
  threshold: number,
): OverviewRuntimeAnomaly | null {
  if (
    metric.status !== "available" ||
    metric.unit !== "percentage" ||
    !metric.comparison ||
    metric.comparison.absoluteChange > -threshold
  ) {
    return null;
  }

  return {
    source: "dataset",
    metric: anomalyMetric,
    unit: "percentage",
    current: metric.current,
    previous: metric.comparison.previous,
    change: {
      absolute: metric.comparison.absoluteChange,
      relative: metric.comparison.relativeChange,
    },
    period: {
      current: metric.comparison.currentPeriod,
      previous: metric.comparison.previousPeriod,
    },
    evidenceSummary: `${anomalyMetric} declined from ${metric.comparison.previous.toFixed(1)}% to ${metric.current.toFixed(1)}% (${Math.abs(metric.comparison.absoluteChange).toFixed(1)} percentage points).`,
  };
}

export function buildOverviewRuntime(
  input: BuildOverviewRuntimeInput,
): OverviewRuntime {
  const retention = buildRetentionMetric(input);
  const funnel = buildFunnelMetric(input);
  const feedback = buildFeedbackMetric(input);
  const feedbackEvidence = input.analyticsContext.feedbackEvidence;
  const fieldBindings = Object.fromEntries(
    Object.values(SEMANTIC_TYPE_IDS).map((semanticType) => [semanticType, null]),
  ) as Record<SemanticType, null | NonNullable<OverviewRuntime["fieldBindings"][SemanticType]>>;

  fieldBindings[SEMANTIC_TYPE_IDS.userId] =
    input.activityEvidence.fields.userIdentifier;
  fieldBindings[SEMANTIC_TYPE_IDS.eventTimestamp] =
    input.activityEvidence.fields.eventTimestamp;
  fieldBindings[SEMANTIC_TYPE_IDS.eventName] =
    input.analyticsContext.funnelEvidence?.fields.eventName ?? null;
  fieldBindings[SEMANTIC_TYPE_IDS.feedbackText] =
    feedbackEvidence?.fields.feedbackText ?? null;
  fieldBindings[SEMANTIC_TYPE_IDS.sentiment] =
    feedbackEvidence?.fields.feedbackSentiment ?? null;

  return {
    version: 1,
    source: "dataset",
    rowCount: input.activityEvidence.rowCount,
    selectedSheetName: input.activityEvidence.selectedSheetName,
    fieldBindings,
    metrics: {
      dau: input.activityEvidence.dau,
      d1Retention: retention,
      coreConversion: funnel,
      feedback,
    },
    dailyDau: input.activityEvidence.dailyDau,
    trends: buildTrendRuntime(input),
    analytics: buildDatasetAnalyticsRuntime(input.analyticsContext),
    primaryAnomaly:
      metricAnomaly(
        retention,
        "D1 Retention",
        RETENTION_DECLINE_THRESHOLD_POINTS,
      ) ??
      metricAnomaly(
        funnel,
        "Core Conversion",
        CONVERSION_DECLINE_THRESHOLD_POINTS,
      ) ??
      input.activityEvidence.anomaly,
    feedbackTopics: feedbackEvidence
      ? {
          status: "available",
          items: feedbackEvidence.topics.map((topic) => ({
            name: topic.topic,
            mentionCount: topic.mentions,
            sentiment: topic.sentiment,
            changePercent: topic.trend?.changePercent ?? null,
          })),
        }
      : {
          status: "unavailable",
          reason: "Feedback topic evidence is unavailable for this dataset.",
        },
    userSegments: {
      status: "unavailable",
      reason:
        "Dataset Analytics Context does not yet provide segment-level overview evidence.",
    },
  };
}
