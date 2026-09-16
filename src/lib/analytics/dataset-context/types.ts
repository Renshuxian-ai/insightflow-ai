import type { SemanticSchema } from "@/lib/datasets/semantic/types";
import type { ParsedDataset } from "@/lib/datasets/server/parsers/types";

export type DatasetAnalyticsSurface = "retention" | "funnel" | "feedback";

export type DatasetAnalyticsBuilderInput = {
  datasetId: string;
  dataset: ParsedDataset;
  semanticSchema: SemanticSchema;
};

export type DatasetAnalyticsFieldBinding = {
  stableFieldKey: string;
  originalName: string;
  fieldIndex: number;
};

export type DatasetRetentionIntervalEvidence = {
  day: number;
  interval: string;
  observedRows: number;
  users: number;
  retainedUsers: number;
  retentionRate: number;
};

export type DatasetRetentionWindowEvidence = {
  start: string;
  end: string;
  users: number;
  intervals: DatasetRetentionIntervalEvidence[];
};

export type DatasetRetentionCohortEvidence = {
  id: string;
  date: string;
  users: number;
  intervals: DatasetRetentionIntervalEvidence[];
};

export type DatasetRetentionBreakdownSegmentEvidence = {
  id: string;
  value: string;
  users: number;
  intervals: DatasetRetentionIntervalEvidence[];
};

export type DatasetRetentionBreakdownDimensionEvidence = {
  id: "platform" | "user-type";
  label: string;
  field: DatasetAnalyticsFieldBinding;
  segments: DatasetRetentionBreakdownSegmentEvidence[];
};

export type DatasetRetentionEvidence = {
  metric: "retention";
  fields: {
    retentionMetric: DatasetAnalyticsFieldBinding;
    retentionDay: DatasetAnalyticsFieldBinding;
    date: DatasetAnalyticsFieldBinding;
    userIdentifier: DatasetAnalyticsFieldBinding;
    cohortAnchor: DatasetAnalyticsFieldBinding | null;
    platform: DatasetAnalyticsFieldBinding | null;
    userType: DatasetAnalyticsFieldBinding | null;
  };
  dateRange: {
    start: string;
    end: string;
  };
  users: number;
  intervals: DatasetRetentionIntervalEvidence[];
  cohorts: DatasetRetentionCohortEvidence[] | null;
  breakdowns: DatasetRetentionBreakdownDimensionEvidence[] | null;
  comparison: {
    method: "latest-half-vs-previous-half";
    evidenceQuality: "estimated";
    baseline: DatasetRetentionWindowEvidence;
    current: DatasetRetentionWindowEvidence;
  } | null;
};

export type DatasetFunnelVersionEvidence = {
  version: string;
  observedRows: number;
  users: number;
  completionRate: number | null;
};

export type DatasetFunnelTransitionEvidence = {
  funnelName: string;
  fromStep: string;
  toStep: string;
  eventNames: string[];
  observedRows: number;
  users: number;
  completionRate: number | null;
  dropOffUsers: number | null;
  versions: DatasetFunnelVersionEvidence[];
};

export type DatasetFunnelEvidence = {
  fields: {
    funnelName: DatasetAnalyticsFieldBinding;
    eventName: DatasetAnalyticsFieldBinding;
    fromStep: DatasetAnalyticsFieldBinding;
    toStep: DatasetAnalyticsFieldBinding;
    userIdentifier: DatasetAnalyticsFieldBinding | null;
    completionRate: DatasetAnalyticsFieldBinding | null;
    version: DatasetAnalyticsFieldBinding | null;
  };
  transitions: DatasetFunnelTransitionEvidence[];
};

export type DatasetFeedbackSentiment =
  | "positive"
  | "negative"
  | "neutral"
  | "mixed"
  | "unknown";

export type DatasetFeedbackTopicEvidence = {
  topic: string;
  mentions: number;
  sentiment: DatasetFeedbackSentiment;
  sentimentCounts: Record<string, number>;
  quotes: string[];
  trend: {
    method: "latest-half-vs-previous-half";
    baselineMentions: number;
    currentMentions: number;
    changePercent: number;
  } | null;
};

export type DatasetFeedbackEvidence = {
  fields: {
    feedbackText: DatasetAnalyticsFieldBinding;
    feedbackTopic: DatasetAnalyticsFieldBinding;
    feedbackSentiment: DatasetAnalyticsFieldBinding;
    date: DatasetAnalyticsFieldBinding | null;
  };
  totalFeedback: number;
  topics: DatasetFeedbackTopicEvidence[];
};

export type DatasetAnalyticsContext = {
  datasetId: string;
  source: "uploaded-dataset";
  availableSurfaces: DatasetAnalyticsSurface[];
  retentionEvidence: DatasetRetentionEvidence | null;
  funnelEvidence: DatasetFunnelEvidence | null;
  feedbackEvidence: DatasetFeedbackEvidence | null;
};
