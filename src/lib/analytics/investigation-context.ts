export type AnalyticsInvestigationSurface =
  | "activity"
  | "retention"
  | "funnel"
  | "feedback";

export type AnalyticsRetentionInterval =
  | "D0"
  | "D1"
  | "D3"
  | "D7"
  | "D14"
  | "D30";

export type AnalyticsInvestigationTarget = {
  id: string;
  title: string;
  relatedSegment: string;
  sourceSurface: "retention";
};

export type AnalyticsDatasetEvidenceProvenance = {
  datasetId: string;
  source: "uploaded-dataset";
  quality: "observed" | "estimated" | "mixed";
  method: string;
  limitations: string[];
};

export type AnalyticsActivityInvestigationContext = {
  surface: "activity";
  signalId: string;
  activity: {
    metric: "daily_active_users";
    currentValue: number;
    baselineValue: number;
    gap: number;
    currentPeriod: string;
    previousPeriod: string;
    affectedUsers: number;
  };
  datasetEvidence?: AnalyticsDatasetEvidenceProvenance;
};

export type AnalyticsFunnelTransitionContextEvidence = {
  funnelName: string;
  fromStep: string;
  toStep: string;
  completionRate: number;
  dropOffUsers: number;
};

export type AnalyticsFunnelInvestigationContext = {
  surface: "funnel";
  signalId: string;
  funnelStepTransition: {
    from: {
      eventName: string;
      label: string;
    };
    to: {
      eventName: string;
      label: string;
    };
  };
  currentVersion: string;
  previousVersion: string;
  currentCompletionRate: number;
  baselineCompletionRate: number;
  gap: number;
  dropOffUsers: number;
  funnelName?: string;
  availableTransitions?: AnalyticsFunnelTransitionContextEvidence[];
  datasetEvidence?: AnalyticsDatasetEvidenceProvenance;
};

export type AnalyticsRetentionInvestigationContext = {
  surface: "retention";
  signalId: string;
  selectedCohort: {
    date: string;
    users: number;
  } | null;
  selectedInterval: AnalyticsRetentionInterval | null;
  segmentEvidence: {
    dimension: string;
    segment: string;
    users: number;
    retention: {
      D1: number;
      D7: number;
      D30: number;
    };
    comparisonSegment: string;
    comparisonRetention: {
      D1: number;
      D7: number;
      D30: number;
    };
  } | null;
  metricEvidence: {
    metric: "retention";
    event: string;
    returningEvent: string;
    period: string;
    window: string;
    intervals: Array<{
      interval: AnalyticsRetentionInterval;
      currentRate: number;
      currentRetainedUsers: number;
      baselineRate: number;
      baselineRetainedUsers: number;
      gapPercentagePoints: number;
    }>;
  };
  investigationTarget?: AnalyticsInvestigationTarget;
  datasetEvidence?: AnalyticsDatasetEvidenceProvenance;
};

export type AnalyticsFeedbackInvestigationContext = {
  surface: "feedback";
  signalId: string;
  topic: {
    name: string;
    mentions: number;
    change: number | null;
    sentiment: "negative" | "mixed";
    trendStatus?: "available" | "unavailable";
  };
  affectedSegment: string;
  evidenceQuotes: string[];
  relatedSignal: {
    name: string;
    change: number;
  } | null;
  datasetEvidence?: AnalyticsDatasetEvidenceProvenance;
};

export type AnalyticsInvestigationContext =
  | AnalyticsActivityInvestigationContext
  | AnalyticsRetentionInvestigationContext
  | AnalyticsFunnelInvestigationContext
  | AnalyticsFeedbackInvestigationContext;

export const ANALYTICS_INVESTIGATION_CONTEXT_QUERY_PARAM =
  "analyticsContext";

export type AnalyticsInvestigationHrefContext = AnalyticsInvestigationContext;

export function buildAnalyticsInvestigationHref(
  href: string,
  context: AnalyticsInvestigationHrefContext,
  options: { returnTo?: DiagnosticReturnPath } = {},
) {
  const query = new URLSearchParams({
    [ANALYTICS_INVESTIGATION_CONTEXT_QUERY_PARAM]: JSON.stringify(context),
  });
  const separator = href.includes("?") ? "&" : "?";

  const investigationHref = `${href}${separator}${query.toString()}`;

  return options.returnTo
    ? withDiagnosticReturnTo(investigationHref, options.returnTo)
    : investigationHref;
}
import {
  type DiagnosticReturnPath,
  withDiagnosticReturnTo,
} from "@/lib/diagnostics/diagnostic-navigation";
