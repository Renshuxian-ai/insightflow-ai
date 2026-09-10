import type { DiagnosticCase } from "@/lib/diagnostics/types";
import type { InvestigationResult } from "@/lib/investigations/types";

import type {
  ActionablePMReview,
  ValidationPlan,
  ValidationPlanPurpose,
  ValidationPlanTemplate,
} from "./types";

const retentionCaseId = "new-user-d1-retention-drop";
const conversionCaseId = "core-conversion-decline";

export const validationPlanTemplates: ValidationPlanTemplate[] = [
  {
    id: "template-retention-inspect-funnel",
    diagnosticCaseId: retentionCaseId,
    nextValidationId: "inspect-funnel",
    objectives: {
      "hypothesis-validation":
        "Determine whether the onboarding transition decline persists after consistent cohort filters are applied.",
      "evidence-collection":
        "Collect a consistent funnel comparison before deciding whether onboarding friction should remain the working hypothesis.",
    },
    methodType: "funnel-review",
    requiredEvidence: [
      {
        id: "retention-onboarding-signal",
        description: "The linked Step 2 → Step 3 onboarding signal.",
        status: "available",
        evidenceReferenceIds: ["retention-onboarding"],
      },
      {
        id: "retention-filtered-funnel",
        description: "A previous-period funnel comparison using the same cohort filters.",
        status: "to-collect",
        evidenceReferenceIds: [],
      },
    ],
    checks: [
      {
        id: "retention-check-event-definitions",
        description: "Confirm that the onboarding events and cohort filters are comparable across periods.",
      },
      {
        id: "retention-check-transition",
        description: "Compare Step 2 → Step 3 completion for the selected cohort and baseline.",
      },
    ],
    evaluationCriteria: {
      supportsHypothesis:
        "The Step 2 → Step 3 deterioration remains concentrated in the affected cohort after consistent filters are applied.",
      weakensHypothesis:
        "The transition is stable after filtering, or the decline is distributed across unrelated journey steps and cohorts.",
    },
  },
  {
    id: "template-conversion-verify-events",
    diagnosticCaseId: conversionCaseId,
    nextValidationId: "verify-conversion-events",
    objectives: {
      "hypothesis-validation":
        "Rule out a measurement change before testing setup friction as an explanation for the conversion decline.",
      "evidence-collection":
        "Collect event-integrity evidence before deciding whether the setup-friction hypothesis is ready for validation.",
    },
    methodType: "event-quality-check",
    requiredEvidence: [
      {
        id: "conversion-metric-signal",
        description: "The linked Core Conversion metric signal.",
        status: "available",
        evidenceReferenceIds: ["conversion-metric"],
      },
      {
        id: "conversion-event-integrity",
        description: "Event schema and delivery checks for the selected release window.",
        status: "to-collect",
        evidenceReferenceIds: [],
      },
    ],
    checks: [
      {
        id: "conversion-check-event-schema",
        description: "Compare conversion event definitions before and after the selected release window.",
      },
      {
        id: "conversion-check-event-volume",
        description: "Check for missing, duplicated, or delayed events in the affected context.",
      },
    ],
    evaluationCriteria: {
      supportsHypothesis:
        "Event collection remains consistent, leaving the behavior and feedback pattern as a plausible path to validate.",
      weakensHypothesis:
        "A material event-definition or delivery change explains the measured conversion decline.",
    },
  },
];

export function getValidationPlanTemplates(
  diagnosticCaseId: string,
): ValidationPlanTemplate[] {
  return validationPlanTemplates.filter(
    (template) => template.diagnosticCaseId === diagnosticCaseId,
  );
}

export function getValidationPlanTemplate(
  diagnosticCaseId: string,
  nextValidationId: string,
): ValidationPlanTemplate | undefined {
  return validationPlanTemplates.find(
    (template) =>
      template.diagnosticCaseId === diagnosticCaseId &&
      template.nextValidationId === nextValidationId,
  );
}

export function buildValidationPlan(
  review: ActionablePMReview,
  template: ValidationPlanTemplate,
  diagnosticCase: DiagnosticCase,
  investigationResult: InvestigationResult,
): ValidationPlan | undefined {
  const isMatchingSource =
    review.diagnosticCaseId === diagnosticCase.id &&
    review.investigationResultId === investigationResult.id &&
    investigationResult.diagnosticCaseId === diagnosticCase.id &&
    review.sourceHypothesisId === investigationResult.workingHypothesis.id &&
    template.diagnosticCaseId === diagnosticCase.id &&
    template.nextValidationId === review.selectedValidationId &&
    diagnosticCase.nextValidations.some(
      (validation) => validation.id === template.nextValidationId,
    );

  if (!isMatchingSource) {
    return undefined;
  }

  const purpose: ValidationPlanPurpose =
    review.decision === "needs-more-evidence"
      ? "evidence-collection"
      : "hypothesis-validation";
  const originalHypothesis = investigationResult.workingHypothesis.statement;
  const refinedHypothesis = review.refinedHypothesis?.trim() || null;

  return {
    id: `validation-plan-${review.id}`,
    templateId: template.id,
    diagnosticCaseId: diagnosticCase.id,
    investigationResultId: investigationResult.id,
    pmReviewId: review.id,
    sourceValidationId: template.nextValidationId,
    source: "mock-template",
    persistence: "session-only",
    objective: template.objectives[purpose],
    purpose,
    hypothesisSnapshot: {
      sourceHypothesisId: investigationResult.workingHypothesis.id,
      originalStatement: originalHypothesis,
      workingStatement: refinedHypothesis ?? originalHypothesis,
      editedByPm:
        refinedHypothesis !== null && refinedHypothesis !== originalHypothesis,
      evidenceReferenceIds: [
        ...investigationResult.workingHypothesis.evidenceReferenceIds,
      ],
      epistemicStatus: "unvalidated",
    },
    method: {
      type: template.methodType,
      sourceValidationId: template.nextValidationId,
    },
    targetScope: {
      metricId: diagnosticCase.metric.id,
      contextIds: Object.values(diagnosticCase.context).map(
        (contextItem) => contextItem.id,
      ),
    },
    requiredEvidence: template.requiredEvidence.map((requirement) => ({
      ...requirement,
      evidenceReferenceIds: [...requirement.evidenceReferenceIds],
    })),
    checks: template.checks.map((check) => ({ ...check })),
    evaluationCriteria: { ...template.evaluationCriteria },
    status: "draft",
    executionStatus: "not-run",
  };
}
