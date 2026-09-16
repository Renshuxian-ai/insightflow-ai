import type { DiagnosticCase, DiagnosticMetric } from "./types";
import type {
  DatasetOverviewAnomaly,
  DatasetOverviewResult,
} from "../overview/dataset-overview";

export const DATASET_PRIMARY_ANOMALY_ID = "dataset-primary-anomaly";
export const DATASET_SIGNAL_DIAGNOSTIC_CASE_ID_PREFIX = "dataset-signal";

const DATASET_SIGNAL_FINGERPRINT_PATTERN =
  /^signal:(activity|retention|funnel|feedback):([a-f0-9]{24})$/;
const DATASET_SIGNAL_DIAGNOSTIC_CASE_ID_PATTERN =
  /^dataset-signal:(activity|retention|funnel|feedback):([a-f0-9]{24})$/;

export function buildDatasetSignalDiagnosticCaseId(
  signalFingerprint: string,
) {
  const match = DATASET_SIGNAL_FINGERPRINT_PATTERN.exec(signalFingerprint);

  if (!match) {
    throw new Error("Invalid Dataset signal fingerprint.");
  }

  return `${DATASET_SIGNAL_DIAGNOSTIC_CASE_ID_PREFIX}:${match[1]}:${match[2]}`;
}

export function isDatasetDiagnosticCaseId(value: unknown): value is string {
  return (
    value === DATASET_PRIMARY_ANOMALY_ID ||
    (typeof value === "string" &&
      DATASET_SIGNAL_DIAGNOSTIC_CASE_ID_PATTERN.test(value))
  );
}

const countFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
});

function formatMetricValue(
  value: number,
  unit: DatasetOverviewAnomaly["unit"],
): string {
  return unit === "percentage"
    ? `${value.toFixed(1)}%`
    : countFormatter.format(value);
}

function formatSigned(value: number, suffix: string): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}${suffix}`;
}

function getMetricId(
  metric: DatasetOverviewAnomaly["metric"],
): DiagnosticMetric["id"] {
  switch (metric) {
    case "D1 Retention":
      return "d1-retention";
    case "Core Conversion":
      return "core-conversion";
    case "DAU":
      return "dau";
  }
}

function createDiagnosticMetric(
  anomaly: DatasetOverviewAnomaly,
): DiagnosticMetric {
  return {
    id: getMetricId(anomaly.metric),
    label: anomaly.metric,
    currentValue: formatMetricValue(anomaly.current, anomaly.unit),
    previousValue: formatMetricValue(anomaly.previous, anomaly.unit),
    changeValue:
      anomaly.unit === "percentage"
        ? anomaly.change.absolute
        : (anomaly.change.relative ?? 0) * 100,
    changeType:
      anomaly.unit === "percentage"
        ? "percentage-points"
        : "relative-percent",
    comparison: `${anomaly.period.current} vs. ${anomaly.period.previous}`,
  };
}

export function createDatasetDiagnosticCase(
  datasetOverview: DatasetOverviewResult,
  datasetName: string | null,
): DiagnosticCase | null {
  const anomaly = datasetOverview.primaryAnomaly;

  if (!anomaly) {
    return null;
  }

  const metric = createDiagnosticMetric(anomaly);
  const evidenceId = "dataset-primary-anomaly-evidence";
  const sourceLabel = datasetName
    ? `Uploaded dataset · ${datasetName}`
    : "Uploaded dataset";
  const changeLabel =
    anomaly.unit === "percentage"
      ? formatSigned(anomaly.change.absolute, " pp")
      : formatSigned((anomaly.change.relative ?? 0) * 100, "%");

  return {
    id: DATASET_PRIMARY_ANOMALY_ID,
    source: "dataset",
    status: "ready",
    severity: "MEDIUM",
    title: `${anomaly.metric} decline detected`,
    metric,
    context: {
      dateRange: {
        id: "dataset-current-period",
        label: anomaly.period.current,
      },
      segment: { id: "dataset-not-segmented", label: "Not segmented" },
      platform: {
        id: "dataset-platform-not-segmented",
        label: "Not segmented",
      },
      version: {
        id: "dataset-version-not-segmented",
        label: "Not segmented",
      },
    },
    summary: {
      changed: anomaly.evidenceSummary,
      affected:
        "The result is calculated across the uploaded dataset; no affected segment has been identified.",
      started: `The deterministic comparison covers ${anomaly.period.current} against ${anomaly.period.previous}.`,
    },
    evidence: {
      behaviorSignals: [
        {
          id: evidenceId,
          label: anomaly.metric,
          value: `${metric.currentValue} · ${changeLabel}`,
          finding: anomaly.evidenceSummary,
          detail: `Compared ${anomaly.period.current} with ${anomaly.period.previous}.`,
          source: sourceLabel,
        },
      ],
      feedbackSignals: [],
    },
    reasoning: {
      observation: {
        statement: anomaly.evidenceSummary,
        evidenceIds: [evidenceId],
      },
      inference: {
        statement:
          "The deterministic period comparison supports that this metric decline is present in the uploaded dataset.",
        evidenceIds: [evidenceId],
        status: "Supported by aggregate evidence",
      },
      hypothesis: {
        statement:
          "The aggregate result does not identify a cause; segment, behavior, or qualitative analysis is needed before forming a causal hypothesis.",
        evidenceIds: [],
        status: "Cause not determined",
      },
    },
    traceSteps: [
      {
        id: "dataset-trace-period-comparison",
        label: `${anomaly.metric} periods compared`,
        description: `Calculated the metric for ${anomaly.period.current} and compared it with ${anomaly.period.previous}.`,
        status: "dataset-calculated",
        evidenceIds: [evidenceId],
      },
    ],
    nextValidations: [
      {
        id: "dataset-compare-segments",
        label: "Compare segments",
        description:
          "Break down the metric by available dimensions to locate where the decline is concentrated.",
      },
      {
        id: "dataset-review-behavior",
        label: "Review related behavior",
        description:
          "Inspect behavior around the affected period before proposing a cause.",
      },
    ],
  };
}
