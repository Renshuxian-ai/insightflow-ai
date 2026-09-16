import type { DatasetAnalyticsContext } from "@/lib/analytics/dataset-context";
import type { DatasetAnalyticsFieldBinding } from "@/lib/analytics/dataset-context/types";
import type { SemanticType } from "@/lib/datasets/semantic/types";
import type { TrendRuntime } from "@/lib/analytics/trend-runtime";
import type { DatasetAnalyticsRuntime } from "@/lib/analytics/analytics-runtime";

export type OverviewRuntimeMetricId =
  | "dau"
  | "d1-retention"
  | "core-conversion"
  | "feedback";

export type OverviewRuntimeMetricUnit = "users" | "percentage" | "rows";

export type OverviewRuntimeComparison = {
  previous: number;
  absoluteChange: number;
  relativeChange: number | null;
  currentPeriod: string;
  previousPeriod: string;
};

export type OverviewRuntimeMetric =
  | {
      status: "available";
      id: OverviewRuntimeMetricId;
      label: string;
      unit: OverviewRuntimeMetricUnit;
      current: number;
      currentPeriod: string;
      comparison: OverviewRuntimeComparison | null;
      comparisonUnavailableReason: string | null;
    }
  | {
      status: "unavailable";
      id: OverviewRuntimeMetricId;
      label: string;
      reason: string;
    };

export type OverviewRuntimeDailyDau =
  | {
      status: "available";
      points: Array<{ date: string; value: number }>;
    }
  | {
      status: "unavailable";
      reason: string;
    };

export type OverviewRuntimeAnomaly = {
  source: "dataset";
  metric: "D1 Retention" | "Core Conversion" | "DAU";
  unit: "percentage" | "users";
  current: number;
  previous: number;
  change: {
    absolute: number;
    relative: number | null;
  };
  period: {
    current: string;
    previous: string;
  };
  evidenceSummary: string;
};

export type OverviewRuntimeActivityEvidence = {
  rowCount: number;
  selectedSheetName: string | null;
  fields: {
    userIdentifier: DatasetAnalyticsFieldBinding | null;
    eventTimestamp: DatasetAnalyticsFieldBinding | null;
  };
  dau: OverviewRuntimeMetric;
  dailyDau: OverviewRuntimeDailyDau;
  anomaly: OverviewRuntimeAnomaly | null;
};

export type OverviewRuntimeFeedbackTopic = {
  name: string;
  mentionCount: number;
  sentiment: "positive" | "negative" | "neutral" | "mixed" | "unknown";
  changePercent: number | null;
};

export type OverviewRuntime = {
  version: 1;
  source: "dataset";
  rowCount: number;
  selectedSheetName: string | null;
  fieldBindings: Record<SemanticType, DatasetAnalyticsFieldBinding | null>;
  metrics: {
    dau: OverviewRuntimeMetric;
    d1Retention: OverviewRuntimeMetric;
    coreConversion: OverviewRuntimeMetric;
    feedback: OverviewRuntimeMetric;
  };
  dailyDau: OverviewRuntimeDailyDau;
  primaryAnomaly: OverviewRuntimeAnomaly | null;
  trends: TrendRuntime;
  analytics: DatasetAnalyticsRuntime;
  feedbackTopics:
    | { status: "available"; items: OverviewRuntimeFeedbackTopic[] }
    | { status: "unavailable"; reason: string };
  userSegments: {
    status: "unavailable";
    reason: string;
  };
};

export type BuildOverviewRuntimeInput = {
  analyticsContext: DatasetAnalyticsContext;
  activityEvidence: OverviewRuntimeActivityEvidence;
};
