import type { DatasetAnalyticsContext } from "./dataset-context";
import type { AnalyticsActivityInvestigationContext } from "./investigation-context";
import type { OverviewRuntimeActivityEvidence } from "../overview/overview-runtime";

export function buildDatasetActivityInvestigationContext(
  analyticsContext: DatasetAnalyticsContext,
  activityEvidence: OverviewRuntimeActivityEvidence,
): AnalyticsActivityInvestigationContext | null {
  const anomaly = activityEvidence.anomaly;

  if (!anomaly || anomaly.metric !== "DAU") {
    return null;
  }

  return {
    surface: "activity",
    signalId: [
      "dataset",
      analyticsContext.datasetId,
      "activity",
      "dau",
      anomaly.period.current,
    ].join(":"),
    activity: {
      metric: "daily_active_users",
      currentValue: anomaly.current,
      baselineValue: anomaly.previous,
      gap: anomaly.change.absolute,
      currentPeriod: anomaly.period.current,
      previousPeriod: anomaly.period.previous,
      affectedUsers: Math.max(0, Math.round(anomaly.current)),
    },
    datasetEvidence: {
      datasetId: analyticsContext.datasetId,
      source: "uploaded-dataset",
      quality: "observed",
      method: "seven-day-average-dau-comparison",
      limitations: [
        "Activity evidence compares adjacent seven-day average DAU windows.",
        "The aggregate activity signal does not identify a causal product change.",
      ],
    },
  };
}
