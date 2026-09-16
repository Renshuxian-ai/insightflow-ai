import type { AnalyticsInvestigationContext } from "./investigation-context";

export type TrendRuntimeMetricUnit = "users" | "percentage" | "mentions";
export type TrendRuntimeChangeType =
  | "absolute"
  | "percentage-points"
  | "relative-percent";

export type TrendRuntimePoint = {
  label: string;
  value: number;
  context: string;
};

export type TrendRuntimeMetric = {
  id: string;
  surface: "activity" | "retention" | "funnel" | "feedback";
  label: string;
  unit: TrendRuntimeMetricUnit;
  points: TrendRuntimePoint[];
  current: TrendRuntimePoint;
  previous: TrendRuntimePoint | null;
  change: number | null;
  changeType: TrendRuntimeChangeType;
  comparison: string | null;
  contextLabel: string;
};

export type TrendRuntimeSignal = {
  id: string;
  metricId: string;
  title: string;
  direction: "decline" | "increase";
  current: number;
  previous: number;
  change: number;
  changeType: TrendRuntimeChangeType;
  unit: TrendRuntimeMetricUnit;
  comparison: string;
  contextLabel: string;
  investigationContext: AnalyticsInvestigationContext | null;
};

export type TrendRuntime =
  | {
      status: "available";
      source: "uploaded-dataset";
      datasetId: string;
      metrics: TrendRuntimeMetric[];
      signals: TrendRuntimeSignal[];
      unavailableEvidence: string[];
    }
  | {
      status: "unavailable";
      source: "uploaded-dataset";
      datasetId: string;
      reason: string;
      metrics: [];
      signals: [];
      unavailableEvidence: string[];
    };
