import { createAnalyticsDiagnosticCase } from "@/lib/analytics/analytics-diagnostic-adapter";
import type {
  AnalyticsActivityInvestigationContext,
  AnalyticsFeedbackInvestigationContext,
  AnalyticsFunnelInvestigationContext,
  AnalyticsRetentionInvestigationContext,
} from "@/lib/analytics/investigation-context";
import {
  buildDatasetSignalDiagnosticCaseId,
} from "@/lib/diagnostics/dataset-diagnostic-case";
import { coreConversionDiagnosticCase } from "@/lib/diagnostics/fixtures/core-conversion";
import { createDemoDatasetDiagnosticCase } from "@/lib/diagnostics/demo-dataset/evidence-generator";
import type { DemoDiagnosticDataset } from "@/lib/diagnostics/demo-dataset/types";
import type { DiagnosticCase } from "@/lib/diagnostics/types";
import type { InvestigationResult } from "@/lib/investigations/types";

import type { ActionablePMReview } from "./types";
import {
  buildValidationPlan,
  getValidationPlanTemplate,
} from "./mock-data";

const requiredReachableValidationIds = [
  "dataset-compare-release-versions",
  "dataset-review-onboarding-step",
  "dataset-review-linked-feedback",
  "inspect-step-transition",
  "compare-versions",
  "validate-setup-hypothesis",
  "feedback-product-signal-review",
] as const;

function assertFixture(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Validation plan coverage fixture failed: ${message}`);
  }
}

function requireDiagnosticCase(
  value: DiagnosticCase | null,
  label: string,
): DiagnosticCase {
  assertFixture(value, `${label} must produce a DiagnosticCase.`);
  return value;
}

const datasetEvidence = {
  datasetId: "validation-plan-coverage",
  source: "uploaded-dataset" as const,
  quality: "observed" as const,
  method: "coverage-fixture",
  limitations: ["Fixture evidence only."],
};

const demoDataset: DemoDiagnosticDataset = {
  users: [
    {
      userId: "current-1",
      platform: "Android",
      version: "V3.2",
      country: "US",
      channel: "Organic",
      userType: "New User",
    },
    {
      userId: "current-2",
      platform: "Android",
      version: "V3.2",
      country: "US",
      channel: "Organic",
      userType: "New User",
    },
    {
      userId: "previous-1",
      platform: "Android",
      version: "V3.1",
      country: "US",
      channel: "Organic",
      userType: "New User",
    },
    {
      userId: "previous-2",
      platform: "Android",
      version: "V3.1",
      country: "US",
      channel: "Organic",
      userType: "New User",
    },
  ],
  events: [
    {
      userId: "current-1",
      eventName: "view_onboarding",
      timestamp: "2026-08-01T00:00:00.000Z",
      platform: "Android",
      version: "V3.2",
    },
    {
      userId: "current-2",
      eventName: "view_onboarding",
      timestamp: "2026-08-01T00:01:00.000Z",
      platform: "Android",
      version: "V3.2",
    },
    {
      userId: "current-1",
      eventName: "complete_step1",
      timestamp: "2026-08-01T00:02:00.000Z",
      platform: "Android",
      version: "V3.2",
    },
    {
      userId: "previous-1",
      eventName: "view_onboarding",
      timestamp: "2026-07-01T00:00:00.000Z",
      platform: "Android",
      version: "V3.1",
    },
    {
      userId: "previous-2",
      eventName: "view_onboarding",
      timestamp: "2026-07-01T00:01:00.000Z",
      platform: "Android",
      version: "V3.1",
    },
    {
      userId: "previous-1",
      eventName: "complete_step1",
      timestamp: "2026-07-01T00:02:00.000Z",
      platform: "Android",
      version: "V3.1",
    },
    {
      userId: "previous-2",
      eventName: "complete_step1",
      timestamp: "2026-07-01T00:03:00.000Z",
      platform: "Android",
      version: "V3.1",
    },
  ],
  metrics: [
    {
      date: "2026-07-01",
      metricName: "D1 Retention",
      segment: "All Users",
      value: 50,
    },
    {
      date: "2026-08-01",
      metricName: "D1 Retention",
      segment: "All Users",
      value: 35,
    },
    {
      date: "2026-08-01",
      metricName: "Onboarding Step3 Completion",
      segment: "Android V3.2",
      value: 40,
    },
    {
      date: "2026-07-01",
      metricName: "Onboarding Step3 Completion",
      segment: "Android V3.1",
      value: 80,
    },
  ],
  feedback: [
    {
      feedbackId: "feedback-current-1",
      userId: "current-1",
      category: "Onboarding",
      sentiment: "Negative",
      text: "The onboarding step was unclear.",
    },
  ],
  releases: [
    {
      version: "V3.1",
      releaseDate: "2026-06-15",
      change: "Previous onboarding flow",
    },
    {
      version: "V3.2",
      releaseDate: "2026-07-15",
      change: "Updated onboarding flow",
    },
  ],
};

const activityContext: AnalyticsActivityInvestigationContext = {
  surface: "activity",
  signalId: "coverage-activity",
  activity: {
    metric: "daily_active_users",
    currentValue: 80,
    baselineValue: 100,
    gap: -20,
    currentPeriod: "2026-08-01 to 2026-08-07",
    previousPeriod: "2026-07-25 to 2026-07-31",
    affectedUsers: 80,
  },
  datasetEvidence,
};

const retentionContext: AnalyticsRetentionInvestigationContext = {
  surface: "retention",
  signalId: "coverage-retention",
  selectedCohort: { date: "2026-08-01", users: 100 },
  selectedInterval: "D7",
  segmentEvidence: {
    dimension: "plan",
    segment: "Free",
    users: 60,
    retention: { D1: 40, D7: 20, D30: 10 },
    comparisonSegment: "Pro",
    comparisonRetention: { D1: 55, D7: 35, D30: 20 },
  },
  metricEvidence: {
    metric: "retention",
    event: "signup",
    returningEvent: "active",
    period: "2026-08",
    window: "Current cohort vs. baseline",
    intervals: [
      {
        interval: "D1",
        currentRate: 40,
        currentRetainedUsers: 40,
        baselineRate: 55,
        baselineRetainedUsers: 55,
        gapPercentagePoints: -15,
      },
      {
        interval: "D7",
        currentRate: 20,
        currentRetainedUsers: 20,
        baselineRate: 35,
        baselineRetainedUsers: 35,
        gapPercentagePoints: -15,
      },
      {
        interval: "D30",
        currentRate: 10,
        currentRetainedUsers: 10,
        baselineRate: 20,
        baselineRetainedUsers: 20,
        gapPercentagePoints: -10,
      },
    ],
  },
  datasetEvidence,
};

const funnelContext: AnalyticsFunnelInvestigationContext = {
  surface: "funnel",
  signalId: "coverage-funnel",
  funnelStepTransition: {
    from: { eventName: "complete_step2", label: "Complete Step 2" },
    to: { eventName: "complete_step3", label: "Complete Step 3" },
  },
  currentVersion: "V3.2",
  previousVersion: "V3.1",
  currentCompletionRate: 40,
  baselineCompletionRate: 70,
  gap: -30,
  dropOffUsers: 30,
  datasetEvidence,
};

const unlinkedFeedbackContext: AnalyticsFeedbackInvestigationContext = {
  surface: "feedback",
  signalId: "coverage-feedback-unlinked",
  topic: {
    name: "Onboarding clarity",
    mentions: 20,
    change: 25,
    sentiment: "negative",
  },
  affectedSegment: "All feedback contributors",
  evidenceQuotes: ["The onboarding step was unclear."],
  relatedSignal: null,
  datasetEvidence,
};

const linkedFeedbackContext: AnalyticsFeedbackInvestigationContext = {
  ...unlinkedFeedbackContext,
  signalId: "coverage-feedback-linked",
  relatedSignal: {
    name: "D1 Retention",
    change: -15,
  },
  datasetEvidence: undefined,
};

function createDatasetCase(
  label: string,
  fingerprint: `signal:${"activity" | "retention" | "funnel" | "feedback"}:${string}`,
  context:
    | AnalyticsActivityInvestigationContext
    | AnalyticsRetentionInvestigationContext
    | AnalyticsFunnelInvestigationContext
    | AnalyticsFeedbackInvestigationContext,
): DiagnosticCase {
  return requireDiagnosticCase(
    createAnalyticsDiagnosticCase(context, {
      diagnosticCaseId: buildDatasetSignalDiagnosticCaseId(fingerprint),
    }),
    label,
  );
}

function createInvestigationResult(
  diagnosticCase: DiagnosticCase,
): InvestigationResult {
  const evidenceId = `coverage-evidence-${diagnosticCase.id}`;

  return {
    id: `coverage-investigation-${diagnosticCase.id}`,
    diagnosticCaseId: diagnosticCase.id,
    source: "mock",
    status: "prototype-draft",
    focus: {
      title: "Validation plan coverage",
      description: "Fixture-only investigation result.",
    },
    summary: {
      text: "The fixture preserves one evidence reference for plan generation.",
      evidenceReferenceIds: [evidenceId],
    },
    evidenceUsed: [
      {
        id: evidenceId,
        sourceType: "metric",
        sourceId: diagnosticCase.metric.id,
        relevance: "Provides the metric anchor for this coverage fixture.",
      },
    ],
    possibleExplanations: [
      {
        id: `coverage-explanation-${diagnosticCase.id}`,
        statement: "The observed difference requires validation.",
        qualification: "possible-not-confirmed",
        evidenceRelationship: "context-only",
        confidence: "low",
        confidenceRationale: "The fixture does not establish a cause.",
        evidenceReferenceIds: [evidenceId],
        uncertainty: "The underlying driver is not established.",
      },
    ],
    workingHypothesis: {
      id: `coverage-hypothesis-${diagnosticCase.id}`,
      statement: "The selected recommendation should produce a reviewable validation plan.",
      status: "unvalidated",
      evidenceReferenceIds: [evidenceId],
    },
    recommendedValidations: diagnosticCase.nextValidations.map(
      (validation, index) => ({
        validationId: validation.id,
        priority: index === 0 ? "primary" : "supporting",
        rationale: "Coverage fixture recommendation.",
      }),
    ),
    limitations: ["Fixture-only evidence."],
  };
}

export function runValidationPlanCoverageFixtures() {
  const demoDiagnosticCase = createDemoDatasetDiagnosticCase(demoDataset);
  const activityDiagnosticCase = createDatasetCase(
    "Dataset Activity",
    "signal:activity:111111111111111111111111",
    activityContext,
  );
  const retentionDiagnosticCase = createDatasetCase(
    "Dataset Retention",
    "signal:retention:222222222222222222222222",
    retentionContext,
  );
  const funnelDiagnosticCase = createDatasetCase(
    "Dataset Funnel",
    "signal:funnel:333333333333333333333333",
    funnelContext,
  );
  const unlinkedFeedbackDiagnosticCase = createDatasetCase(
    "Dataset Feedback",
    "signal:feedback:444444444444444444444444",
    unlinkedFeedbackContext,
  );
  const linkedFeedbackDiagnosticCase = requireDiagnosticCase(
    createAnalyticsDiagnosticCase(linkedFeedbackContext),
    "Demo Feedback",
  );
  const productionCases = [
    ["Demo primary diagnostic", demoDiagnosticCase],
    ["Core Conversion", coreConversionDiagnosticCase],
    ["Dataset Activity", activityDiagnosticCase],
    ["Dataset Retention", retentionDiagnosticCase],
    ["Dataset Funnel", funnelDiagnosticCase],
    ["Dataset Feedback", unlinkedFeedbackDiagnosticCase],
    ["Demo Feedback", linkedFeedbackDiagnosticCase],
  ] as const;

  const coveredRecommendations = productionCases.flatMap(
    ([caseLabel, diagnosticCase]) =>
      diagnosticCase.nextValidations.map((validation) => {
        const template = getValidationPlanTemplate(
          diagnosticCase.id,
          validation.id,
        );

        assertFixture(
          template,
          `${caseLabel} recommendation ${validation.id} is missing a template.`,
        );

        return `${caseLabel}:${validation.id}`;
      }),
  );

  const requiredCasesByValidationId: Record<
    (typeof requiredReachableValidationIds)[number],
    DiagnosticCase
  > = {
    "dataset-compare-release-versions": demoDiagnosticCase,
    "dataset-review-onboarding-step": demoDiagnosticCase,
    "dataset-review-linked-feedback": demoDiagnosticCase,
    "inspect-step-transition": coreConversionDiagnosticCase,
    "compare-versions": coreConversionDiagnosticCase,
    "validate-setup-hypothesis": coreConversionDiagnosticCase,
    "feedback-product-signal-review": unlinkedFeedbackDiagnosticCase,
  };

  const generatedPlans = requiredReachableValidationIds.map((validationId) => {
    const diagnosticCase = requiredCasesByValidationId[validationId];
    const investigationResult = createInvestigationResult(diagnosticCase);
    const template = getValidationPlanTemplate(
      diagnosticCase.id,
      validationId,
    );

    assertFixture(template, `${validationId} must resolve to a template.`);

    const review: ActionablePMReview = {
      id: `coverage-review-${validationId}`,
      diagnosticCaseId: diagnosticCase.id,
      investigationResultId: investigationResult.id,
      sourceHypothesisId: investigationResult.workingHypothesis.id,
      refinedHypothesis: null,
      note: null,
      decision: "use-as-working-hypothesis",
      selectedValidationId: validationId,
      rejectionReason: null,
      persistence: "session-only",
    };
    const plan = buildValidationPlan(
      review,
      template,
      diagnosticCase,
      investigationResult,
    );

    assertFixture(plan, `${validationId} must build a ValidationPlan.`);

    return `${validationId}:${plan.templateId}:${plan.method.type}`;
  });

  // The legacy new-user-d1-retention-drop mock is intentionally excluded.
  // Its page route is replaced by createDemoDatasetDiagnosticCase before the
  // production Investigation UI is rendered.
  return {
    coveredRecommendations,
    generatedPlans,
  };
}
