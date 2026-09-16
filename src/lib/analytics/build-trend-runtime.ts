import { buildDatasetFeedbackInvestigationContexts } from "./dataset-feedback-investigation-adapter";
import { buildDatasetFunnelInvestigationContexts } from "./dataset-funnel-investigation-adapter";
import { buildDatasetRetentionInvestigationContext } from "./dataset-retention-investigation-adapter";
import { buildDatasetActivityInvestigationContext } from "./dataset-activity-investigation-adapter";
import type { DatasetAnalyticsContext } from "./dataset-context";
import type { AnalyticsInvestigationContext } from "./investigation-context";
import type {
  TrendRuntime,
  TrendRuntimeMetric,
  TrendRuntimeSignal,
} from "./trend-runtime";
import type { OverviewRuntimeActivityEvidence } from "../overview/overview-runtime";

type BuildTrendRuntimeInput = {
  analyticsContext: DatasetAnalyticsContext;
  activityEvidence: OverviewRuntimeActivityEvidence;
};

function toId(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function createActivityTrend(
  evidence: OverviewRuntimeActivityEvidence,
): TrendRuntimeMetric | null {
  if (
    evidence.dailyDau.status === "unavailable" ||
    evidence.dailyDau.points.length < 2
  ) {
    return null;
  }

  const points = evidence.dailyDau.points.map((point) => ({
    label: point.date,
    value: point.value,
    context: "All observed users",
  }));
  const current = points.at(-1)!;
  const previous = points.at(-2) ?? null;

  return {
    id: "activity-dau",
    surface: "activity",
    label: "Daily active users",
    unit: "users",
    points,
    current,
    previous,
    change: previous ? current.value - previous.value : null,
    changeType: "absolute",
    comparison: previous ? `${current.label} vs. ${previous.label}` : null,
    contextLabel: "All observed users",
  };
}

function createActivitySignal(
  analyticsContext: DatasetAnalyticsContext,
  evidence: OverviewRuntimeActivityEvidence,
): TrendRuntimeSignal | null {
  const anomaly = evidence.anomaly;

  if (!anomaly) {
    return null;
  }

  return {
    id: "activity-dau-decline",
    metricId: "activity-dau",
    title: "Daily active users declined",
    direction: "decline",
    current: anomaly.current,
    previous: anomaly.previous,
    change: anomaly.change.relative === null
      ? anomaly.change.absolute
      : anomaly.change.relative * 100,
    changeType:
      anomaly.change.relative === null ? "absolute" : "relative-percent",
    unit: "users",
    comparison: `${anomaly.period.current} vs. ${anomaly.period.previous}`,
    contextLabel: "All observed users",
    investigationContext: buildDatasetActivityInvestigationContext(
      analyticsContext,
      evidence,
    ),
  };
}

function buildRetentionTrends(
  context: DatasetAnalyticsContext,
): { metrics: TrendRuntimeMetric[]; signals: TrendRuntimeSignal[] } {
  const evidence = context.retentionEvidence;

  if (!evidence) {
    return { metrics: [], signals: [] };
  }

  const investigationContext = buildDatasetRetentionInvestigationContext(context);

  if (!evidence.comparison) {
    return { metrics: [], signals: [] };
  }

  const baselineByDay = new Map(
    evidence.comparison.baseline.intervals.map((interval) => [interval.day, interval]),
  );
  const metrics: TrendRuntimeMetric[] = [];
  const signals: TrendRuntimeSignal[] = [];

  for (const currentInterval of evidence.comparison.current.intervals) {
    const baselineInterval = baselineByDay.get(currentInterval.day);

    if (!baselineInterval) {
      continue;
    }

    const metricId = `retention-${currentInterval.interval.toLocaleLowerCase("en-US")}`;
    const previous = {
      label: "Baseline window",
      value: baselineInterval.retentionRate,
      context: `${evidence.comparison.baseline.start} to ${evidence.comparison.baseline.end}`,
    };
    const current = {
      label: "Current window",
      value: currentInterval.retentionRate,
      context: `${evidence.comparison.current.start} to ${evidence.comparison.current.end}`,
    };
    const change = current.value - previous.value;
    const comparison = `${current.context} vs. ${previous.context}`;

    metrics.push({
      id: metricId,
      surface: "retention",
      label: `${currentInterval.interval} Retention`,
      unit: "percentage",
      points: [previous, current],
      current,
      previous,
      change,
      changeType: "percentage-points",
      comparison,
      contextLabel: "Current analysis window",
    });

    if (change < 0) {
      const contextInterval = investigationContext?.metricEvidence.intervals.find(
        (interval) => interval.interval === currentInterval.interval,
      );
      const signalContext = investigationContext && contextInterval
        ? {
            ...investigationContext,
            signalId: [
              "dataset",
              context.datasetId,
              "retention",
              contextInterval.interval.toLocaleLowerCase("en-US"),
            ].join(":"),
            selectedInterval: contextInterval.interval,
          }
        : null;

      signals.push({
        id: `${metricId}-decline`,
        metricId,
        title: `${currentInterval.interval} retention declined`,
        direction: "decline",
        current: current.value,
        previous: previous.value,
        change,
        changeType: "percentage-points",
        unit: "percentage",
        comparison,
        contextLabel: "Current analysis window",
        investigationContext: signalContext,
      });
    }
  }

  return { metrics, signals };
}

function buildFunnelTrends(
  context: DatasetAnalyticsContext,
): { metrics: TrendRuntimeMetric[]; signals: TrendRuntimeSignal[] } {
  const evidence = context.funnelEvidence;

  if (!evidence) {
    return { metrics: [], signals: [] };
  }

  const investigationContexts = buildDatasetFunnelInvestigationContexts(context);
  const metrics: TrendRuntimeMetric[] = [];
  const signals: TrendRuntimeSignal[] = [];

  for (const transition of evidence.transitions) {
    const metricId = [
      "funnel",
      toId(transition.funnelName),
      toId(transition.fromStep),
      toId(transition.toStep),
    ].join("-");
    const versionPoints = transition.versions.flatMap((version) =>
      version.completionRate === null
        ? []
        : [{
            label: version.version,
            value: version.completionRate,
            context: `${transition.fromStep} to ${transition.toStep}`,
          }],
    );
    const points = versionPoints;

    if (points.length < 2) {
      continue;
    }

    const current = points.at(-1)!;
    const previous = points.at(-2) ?? null;
    const change = previous ? current.value - previous.value : null;
    const comparison = previous ? `${current.label} vs. ${previous.label}` : null;
    const investigationContext = investigationContexts.find(
      (candidate) =>
        candidate.funnelStepTransition.from.label === transition.fromStep &&
        candidate.funnelStepTransition.to.label === transition.toStep &&
        candidate.funnelName === transition.funnelName,
    ) ?? null;

    metrics.push({
      id: metricId,
      surface: "funnel",
      label: `${transition.fromStep} to ${transition.toStep}`,
      unit: "percentage",
      points,
      current,
      previous,
      change,
      changeType: "percentage-points",
      comparison,
      contextLabel: transition.funnelName,
    });

    if (change !== null && change < 0) {
      signals.push({
        id: `${metricId}-decline`,
        metricId,
        title: `${transition.toStep} completion declined`,
        direction: "decline",
        current: current.value,
        previous: previous!.value,
        change,
        changeType: "percentage-points",
        unit: "percentage",
        comparison: comparison!,
        contextLabel: transition.funnelName,
        investigationContext,
      });
    }
  }

  return { metrics, signals };
}

function buildFeedbackTrends(
  context: DatasetAnalyticsContext,
): { metrics: TrendRuntimeMetric[]; signals: TrendRuntimeSignal[] } {
  const evidence = context.feedbackEvidence;

  if (!evidence) {
    return { metrics: [], signals: [] };
  }

  const investigationContexts = buildDatasetFeedbackInvestigationContexts(context);
  const metrics: TrendRuntimeMetric[] = [];
  const signals: TrendRuntimeSignal[] = [];

  for (const topic of evidence.topics) {
    if (!topic.trend) {
      continue;
    }

    const metricId = `feedback-${toId(topic.topic)}`;
    const previous = {
      label: "Previous period",
      value: topic.trend.baselineMentions,
      context: topic.topic,
    };
    const current = {
      label: "Current period",
      value: topic.trend.currentMentions,
      context: topic.topic,
    };
    const points = [previous, current];
    const change = current.value - previous.value;
    const comparison = "Current period vs. previous period";
    const investigationContext: AnalyticsInvestigationContext | null =
      investigationContexts.find(
        (candidate) =>
          candidate.topic.name === topic.topic &&
          candidate.topic.change !== null,
      ) ?? null;

    metrics.push({
      id: metricId,
      surface: "feedback",
      label: `${topic.topic} mentions`,
      unit: "mentions",
      points,
      current,
      previous,
      change,
      changeType: "absolute",
      comparison,
      contextLabel: `${topic.sentiment} sentiment`,
    });

    if (
      change > 0 &&
      (topic.sentiment === "negative" || topic.sentiment === "mixed")
    ) {
      signals.push({
        id: `${metricId}-increase`,
        metricId,
        title: `${topic.topic} feedback increased`,
        direction: "increase",
        current: current.value,
        previous: previous.value,
        change,
        changeType: "absolute",
        unit: "mentions",
        comparison,
        contextLabel: `${topic.sentiment} sentiment`,
        investigationContext,
      });
    }
  }

  return { metrics, signals };
}

export function buildTrendRuntime({
  analyticsContext,
  activityEvidence,
}: BuildTrendRuntimeInput): TrendRuntime {
  const activityMetric = createActivityTrend(activityEvidence);
  const activitySignal = createActivitySignal(analyticsContext, activityEvidence);
  const retention = buildRetentionTrends(analyticsContext);
  const funnel = buildFunnelTrends(analyticsContext);
  const feedback = buildFeedbackTrends(analyticsContext);
  const metrics = [
    ...(activityMetric ? [activityMetric] : []),
    ...retention.metrics,
    ...funnel.metrics,
    ...feedback.metrics,
  ];
  const signals = [
    ...(activitySignal ? [activitySignal] : []),
    ...retention.signals,
    ...funnel.signals,
    ...feedback.signals,
  ];
  const unavailableEvidence = [
    ...(activityMetric ? [] : ["Activity trend evidence is unavailable."]),
    ...(retention.metrics.length > 0
      ? []
      : ["Comparable retention trend evidence is unavailable."]),
    ...(funnel.metrics.length > 0
      ? []
      : ["Comparable funnel version trend evidence is unavailable."]),
    ...(feedback.metrics.length > 0
      ? []
      : ["Comparable feedback topic trend evidence is unavailable."]),
  ];

  if (metrics.length === 0) {
    return {
      status: "unavailable",
      source: "uploaded-dataset",
      datasetId: analyticsContext.datasetId,
      reason: "The uploaded dataset does not contain supported trend evidence.",
      metrics: [],
      signals: [],
      unavailableEvidence,
    };
  }

  return {
    status: "available",
    source: "uploaded-dataset",
    datasetId: analyticsContext.datasetId,
    metrics,
    signals,
    unavailableEvidence,
  };
}
