import "server-only";

import { parseInvestigationResult } from "@/lib/ai/output-schema";
import { createAnalyticsDiagnosticCase } from "@/lib/analytics/analytics-diagnostic-adapter";
import { buildFixtureDatasetAnalyticsContext } from "@/lib/analytics/dataset-context/dataset-analytics-context.fixtures";
import { buildDatasetFeedbackInvestigationContext } from "@/lib/analytics/dataset-feedback-investigation-adapter";
import { buildDatasetFunnelInvestigationContext } from "@/lib/analytics/dataset-funnel-investigation-adapter";
import { buildDatasetRetentionInvestigationContext } from "@/lib/analytics/dataset-retention-investigation-adapter";
import type { DiagnosticCase } from "@/lib/diagnostics/types";
import type { InvestigationResult } from "@/lib/investigations/types";
import {
  buildValidationPlan,
  getValidationPlanTemplate,
} from "@/lib/validations/mock-data";
import type { ActionablePMReview } from "@/lib/validations/types";

import { buildInvestigationReport } from "./investigation-report-builder";

function assertFixture(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Investigation report builder fixture failed: ${message}`);
  }
}

function createValidatedInvestigationResult(
  diagnosticCase: DiagnosticCase,
): InvestigationResult {
  const sourceSignals = [
    ...diagnosticCase.evidence.behaviorSignals.map((signal) => ({
      sourceType: "behavior-signal" as const,
      sourceId: signal.id,
      relevance: signal.finding,
    })),
    ...diagnosticCase.evidence.feedbackSignals.map((signal) => ({
      sourceType: "feedback-signal" as const,
      sourceId: signal.id,
      relevance: signal.finding,
    })),
  ];
  const evidenceUsed = sourceSignals.map((source, index) => ({
    id: `dataset-report-evidence-${index + 1}`,
    ...source,
  }));
  const evidenceReferenceIds = evidenceUsed.map((evidence) => evidence.id);
  const result = {
    id: "investigation-dataset-primary-anomaly-deepseek-v3",
    diagnosticCaseId: diagnosticCase.id,
    source: "mock" as const,
    status: "prototype-draft" as const,
    focus: {
      title: `Validate ${diagnosticCase.title}`,
      description:
        "Validate the measured primary signal using only the linked dataset evidence.",
    },
    summary: {
      text: diagnosticCase.summary.changed,
      evidenceReferenceIds,
    },
    evidenceUsed,
    possibleExplanations: [{
      id: "dataset-report-unmeasured-explanation",
      statement:
        "An unmeasured behavior may be associated with the observed signal.",
      qualification: "possible-not-confirmed" as const,
      evidenceRelationship: "context-only" as const,
      confidence: "low" as const,
      confidenceRationale:
        "The aggregate dataset evidence describes the signal but does not establish a cause.",
      evidenceReferenceIds,
      uncertainty: "Causal and independent segment evidence remains unavailable.",
    }],
    workingHypothesis: {
      id: `hypothesis-${diagnosticCase.metric.id}-report-fixture`,
      statement:
        "Further validation may identify where the measured signal is concentrated.",
      status: "unvalidated" as const,
      evidenceReferenceIds,
    },
    recommendedValidations: diagnosticCase.nextValidations.map(
      (validation, index) => ({
        validationId: validation.id,
        priority: index === 0 ? "primary" as const : "supporting" as const,
        rationale:
          "Use the existing validation direction without treating it as a confirmed solution.",
      }),
    ),
    limitations: [
      "Aggregate evidence does not establish causation.",
      ...(diagnosticCase.metric.id.startsWith("retention-")
        ? ["Retention comparison uses estimated time windows."]
        : []),
      ...(diagnosticCase.metric.id === "funnel-conversion"
        ? ["Funnel drop-off users are estimated."]
        : []),
      ...(diagnosticCase.metric.id === "feedback-topic-mentions"
        ? ["No related product signal is available."]
        : []),
    ],
  };

  return parseInvestigationResult(result, diagnosticCase);
}

function createValidationPlan(
  diagnosticCase: DiagnosticCase,
  investigationResult: InvestigationResult,
) {
  const selectedValidation = investigationResult.recommendedValidations[0];

  assertFixture(selectedValidation, "a recommended validation is required.");

  const template = getValidationPlanTemplate(
    diagnosticCase.id,
    selectedValidation.validationId,
  );

  assertFixture(template, "a matching validation template is required.");

  const review: ActionablePMReview = {
    id: `pm-review-${investigationResult.id}`,
    diagnosticCaseId: diagnosticCase.id,
    investigationResultId: investigationResult.id,
    sourceHypothesisId: investigationResult.workingHypothesis.id,
    refinedHypothesis: null,
    note: null,
    persistence: "session-only",
    decision: "use-as-working-hypothesis",
    selectedValidationId: selectedValidation.validationId,
    rejectionReason: null,
  };
  const plan = buildValidationPlan(
    review,
    template,
    diagnosticCase,
    investigationResult,
  );

  assertFixture(plan, "the ValidationPlan must be generated.");

  return plan;
}

export async function buildDatasetReportFixtureBundle() {
  const datasetContext = await buildFixtureDatasetAnalyticsContext();
  const analyticsContexts = {
    retention: buildDatasetRetentionInvestigationContext(datasetContext),
    funnel: buildDatasetFunnelInvestigationContext(datasetContext),
    feedback: buildDatasetFeedbackInvestigationContext(datasetContext),
  };
  const reports = Object.entries(analyticsContexts).map(([surface, context]) => {
    assertFixture(context, `${surface} AnalyticsInvestigationContext is required.`);

    const diagnosticCase = createAnalyticsDiagnosticCase(context);

    assertFixture(diagnosticCase, `${surface} DiagnosticCase is required.`);

    const investigationResult = createValidatedInvestigationResult(diagnosticCase);
    const validationPlan = createValidationPlan(
      diagnosticCase,
      investigationResult,
    );
    const incompleteReport = buildInvestigationReport({
      diagnosticCase,
      investigationCaseId: context.signalId,
      datasetIdentity: "fixture-dataset-identity",
      investigationResult,
      validationPlan,
      validationStatus: "running",
      investigationCreatedAt: "2026-09-16T08:00:00.000Z",
      validationCompletedAt: "2026-09-16T09:00:00.000Z",
      datasetAnalyticsContext: datasetContext,
    });

    assertFixture(
      incompleteReport === null,
      "a running validation must not create a Validated report.",
    );

    const report = buildInvestigationReport({
      diagnosticCase,
      investigationCaseId: context.signalId,
      datasetIdentity: "fixture-dataset-identity",
      investigationResult,
      validationPlan,
      validationStatus: "completed",
      investigationCreatedAt: "2026-09-16T08:00:00.000Z",
      validationCompletedAt: "2026-09-16T09:00:00.000Z",
      datasetAnalyticsContext: datasetContext,
    });

    assertFixture(report, `${surface} completed report is required.`);
    assertFixture(
      report.investigationCaseId === context.signalId,
      `${surface} report must retain its exact Investigation case identity.`,
    );

    return { surface, diagnosticCase, investigationResult, validationPlan, report };
  });

  return { datasetContext, reports };
}

export async function runInvestigationReportBuilderFixtures() {
  const bundle = await buildDatasetReportFixtureBundle();
  const retention = bundle.reports.find((item) => item.surface === "retention")?.report;
  const funnel = bundle.reports.find((item) => item.surface === "funnel")?.report;
  const feedback = bundle.reports.find((item) => item.surface === "feedback")?.report;

  assertFixture(
    new Set(bundle.reports.map((item) => item.report.id)).size ===
      bundle.reports.length,
    "each Dataset investigation signal must produce a distinct report id.",
  );

  assertFixture(
    retention?.supportingEvidence.some(
      (evidence) =>
        evidence.statement.includes("56.39%") &&
        evidence.statement.includes("56.65%") &&
        evidence.statement.includes("-0.26 pp") &&
        evidence.evidenceQuality === "estimated",
    ),
    "Retention report must preserve exact estimated current, baseline, and gap evidence.",
  );
  assertFixture(
    funnel?.supportingEvidence.some(
      (evidence) =>
        evidence.statement.includes("V3.2 58.84%") &&
        evidence.statement.includes("V3.1 70.20%") &&
        evidence.statement.includes("1,680"),
    ),
    "Funnel report must preserve exact version and drop-off evidence.",
  );
  assertFixture(
    feedback?.supportingEvidence.some(
      (evidence) =>
        evidence.statement.includes("Pricing") &&
        evidence.statement.includes("876") &&
        evidence.statement.includes("negative"),
    ) &&
      feedback.supportingEvidence.some((evidence) =>
        evidence.statement.includes("representative quote"),
      ) &&
      feedback.limitations?.some((limitation) =>
        limitation.includes("No related product signal"),
      ),
    "Feedback report must preserve topic, volume, sentiment, quote, and missing-signal limitations.",
  );

  return bundle.reports.map(({ surface, report }) => ({
    surface,
    reportId: report.id,
    source: report.source,
    status: report.status,
    evidenceCount: report.supportingEvidence.length,
    limitations: report.limitations,
  }));
}
