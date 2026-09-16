import type {
  AnalyticsFeedbackInvestigationContext,
  AnalyticsFunnelInvestigationContext,
  AnalyticsRetentionInvestigationContext,
} from "./investigation-context";
import type {
  RetentionBreakdownDimensionPresentation,
  RetentionCohortPresentation,
  RetentionDiagnosisPresentation,
} from "./retention-presentation";

export type AnalyticsRuntimeUnavailable = {
  status: "unavailable";
  reason: string;
};

export type FunnelRuntimeTransition = {
  id: string;
  funnelName: string;
  fromStep: string;
  toStep: string;
  eventNames: string[];
  observedRows: number;
  users: number;
  completionRate: number;
  dropOffUsers: number;
  currentVersion: {
    name: string;
    users: number;
    completionRate: number;
  } | null;
  baselineVersion: {
    name: string;
    users: number;
    completionRate: number;
  } | null;
  gapPercentagePoints: number | null;
  investigationContext: AnalyticsFunnelInvestigationContext | null;
};

export type FunnelRuntime =
  | AnalyticsRuntimeUnavailable
  | {
      status: "available";
      source: "uploaded-dataset";
      datasetId: string;
      transitions: FunnelRuntimeTransition[];
      primaryTransitionId: string;
    };

export type RetentionRuntimeInterval = {
  day: number;
  label: string;
  currentRate: number;
  currentRetainedUsers: number;
  baselineRate: number;
  baselineRetainedUsers: number;
  gapPercentagePoints: number;
};

export type RetentionRuntime =
  | AnalyticsRuntimeUnavailable
  | {
      status: "available";
      source: "uploaded-dataset";
      datasetId: string;
      evidenceQuality: "estimated";
      definition: {
        metricField: string;
        retentionDayField: string;
        dateField: string;
        userIdentifierField: string;
        method: string;
      };
      currentWindow: { start: string; end: string; users: number };
      baselineWindow: { start: string; end: string; users: number };
      intervals: RetentionRuntimeInterval[];
      primaryInterval: string;
      cohorts: RetentionCohortPresentation[] | null;
      breakdowns: RetentionBreakdownDimensionPresentation[] | null;
      diagnosis: RetentionDiagnosisPresentation | null;
      investigationContext: AnalyticsRetentionInvestigationContext | null;
    };

export type FeedbackRuntimeTopic = {
  id: string;
  title: string;
  mentionCount: number;
  sentiment: "positive" | "negative" | "neutral" | "mixed" | "unknown";
  sentimentCounts: Record<string, number>;
  quotes: string[];
  trend: {
    baselineMentions: number;
    currentMentions: number;
    changePercent: number;
  } | null;
  investigationContext: AnalyticsFeedbackInvestigationContext | null;
};

export type FeedbackRuntime =
  | AnalyticsRuntimeUnavailable
  | {
      status: "available";
      source: "uploaded-dataset";
      datasetId: string;
      totalFeedback: number;
      negativeFeedbackRate: number | null;
      topics: FeedbackRuntimeTopic[];
    };

export type DatasetAnalyticsRuntime = {
  source: "uploaded-dataset";
  datasetId: string;
  funnel: FunnelRuntime;
  retention: RetentionRuntime;
  feedback: FeedbackRuntime;
};
