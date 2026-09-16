import { ANALYTICS_DIAGNOSTIC_HREF } from "@/lib/analytics/demo-analytics";
import { buildFeedbackInvestigationContext } from "@/lib/analytics/feedback-investigation-adapter";
import { buildAnalyticsInvestigationHref } from "@/lib/analytics/investigation-context";
import { withDiagnosticReturnTo } from "@/lib/diagnostics/diagnostic-navigation";
import { feedbackTopics } from "@/lib/feedback/mock-feedback-data";

export type InvestigationSource =
  | "Trends Analytics"
  | "Retention Analytics"
  | "Funnel Analytics"
  | "Feedback Intelligence";

export type InvestigationStatus =
  | "Investigating"
  | "Validation ready"
  | "Validated";

export type MockInvestigation = {
  id: string;
  title: string;
  source: InvestigationSource;
  status: InvestigationStatus;
  evidenceSummary: string[];
  updatedAt: string;
  href: string;
  createdAt?: string;
  aiFinding?: string;
  reportHref?: string;
};

const searchRelevanceTopic = feedbackTopics.find(
  (topic) => topic.id === "search-relevance",
);

if (!searchRelevanceTopic) {
  throw new Error("Search relevance feedback topic is required.");
}

const funnelInvestigationHref = buildAnalyticsInvestigationHref(
  ANALYTICS_DIAGNOSTIC_HREF,
  {
    surface: "funnel",
    signalId: "funnel:v3-2:complete-step2:complete-step3",
    funnelStepTransition: {
      from: {
        eventName: "complete_step2",
        label: "Complete Step2",
      },
      to: {
        eventName: "complete_step3",
        label: "Complete Step3",
      },
    },
    currentVersion: "V3.2",
    previousVersion: "V3.1",
    currentCompletionRate: 32.5,
    baselineCompletionRate: 100,
    gap: -67.5,
    dropOffUsers: 27,
  },
  { returnTo: "/investigations" },
);

const feedbackInvestigationHref = buildAnalyticsInvestigationHref(
  ANALYTICS_DIAGNOSTIC_HREF,
  buildFeedbackInvestigationContext(searchRelevanceTopic),
  { returnTo: "/investigations" },
);

export const mockInvestigations: MockInvestigation[] = [
  {
    id: "d1-retention-decline",
    title: "D1 Retention decline",
    source: "Retention Analytics",
    status: "Validated",
    evidenceSummary: [
      "D1 retention is 13.0 pp below baseline",
      "New users are the affected cohort",
    ],
    updatedAt: "2026-09-15",
    href: withDiagnosticReturnTo(
      "/ai-diagnostics/new-user-d1-retention-drop",
      "/investigations",
    ),
  },
  {
    id: "complete-step3-dropoff",
    title: "Complete Step3 drop-off",
    source: "Funnel Analytics",
    status: "Validation ready",
    evidenceSummary: [
      "27 users lost at the largest transition",
      "Completion is 67.5 pp below the previous version",
    ],
    updatedAt: "2026-09-15",
    href: funnelInvestigationHref,
  },
  {
    id: "search-relevance-issue",
    title: "Search relevance issue",
    source: "Feedback Intelligence",
    status: "Investigating",
    evidenceSummary: [
      "38 feedback mentions",
      "Search-heavy teams affected",
    ],
    updatedAt: "2026-09-15",
    href: feedbackInvestigationHref,
  },
];
