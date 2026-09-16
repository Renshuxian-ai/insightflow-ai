export type ProductReport = {
  id: string;
  datasetIdentity?: string;
  investigationCaseId?: string;
  investigationId?: string;
  validationPlanId?: string;
  title: string;
  source:
    | "Trends Analytics"
    | "Retention Analytics"
    | "Funnel Analytics"
    | "Feedback Intelligence";
  status: "Validated";
  createdAt: string;
  updatedAt: string;
  aiSummary: string;
  aiSummaryEvidenceReferenceIds?: string[];
  keyFindings: string[];
  keyFindingEvidenceReferences?: Array<{
    finding: string;
    evidenceReferenceIds: string[];
  }>;
  recommendedActions: Array<{
    priority: 1 | 2 | 3;
    title: string;
    description: string;
  }>;
  supportingEvidence: Array<{
    id: string;
    type: "Metric evidence" | "Funnel evidence" | "Feedback evidence";
    statement: string;
    label?: string;
    sourceType?: "metric" | "context" | "behavior-signal" | "feedback-signal";
    sourceId?: string;
    relevance?: string;
    provenance?: string;
    evidenceQuality?: "observed" | "estimated" | "derived";
    limitations?: string[];
  }>;
  limitations?: string[];
};

export const mockReports: ProductReport[] = [
  {
    id: "d1-retention-decline",
    title: "D1 Retention decline",
    source: "Retention Analytics",
    status: "Validated",
    createdAt: "2026-09-12",
    updatedAt: "2026-09-15",
    aiSummary:
      "New users experienced a 13 pp D1 retention decline. The largest observed gap is among Android users, while onboarding changes occurred in the same period.",
    keyFindings: [
      "D1 retention decreased from 51.4% to 38.4%.",
      "Android new users show the largest measured retention gap.",
      "Onboarding-related feedback increased during the same period.",
    ],
    recommendedActions: [
      {
        priority: 1,
        title: "Review onboarding Step2 completion flow",
        description:
          "Validate whether completion loss is concentrated at the Step2 transition for Android new users.",
      },
      {
        priority: 2,
        title: "Analyze Android user experience differences",
        description:
          "Compare onboarding behavior across Android and other platforms using consistent cohort filters.",
      },
      {
        priority: 3,
        title: "Collect additional onboarding feedback",
        description:
          "Gather more user evidence before treating onboarding friction as a confirmed explanation.",
      },
    ],
    supportingEvidence: [
      {
        id: "report-retention-metric",
        type: "Metric evidence",
        statement: "D1 retention dropped 13 pp against the validated baseline.",
      },
      {
        id: "report-onboarding-funnel",
        type: "Funnel evidence",
        statement: "Step3 completion decreased during the comparison period.",
      },
      {
        id: "report-onboarding-feedback",
        type: "Feedback evidence",
        statement: "Users reported uncertainty during onboarding.",
      },
    ],
  },
];

export function getMockReport(id: string) {
  return mockReports.find((report) => report.id === id) ?? null;
}
