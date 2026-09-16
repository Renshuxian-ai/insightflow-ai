import { overviewDemoRuntime } from "./overview-demo-runtime";
import type { AnalyticsInvestigationContext } from "@/lib/analytics/investigation-context";
import type { TrendRuntimeSignal } from "@/lib/analytics/trend-runtime";
import type {
  OverviewRuntime,
  OverviewRuntimeAnomaly,
  OverviewRuntimeFeedbackTopic,
  OverviewRuntimeMetric,
} from "./overview-runtime";

export type KpiCardViewModel =
  | {
      status: "available";
      label: string;
      value: string;
      change: string | null;
      changeDirection: "positive" | "negative" | "neutral";
      comparison: string;
    }
  | { status: "unavailable"; label: string; reason: string };

export type ProductTrendPoint = {
  label: string;
  value: number;
  date?: string;
};

export type ProductTrendViewModel =
  | {
      status: "available";
      metricLabel: string;
      latestValue: string;
      change: string;
      changeDirection: "positive" | "negative" | "neutral";
      data: ProductTrendPoint[];
    }
  | { status: "unavailable"; reason: string };

export type AnomalyCardViewModel = {
  id: string;
  severity: "HIGH" | "MEDIUM";
  title: string;
  metricLabel: string | null;
  current: string;
  previous: string | null;
  change: string;
  evidenceSummary: string;
  diagnosticAvailable: boolean;
  showInvestigationAction: boolean;
  investigationContext: AnalyticsInvestigationContext | null;
};

export type UserSegmentViewModel = {
  name: string;
  description: string;
  users: string;
  change: string;
  changeDirection: "positive" | "negative";
};

export type FeedbackTopicViewModel = {
  name: string;
  mentionCount: number;
  sentiment: "Negative" | "Mixed" | "Positive" | "Neutral" | "Unknown";
  change: string;
};

type OverviewCollectionViewModel<T> =
  | { status: "available"; items: T[] }
  | { status: "unavailable"; reason: string };

export type OverviewViewModel = {
  mode: "demo" | "dataset";
  status: "ready" | "loading" | "error";
  sourceLabel: string;
  datasetName: string | null;
  error: string | null;
  kpis: KpiCardViewModel[];
  trend: ProductTrendViewModel | null;
  anomalies: AnomalyCardViewModel[];
  anomalyTitle: string;
  anomalySummary: string;
  userSegments: OverviewCollectionViewModel<UserSegmentViewModel>;
  feedbackTopics: OverviewCollectionViewModel<FeedbackTopicViewModel>;
};

const countFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
});

function formatValue(
  value: number,
  unit: "users" | "percentage" | "rows",
): string {
  return unit === "percentage"
    ? `${value.toFixed(1)}%`
    : countFormatter.format(value);
}

function formatSigned(value: number, suffix: string): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}${suffix}`;
}

function getChangeDirection(
  value: number,
): "positive" | "negative" | "neutral" {
  return value > 0 ? "positive" : value < 0 ? "negative" : "neutral";
}

function formatMetricChange(metric: OverviewRuntimeMetric): string | null {
  if (metric.status === "unavailable" || !metric.comparison) {
    return null;
  }

  if (metric.unit === "percentage") {
    return formatSigned(metric.comparison.absoluteChange, " pp");
  }

  if (metric.comparison.relativeChange !== null) {
    return formatSigned(metric.comparison.relativeChange * 100, "%");
  }

  return formatSigned(metric.comparison.absoluteChange, "");
}

function createKpiViewModel(
  metric: OverviewRuntimeMetric,
): KpiCardViewModel {
  if (metric.status === "unavailable") {
    return {
      status: "unavailable",
      label: metric.label,
      reason: metric.reason,
    };
  }

  return {
    status: "available",
    label: metric.label,
    value: formatValue(metric.current, metric.unit),
    change: formatMetricChange(metric),
    changeDirection: metric.comparison
      ? getChangeDirection(metric.comparison.absoluteChange)
      : "neutral",
    comparison: metric.comparison
      ? `${metric.comparison.currentPeriod} vs. ${metric.comparison.previousPeriod}`
      : (metric.comparisonUnavailableReason ?? "No comparison available."),
  };
}

function formatAnomalyChange(anomaly: OverviewRuntimeAnomaly): string {
  if (anomaly.unit === "percentage") {
    return formatSigned(anomaly.change.absolute, " pp");
  }

  if (anomaly.change.relative !== null) {
    return formatSigned(anomaly.change.relative * 100, "%");
  }

  return formatSigned(anomaly.change.absolute, "");
}

function findDatasetAnomalySignal(
  runtime: OverviewRuntime,
  anomaly: OverviewRuntimeAnomaly,
): TrendRuntimeSignal | null {
  const signals = runtime.trends.signals;

  if (anomaly.metric === "D1 Retention") {
    return signals.find(
      (signal) =>
        signal.metricId === "retention-d1" &&
        signal.investigationContext?.surface === "retention" &&
        signal.investigationContext.selectedInterval === "D1",
    ) ?? null;
  }

  if (anomaly.metric === "DAU") {
    return signals.find(
      (signal) =>
        signal.metricId === "activity-dau" &&
        signal.investigationContext?.surface === "activity",
    ) ?? null;
  }

  return signals.find(
    (signal) =>
      signal.investigationContext?.surface === "funnel" &&
      Math.abs(signal.current - anomaly.current) < 0.001 &&
      Math.abs(signal.previous - anomaly.previous) < 0.001 &&
      Math.abs(signal.change - anomaly.change.absolute) < 0.001,
  ) ?? null;
}

function createDatasetAnomalyViewModel(
  runtime: OverviewRuntime,
  anomaly: OverviewRuntimeAnomaly,
): AnomalyCardViewModel {
  const investigationContext =
    findDatasetAnomalySignal(runtime, anomaly)?.investigationContext ?? null;

  return {
    id: investigationContext?.signalId ?? "dataset-anomaly-unavailable",
    severity: "MEDIUM",
    title: `${anomaly.metric} decline detected`,
    metricLabel: anomaly.metric,
    current: formatValue(anomaly.current, anomaly.unit),
    previous: formatValue(anomaly.previous, anomaly.unit),
    change: formatAnomalyChange(anomaly),
    evidenceSummary: anomaly.evidenceSummary,
    diagnosticAvailable: investigationContext !== null,
    showInvestigationAction: true,
    investigationContext,
  };
}

function createRuntimeTrend(runtime: OverviewRuntime): ProductTrendViewModel {
  if (
    runtime.dailyDau.status === "unavailable" ||
    runtime.dailyDau.points.length === 0
  ) {
    return {
      status: "unavailable",
      reason:
        runtime.dailyDau.status === "unavailable"
          ? runtime.dailyDau.reason
          : "Daily DAU does not contain any observed dates.",
    };
  }

  const latestPoint = runtime.dailyDau.points.at(-1)!;
  const change = formatMetricChange(runtime.metrics.dau);
  const changeValue =
    runtime.metrics.dau.status === "available" &&
    runtime.metrics.dau.comparison
      ? runtime.metrics.dau.comparison.absoluteChange
      : 0;

  return {
    status: "available",
    metricLabel: "Daily active users by observed date",
    latestValue: countFormatter.format(latestPoint.value),
    change: change ?? "No previous active date",
    changeDirection: change ? getChangeDirection(changeValue) : "neutral",
    data: runtime.dailyDau.points.map((point) => ({
      label: point.date.slice(5),
      value: point.value,
      date: point.date,
    })),
  };
}

function formatFeedbackSentiment(
  sentiment: OverviewRuntimeFeedbackTopic["sentiment"],
): FeedbackTopicViewModel["sentiment"] {
  return `${sentiment.charAt(0).toUpperCase()}${sentiment.slice(1)}` as FeedbackTopicViewModel["sentiment"];
}

function createDatasetViewModel(
  runtime: OverviewRuntime,
  datasetName: string | null,
): OverviewViewModel {
  const primaryAnomaly = runtime.primaryAnomaly;

  return {
    mode: "dataset",
    status: "ready",
    sourceLabel: "UPLOADED DATASET",
    datasetName,
    error: null,
    kpis: [
      createKpiViewModel(runtime.metrics.dau),
      createKpiViewModel(runtime.metrics.d1Retention),
      createKpiViewModel(runtime.metrics.coreConversion),
      createKpiViewModel(runtime.metrics.feedback),
    ],
    trend: createRuntimeTrend(runtime),
    anomalies: primaryAnomaly
      ? [createDatasetAnomalyViewModel(runtime, primaryAnomaly)]
      : [],
    anomalyTitle: "Dataset anomaly",
    anomalySummary: primaryAnomaly
      ? "1 deterministic signal detected"
      : "No anomaly detected",
    userSegments: runtime.userSegments,
    feedbackTopics:
      runtime.feedbackTopics.status === "available"
        ? {
            status: "available",
            items: runtime.feedbackTopics.items.map((topic) => ({
              name: topic.name,
              mentionCount: topic.mentionCount,
              sentiment: formatFeedbackSentiment(topic.sentiment),
              change:
                topic.changePercent === null
                  ? "No trend"
                  : formatSigned(topic.changePercent, "%"),
            })),
          }
        : runtime.feedbackTopics,
  };
}

function createDemoViewModel(): OverviewViewModel {
  return {
    mode: "demo",
    status: "ready",
    sourceLabel: "DEMO DATA",
    datasetName: null,
    error: null,
    kpis: overviewDemoRuntime.kpis.map((kpi) => ({
      status: "available",
      ...kpi,
    })),
    trend: { status: "available", ...overviewDemoRuntime.trend },
    anomalies: overviewDemoRuntime.anomalies.map((anomaly) => ({
      ...anomaly,
      metricLabel: null,
      previous: null,
      showInvestigationAction: true,
      investigationContext: null,
    })),
    anomalyTitle: "AI anomalies",
    anomalySummary: `${overviewDemoRuntime.anomalies.length} signals worth investigating`,
    userSegments: {
      status: "available",
      items: overviewDemoRuntime.userSegments,
    },
    feedbackTopics: {
      status: "available",
      items: overviewDemoRuntime.feedbackTopics,
    },
  };
}

function createPendingDatasetViewModel({
  status,
  datasetName,
  error,
}: {
  status: "loading" | "error";
  datasetName: string | null;
  error: string | null;
}): OverviewViewModel {
  const unavailable = {
    status: "unavailable" as const,
    reason: "Dataset analytics are not ready.",
  };

  return {
    mode: "dataset",
    status,
    sourceLabel: "UPLOADED DATASET",
    datasetName,
    error,
    kpis: [],
    trend: null,
    anomalies: [],
    anomalyTitle: "Dataset anomaly",
    anomalySummary: "",
    userSegments: unavailable,
    feedbackTopics: unavailable,
  };
}

export function createOverviewViewModel({
  overviewRuntime,
  overviewStatus,
  overviewError,
  datasetName,
  hasDataset,
}: {
  overviewRuntime: OverviewRuntime | null;
  overviewStatus: "idle" | "loading" | "ready" | "error";
  overviewError: string | null;
  datasetName: string | null;
  hasDataset: boolean;
}): OverviewViewModel {
  if (overviewStatus === "ready" && overviewRuntime) {
    return createDatasetViewModel(overviewRuntime, datasetName);
  }

  if (overviewStatus === "loading") {
    return createPendingDatasetViewModel({
      status: "loading",
      datasetName,
      error: null,
    });
  }

  if (overviewStatus === "error" || hasDataset) {
    return createPendingDatasetViewModel({
      status: "error",
      datasetName,
      error:
        overviewError ??
        "Confirm the dataset field understanding before preparing analytics.",
    });
  }

  return createDemoViewModel();
}
