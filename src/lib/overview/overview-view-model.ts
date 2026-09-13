import type {
  DatasetOverviewAnomaly,
  DatasetOverviewMetric,
  DatasetOverviewResult,
} from "./dataset-overview";
import {
  anomalies,
  overviewKpis,
  productTrend,
} from "../overview-mock-data";

export type KpiCardViewModel =
  | {
      status: "available";
      label: string;
      value: string;
      change: string | null;
      changeDirection: "positive" | "negative" | "neutral";
      comparison: string;
    }
  | {
      status: "unavailable";
      label: string;
      reason: string;
    };

export type ProductTrendPoint = {
  label: string;
  value: number;
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
  | {
      status: "unavailable";
      reason: string;
    };

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
};

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

function formatMetricChange(metric: DatasetOverviewMetric): string | null {
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
  metric: DatasetOverviewMetric,
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

function formatAnomalyChange(anomaly: DatasetOverviewAnomaly): string {
  if (anomaly.unit === "percentage") {
    return formatSigned(anomaly.change.absolute, " pp");
  }

  if (anomaly.change.relative !== null) {
    return formatSigned(anomaly.change.relative * 100, "%");
  }

  return formatSigned(anomaly.change.absolute, "");
}

function createDatasetAnomalyViewModel(
  anomaly: DatasetOverviewAnomaly,
): AnomalyCardViewModel {
  return {
    id: "dataset-primary-anomaly",
    severity: "MEDIUM",
    title: `${anomaly.metric} decline detected`,
    metricLabel: anomaly.metric,
    current: formatValue(anomaly.current, anomaly.unit),
    previous: formatValue(anomaly.previous, anomaly.unit),
    change: formatAnomalyChange(anomaly),
    evidenceSummary: anomaly.evidenceSummary,
    diagnosticAvailable: false,
    showInvestigationAction: false,
  };
}

function createDatasetTrend(
  datasetOverview: DatasetOverviewResult,
): ProductTrendViewModel {
  if (
    datasetOverview.dailyDau.status === "unavailable" ||
    datasetOverview.dailyDau.points.length === 0
  ) {
    return {
      status: "unavailable",
      reason:
        datasetOverview.dailyDau.status === "unavailable"
          ? datasetOverview.dailyDau.reason
          : "Daily DAU does not contain any observed dates.",
    };
  }

  const latestPoint = datasetOverview.dailyDau.points.at(-1)!;
  const dauMetric = datasetOverview.metrics.dau;
  const change = formatMetricChange(dauMetric);
  const changeValue =
    dauMetric.status === "available" && dauMetric.comparison
      ? dauMetric.comparison.absoluteChange
      : 0;

  return {
    status: "available",
    metricLabel: "Daily active users by observed date",
    latestValue: countFormatter.format(latestPoint.value),
    change: change ?? "No previous active date",
    changeDirection: change ? getChangeDirection(changeValue) : "neutral",
    data: datasetOverview.dailyDau.points.map((point) => ({
      label: point.date,
      value: point.value,
    })),
  };
}

function createDatasetViewModel(
  datasetOverview: DatasetOverviewResult,
  datasetName: string | null,
): OverviewViewModel {
  const primaryAnomaly = datasetOverview.primaryAnomaly;

  return {
    mode: "dataset",
    status: "ready",
    sourceLabel: "UPLOADED DATASET",
    datasetName,
    error: null,
    kpis: [
      createKpiViewModel(datasetOverview.metrics.dau),
      createKpiViewModel(datasetOverview.metrics.d1Retention),
      createKpiViewModel(datasetOverview.metrics.coreConversion),
      createKpiViewModel(datasetOverview.metrics.feedback),
    ],
    trend: createDatasetTrend(datasetOverview),
    anomalies: primaryAnomaly
      ? [createDatasetAnomalyViewModel(primaryAnomaly)]
      : [],
    anomalyTitle: "Dataset anomaly",
    anomalySummary: primaryAnomaly
      ? "1 deterministic signal detected"
      : "No anomaly detected",
  };
}

function createDemoViewModel(): OverviewViewModel {
  return {
    mode: "demo",
    status: "ready",
    sourceLabel: "DEMO DATA",
    datasetName: null,
    error: null,
    kpis: overviewKpis.map((kpi) => ({
      status: "available",
      label: kpi.label,
      value: kpi.value,
      change: kpi.change,
      changeDirection: kpi.changeDirection,
      comparison: kpi.comparison,
    })),
    trend: {
      status: "available",
      metricLabel: "Daily active users over the last 30 days",
      latestValue: "12.5k",
      change: "+8.2% vs. previous period",
      changeDirection: "positive",
      data: productTrend,
    },
    anomalies: anomalies.map((anomaly) => ({
      id: anomaly.id,
      severity: anomaly.severity,
      title: anomaly.title,
      metricLabel: null,
      current: anomaly.metric,
      previous: null,
      change: anomaly.change,
      evidenceSummary: anomaly.context,
      diagnosticAvailable: Boolean(anomaly.diagnosticAvailable),
      showInvestigationAction: true,
    })),
    anomalyTitle: "AI anomalies",
    anomalySummary: `${anomalies.length} signals worth investigating`,
  };
}

export function createOverviewViewModel({
  datasetOverview,
  overviewStatus,
  overviewError,
  datasetName,
}: {
  datasetOverview: DatasetOverviewResult | null;
  overviewStatus: "idle" | "loading" | "ready" | "error";
  overviewError: string | null;
  datasetName: string | null;
}): OverviewViewModel {
  if (overviewStatus === "ready" && datasetOverview) {
    return createDatasetViewModel(datasetOverview, datasetName);
  }

  if (overviewStatus === "loading") {
    return {
      mode: "dataset",
      status: "loading",
      sourceLabel: "UPLOADED DATASET",
      datasetName,
      error: null,
      kpis: [],
      trend: null,
      anomalies: [],
      anomalyTitle: "Dataset anomaly",
      anomalySummary: "",
    };
  }

  if (overviewStatus === "error") {
    return {
      mode: "dataset",
      status: "error",
      sourceLabel: "UPLOADED DATASET",
      datasetName,
      error: overviewError,
      kpis: [],
      trend: null,
      anomalies: [],
      anomalyTitle: "Dataset anomaly",
      anomalySummary: "",
    };
  }

  return createDemoViewModel();
}
