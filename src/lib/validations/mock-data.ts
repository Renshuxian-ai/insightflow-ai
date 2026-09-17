import type { DiagnosticCase } from "@/lib/diagnostics/types";
import {
  DATASET_PRIMARY_ANOMALY_ID,
  isDatasetDiagnosticCaseId,
} from "@/lib/diagnostics/dataset-diagnostic-case";
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
  {
    id: "template-conversion-inspect-step-transition",
    diagnosticCaseId: conversionCaseId,
    nextValidationId: "inspect-step-transition",
    objectives: {
      "hypothesis-validation":
        "Determine whether the Step 2 to Step 3 decline remains concentrated after comparing consistent dates and connector types.",
      "evidence-collection":
        "Collect a matched Step 2 to Step 3 comparison across dates and connector types.",
    },
    methodType: "funnel-review",
    requiredEvidence: [
      {
        id: "conversion-step-transition-comparison",
        description:
          "Matched Step 2 and Step 3 completion evidence by date and connector type.",
        status: "to-collect",
        evidenceReferenceIds: [],
      },
    ],
    checks: [
      {
        id: "conversion-step-transition-definitions",
        description:
          "Confirm that Step 2, Step 3, eligibility, and completion-window definitions are consistent.",
      },
      {
        id: "conversion-step-transition-concentration",
        description:
          "Compare completion by date and connector type to locate where the transition decline is concentrated.",
      },
    ],
    evaluationCriteria: {
      supportsHypothesis:
        "The Step 2 to Step 3 decline remains concentrated in the affected context under consistent funnel definitions.",
      weakensHypothesis:
        "The transition is stable after matching dates and connector types, or the decline is distributed across other steps.",
    },
  },
  {
    id: "template-conversion-compare-versions",
    diagnosticCaseId: conversionCaseId,
    nextValidationId: "compare-versions",
    objectives: {
      "hypothesis-validation":
        "Determine whether the conversion decline remains associated with V3.2 after matching acquisition channel and workspace size.",
      "evidence-collection":
        "Collect a matched V3.1 and V3.2 conversion comparison.",
    },
    methodType: "cohort-comparison",
    requiredEvidence: [
      {
        id: "conversion-version-comparison",
        description:
          "Matched conversion evidence for V3.1 and V3.2 by acquisition channel and workspace size.",
        status: "to-collect",
        evidenceReferenceIds: [],
      },
    ],
    checks: [
      {
        id: "conversion-version-cohort-definitions",
        description:
          "Confirm that the compared version cohorts use consistent eligibility and conversion definitions.",
      },
      {
        id: "conversion-version-difference",
        description:
          "Compare conversion and Step 2 to Step 3 completion between matched V3.1 and V3.2 cohorts.",
      },
    ],
    evaluationCriteria: {
      supportsHypothesis:
        "The conversion and transition gaps remain materially worse for V3.2 after matching the cohorts.",
      weakensHypothesis:
        "The version gap disappears after matching acquisition channel, workspace size, and eligibility rules.",
    },
  },
  {
    id: "template-conversion-validate-setup-hypothesis",
    diagnosticCaseId: conversionCaseId,
    nextValidationId: "validate-setup-hypothesis",
    objectives: {
      "hypothesis-validation":
        "Test whether permission uncertainty or lost setup progress is observable during data-source connection.",
      "evidence-collection":
        "Collect focused usability and linked feedback evidence for the setup-friction hypothesis.",
    },
    methodType: "usability-review",
    requiredEvidence: [
      {
        id: "conversion-setup-usability-evidence",
        description:
          "Observed setup attempts and linked feedback covering permission context and progress preservation.",
        status: "to-collect",
        evidenceReferenceIds: [],
      },
    ],
    checks: [
      {
        id: "conversion-setup-task-definition",
        description:
          "Use a consistent data-source connection task and record where participants hesitate or abandon setup.",
      },
      {
        id: "conversion-setup-feedback-alignment",
        description:
          "Compare observed friction with the linked permission and lost-progress feedback themes.",
      },
    ],
    evaluationCriteria: {
      supportsHypothesis:
        "Repeated permission uncertainty or lost progress appears at the same setup transition described by the linked feedback.",
      weakensHypothesis:
        "Participants complete the transition without the proposed friction, or observed issues do not align with the linked feedback.",
    },
  },
  {
    id: "template-analytics-retention-onboarding-funnel",
    diagnosticCaseId: DATASET_PRIMARY_ANOMALY_ID,
    nextValidationId: "analytics-compare-onboarding-funnel",
    objectives: {
      "hypothesis-validation":
        "Compare onboarding completion and drop-off for the primary retention segment against its baseline.",
      "evidence-collection":
        "Collect a matched onboarding funnel comparison for the primary retention segment and baseline.",
    },
    methodType: "funnel-review",
    requiredEvidence: [
      {
        id: "analytics-retention-onboarding-comparison",
        description:
          "A matched onboarding completion and drop-off comparison for the selected segment and baseline.",
        status: "to-collect",
        evidenceReferenceIds: [],
      },
    ],
    checks: [
      {
        id: "analytics-retention-check-onboarding-filters",
        description:
          "Confirm that the segment, cohort window, and onboarding event definitions are comparable.",
      },
      {
        id: "analytics-retention-check-onboarding-dropoff",
        description:
          "Compare onboarding completion and step-level drop-off for the selected segment and baseline.",
      },
    ],
    evaluationCriteria: {
      supportsHypothesis:
        "A material onboarding completion gap is concentrated in the segment with the primary retention signal.",
      weakensHypothesis:
        "Onboarding completion is comparable after applying consistent segment and cohort filters.",
    },
  },
  {
    id: "template-dataset-compare-release-versions",
    diagnosticCaseId: DATASET_PRIMARY_ANOMALY_ID,
    nextValidationId: "dataset-compare-release-versions",
    objectives: {
      "hypothesis-validation":
        "Determine whether the retention and onboarding gaps remain concentrated in the current release after matching comparable users.",
      "evidence-collection":
        "Collect a matched retention and onboarding comparison for the current and previous releases.",
    },
    methodType: "cohort-comparison",
    requiredEvidence: [
      {
        id: "dataset-release-version-comparison",
        description:
          "Matched retention, onboarding completion, and user-count evidence for the current and previous releases.",
        status: "to-collect",
        evidenceReferenceIds: [],
      },
    ],
    checks: [
      {
        id: "dataset-release-version-filters",
        description:
          "Confirm that release cohorts use consistent platform, user, eligibility, and observation-window definitions.",
      },
      {
        id: "dataset-release-version-gaps",
        description:
          "Compare retention and onboarding completion between the matched release cohorts.",
      },
    ],
    evaluationCriteria: {
      supportsHypothesis:
        "The retention and onboarding gaps remain materially worse in the current release under matched cohort definitions.",
      weakensHypothesis:
        "The release differences disappear after matching cohorts or are not aligned across retention and onboarding evidence.",
    },
  },
  {
    id: "template-dataset-review-onboarding-step",
    diagnosticCaseId: DATASET_PRIMARY_ANOMALY_ID,
    nextValidationId: "dataset-review-onboarding-step",
    objectives: {
      "hypothesis-validation":
        "Determine whether the identified onboarding transition remains the largest material drop-off under consistent event definitions.",
      "evidence-collection":
        "Collect matched step-completion and instrumentation evidence for the identified onboarding transition.",
    },
    methodType: "funnel-review",
    requiredEvidence: [
      {
        id: "dataset-onboarding-step-comparison",
        description:
          "Matched entry, step-completion, and event-quality evidence for the identified onboarding transition.",
        status: "to-collect",
        evidenceReferenceIds: [],
      },
    ],
    checks: [
      {
        id: "dataset-onboarding-step-definitions",
        description:
          "Confirm that entry and completion events use consistent definitions across the compared releases.",
      },
      {
        id: "dataset-onboarding-step-dropoff",
        description:
          "Compare transition completion and inspect missing, duplicated, or delayed step events.",
      },
    ],
    evaluationCriteria: {
      supportsHypothesis:
        "The identified onboarding transition remains the largest drop-off after event definitions and collection quality are verified.",
      weakensHypothesis:
        "The drop-off moves to another transition or is explained by inconsistent event instrumentation.",
    },
  },
  {
    id: "template-dataset-review-linked-feedback",
    diagnosticCaseId: DATASET_PRIMARY_ANOMALY_ID,
    nextValidationId: "dataset-review-linked-feedback",
    objectives: {
      "hypothesis-validation":
        "Determine whether linked onboarding feedback consistently describes the same friction point as the measured funnel drop-off.",
      "evidence-collection":
        "Collect and review feedback linked to the affected onboarding cohort and transition.",
    },
    methodType: "feedback-review",
    requiredEvidence: [
      {
        id: "dataset-linked-feedback-evidence",
        description:
          "Linked feedback volume, themes, and representative excerpts for the affected onboarding cohort.",
        status: "to-collect",
        evidenceReferenceIds: [],
      },
    ],
    checks: [
      {
        id: "dataset-linked-feedback-scope",
        description:
          "Confirm that feedback records belong to the affected cohort and comparison period.",
      },
      {
        id: "dataset-linked-feedback-corroboration",
        description:
          "Compare recurring feedback themes with the identified onboarding transition without treating correlation as causation.",
      },
    ],
    evaluationCriteria: {
      supportsHypothesis:
        "A recurring feedback theme identifies the same onboarding friction point as the measured transition drop-off.",
      weakensHypothesis:
        "Linked feedback is sparse, inconsistent, or concentrated on unrelated parts of the experience.",
    },
  },
  {
    id: "template-dataset-compare-segments",
    diagnosticCaseId: DATASET_PRIMARY_ANOMALY_ID,
    nextValidationId: "dataset-compare-segments",
    objectives: {
      "hypothesis-validation":
        "Determine whether the uploaded dataset signal is concentrated in an available segment.",
      "evidence-collection":
        "Collect a matched segment comparison for the uploaded dataset signal.",
    },
    methodType: "cohort-comparison",
    requiredEvidence: [
      {
        id: "dataset-segment-comparison-evidence",
        description:
          "A matched metric comparison across available uploaded dataset segments.",
        status: "to-collect",
        evidenceReferenceIds: [],
      },
    ],
    checks: [
      {
        id: "dataset-check-segment-definitions",
        description:
          "Confirm that segment definitions and comparison windows are consistent.",
      },
      {
        id: "dataset-check-segment-difference",
        description:
          "Compare the measured signal across available segments without inferring a cause.",
      },
    ],
    evaluationCriteria: {
      supportsHypothesis:
        "The measured difference remains concentrated in a segment under consistent definitions.",
      weakensHypothesis:
        "The measured difference is not concentrated after applying consistent segment definitions.",
    },
  },
  {
    id: "template-dataset-review-behavior",
    diagnosticCaseId: DATASET_PRIMARY_ANOMALY_ID,
    nextValidationId: "dataset-review-behavior",
    objectives: {
      "hypothesis-validation":
        "Determine whether available behavior evidence is associated with the uploaded dataset signal.",
      "evidence-collection":
        "Collect matched behavior evidence around the uploaded dataset comparison window.",
    },
    methodType: "cohort-comparison",
    requiredEvidence: [
      {
        id: "dataset-related-behavior-evidence",
        description:
          "Matched behavior metrics for the current and baseline dataset windows.",
        status: "to-collect",
        evidenceReferenceIds: [],
      },
    ],
    checks: [
      {
        id: "dataset-check-behavior-window",
        description:
          "Confirm that behavior events and observation windows are comparable.",
      },
      {
        id: "dataset-check-behavior-pattern",
        description:
          "Compare related behavior patterns without treating association as causation.",
      },
    ],
    evaluationCriteria: {
      supportsHypothesis:
        "A material behavior difference remains aligned with the measured signal under matched windows.",
      weakensHypothesis:
        "Related behavior remains stable or is not aligned after matching the comparison windows.",
    },
  },
  {
    id: "template-analytics-retention-feature-adoption",
    diagnosticCaseId: DATASET_PRIMARY_ANOMALY_ID,
    nextValidationId: "analytics-review-feature-adoption",
    objectives: {
      "hypothesis-validation":
        "Compare feature adoption for the primary retention segment without treating association as causation.",
      "evidence-collection":
        "Collect matched feature-adoption evidence for the primary retention segment and baseline.",
    },
    methodType: "cohort-comparison",
    requiredEvidence: [
      {
        id: "analytics-retention-feature-adoption-comparison",
        description:
          "A matched feature-adoption comparison for the selected segment and baseline.",
        status: "to-collect",
        evidenceReferenceIds: [],
      },
    ],
    checks: [
      {
        id: "analytics-retention-check-feature-definitions",
        description:
          "Confirm that compared features and adoption windows use consistent definitions.",
      },
      {
        id: "analytics-retention-check-feature-adoption",
        description:
          "Compare adoption rates for the selected segment and baseline across the same cohort window.",
      },
    ],
    evaluationCriteria: {
      supportsHypothesis:
        "A material feature-adoption gap is concentrated in the segment with the primary retention signal.",
      weakensHypothesis:
        "Feature adoption remains comparable after applying matched cohort and segment filters.",
    },
  },
  {
    id: "template-analytics-retention-user-engagement",
    diagnosticCaseId: DATASET_PRIMARY_ANOMALY_ID,
    nextValidationId: "analytics-analyze-user-engagement",
    objectives: {
      "hypothesis-validation":
        "Compare engagement behavior for the primary retention segment before inferring a driver.",
      "evidence-collection":
        "Collect matched engagement evidence for the primary retention segment and baseline.",
    },
    methodType: "cohort-comparison",
    requiredEvidence: [
      {
        id: "analytics-retention-engagement-comparison",
        description:
          "A matched engagement-frequency comparison for the selected segment and baseline.",
        status: "to-collect",
        evidenceReferenceIds: [],
      },
    ],
    checks: [
      {
        id: "analytics-retention-check-engagement-window",
        description:
          "Confirm that engagement windows and active-user definitions are consistent.",
      },
      {
        id: "analytics-retention-check-engagement-pattern",
        description:
          "Compare engagement frequency for the selected segment and baseline before interpreting the retention gap.",
      },
    ],
    evaluationCriteria: {
      supportsHypothesis:
        "A material engagement gap is concentrated in the segment with the primary retention signal.",
      weakensHypothesis:
        "Engagement behavior remains comparable after applying matched cohort and segment filters.",
    },
  },
  {
    id: "funnel-dropoff-analysis",
    diagnosticCaseId: DATASET_PRIMARY_ANOMALY_ID,
    nextValidationId: "funnel-dropoff-analysis",
    objectives: {
      "hypothesis-validation":
        "Determine whether the identified transition remains the largest material drop-off under a consistent funnel definition.",
      "evidence-collection":
        "Collect a matched step-completion comparison for the identified funnel transition and baseline version.",
    },
    methodType: "funnel-review",
    requiredEvidence: [
      {
        id: "funnel-dropoff-step-completion",
        description:
          "A matched completion and drop-off comparison for the identified transition across the current and baseline versions.",
        status: "to-collect",
        evidenceReferenceIds: [],
      },
    ],
    checks: [
      {
        id: "funnel-dropoff-check-definition",
        description:
          "Confirm that the entry event, transition events, and user filters are consistent across versions.",
      },
      {
        id: "funnel-dropoff-check-concentration",
        description:
          "Compare step completion and user loss to verify whether the selected transition remains the largest drop-off.",
      },
    ],
    evaluationCriteria: {
      supportsHypothesis:
        "The selected transition remains the largest material drop-off after applying consistent funnel definitions and filters.",
      weakensHypothesis:
        "The drop-off is no longer concentrated at the selected transition after applying consistent definitions and filters.",
    },
  },
  {
    id: "funnel-segment-comparison",
    diagnosticCaseId: DATASET_PRIMARY_ANOMALY_ID,
    nextValidationId: "funnel-segment-comparison",
    objectives: {
      "hypothesis-validation":
        "Determine whether the selected funnel transition differs materially across affected user segments.",
      "evidence-collection":
        "Collect a matched segment comparison for completion at the selected funnel transition.",
    },
    methodType: "cohort-comparison",
    requiredEvidence: [
      {
        id: "funnel-segment-step-comparison",
        description:
          "Completion rates, user counts, and drop-off rates for comparable user segments at the selected transition.",
        status: "to-collect",
        evidenceReferenceIds: [],
      },
    ],
    checks: [
      {
        id: "funnel-segment-check-filters",
        description:
          "Confirm that compared segments use the same funnel definition, version window, and eligibility filters.",
      },
      {
        id: "funnel-segment-check-difference",
        description:
          "Compare completion and drop-off at the selected transition across the available user segments.",
      },
    ],
    evaluationCriteria: {
      supportsHypothesis:
        "A material transition drop-off is concentrated in one or more affected user segments.",
      weakensHypothesis:
        "Completion remains comparable across segments after applying consistent definitions and filters.",
    },
  },
  {
    id: "feedback-segment-review",
    diagnosticCaseId: DATASET_PRIMARY_ANOMALY_ID,
    nextValidationId: "feedback-segment-review",
    objectives: {
      "hypothesis-validation":
        "Determine whether the feedback topic is materially concentrated in the affected segment.",
      "evidence-collection":
        "Collect a matched topic-prevalence comparison for the affected segment and available comparison segments.",
    },
    methodType: "feedback-review",
    requiredEvidence: [
      {
        id: "feedback-segment-topic-comparison",
        description:
          "Topic mentions, feedback volume, and representative quotes for comparable user segments.",
        status: "to-collect",
        evidenceReferenceIds: [],
      },
    ],
    checks: [
      {
        id: "feedback-segment-check-source-window",
        description:
          "Confirm that feedback sources, time windows, and topic definitions are consistent across segments.",
      },
      {
        id: "feedback-segment-check-concentration",
        description:
          "Compare topic prevalence and representative feedback across the affected and comparison segments.",
      },
    ],
    evaluationCriteria: {
      supportsHypothesis:
        "The feedback topic remains materially more prevalent in the affected segment under consistent comparison criteria.",
      weakensHypothesis:
        "The feedback topic is similarly distributed across segments or changes after consistent filtering.",
    },
  },
  {
    id: "feedback-related-signal-review",
    diagnosticCaseId: DATASET_PRIMARY_ANOMALY_ID,
    nextValidationId: "feedback-related-signal-review",
    objectives: {
      "hypothesis-validation":
        "Determine whether the feedback-topic trend and linked product signal share a consistent time pattern.",
      "evidence-collection":
        "Collect matched time-series evidence for the feedback topic and linked product signal.",
    },
    methodType: "feedback-review",
    requiredEvidence: [
      {
        id: "feedback-linked-signal-timeline",
        description:
          "A matched timeline for topic mentions and the linked product signal using the same comparison period.",
        status: "to-collect",
        evidenceReferenceIds: [],
      },
    ],
    checks: [
      {
        id: "feedback-related-signal-check-windows",
        description:
          "Confirm that the topic and product signal use comparable time windows and segment filters.",
      },
      {
        id: "feedback-related-signal-check-timing",
        description:
          "Compare the timing and direction of both signals without treating correlation as causation.",
      },
    ],
    evaluationCriteria: {
      supportsHypothesis:
        "The feedback-topic change and linked product signal remain aligned under matched periods and filters.",
      weakensHypothesis:
        "The signals do not align after matching periods and filters, or the relationship is explained by coverage differences.",
    },
  },
  {
    id: "feedback-product-signal-review",
    diagnosticCaseId: DATASET_PRIMARY_ANOMALY_ID,
    nextValidationId: "feedback-product-signal-review",
    objectives: {
      "hypothesis-validation":
        "Determine whether an available product metric changes alongside the feedback topic under matched periods and scope.",
      "evidence-collection":
        "Identify and collect a comparable product signal for the feedback topic without inferring a causal relationship.",
    },
    methodType: "feedback-review",
    requiredEvidence: [
      {
        id: "feedback-product-signal-comparison",
        description:
          "A candidate product metric and feedback-topic timeline using matched periods and population scope.",
        status: "to-collect",
        evidenceReferenceIds: [],
      },
    ],
    checks: [
      {
        id: "feedback-product-signal-selection",
        description:
          "Select a product metric with a documented relationship to the feedback topic and compatible population scope.",
      },
      {
        id: "feedback-product-signal-alignment",
        description:
          "Compare direction and timing under matched periods without treating alignment as causation.",
      },
    ],
    evaluationCriteria: {
      supportsHypothesis:
        "A relevant product signal and the feedback topic remain directionally aligned under matched periods and scope.",
      weakensHypothesis:
        "No relevant product signal is available, or candidate signals do not align after matching periods and population scope.",
    },
  },
  {
    id: "activity-segment-review",
    diagnosticCaseId: DATASET_PRIMARY_ANOMALY_ID,
    nextValidationId: "analytics-activity-segment-review",
    objectives: {
      "hypothesis-validation":
        "Determine whether the observed activity decline is concentrated in an available user segment.",
      "evidence-collection":
        "Collect a matched activity comparison for available user segments.",
    },
    methodType: "cohort-comparison",
    requiredEvidence: [{
      id: "activity-segment-comparison",
      description:
        "Matched activity evidence for the current and baseline windows across available user segments.",
      status: "to-collect",
      evidenceReferenceIds: [],
    }],
    checks: [{
      id: "activity-segment-window-check",
      description:
        "Confirm that segment definitions and activity windows are comparable before interpreting the difference.",
    }],
    evaluationCriteria: {
      supportsHypothesis:
        "The activity decline remains concentrated after applying consistent segment and time-window filters.",
      weakensHypothesis:
        "The decline is distributed similarly across available segments or disappears under matched definitions.",
    },
  },
  {
    id: "activity-event-review",
    diagnosticCaseId: DATASET_PRIMARY_ANOMALY_ID,
    nextValidationId: "analytics-activity-event-review",
    objectives: {
      "hypothesis-validation":
        "Determine whether key event activity changed during the same comparison windows.",
      "evidence-collection":
        "Collect comparable key-event volume and definition evidence for both activity windows.",
    },
    methodType: "event-quality-check",
    requiredEvidence: [{
      id: "activity-event-comparison",
      description:
        "Comparable key-event activity and event-definition evidence for the current and baseline windows.",
      status: "to-collect",
      evidenceReferenceIds: [],
    }],
    checks: [{
      id: "activity-event-definition-check",
      description:
        "Confirm that tracked events and collection behavior are consistent across both windows.",
    }],
    evaluationCriteria: {
      supportsHypothesis:
        "A key-event change remains visible under consistent collection and comparison rules.",
      weakensHypothesis:
        "Event definitions or collection coverage changed, or key-event activity remains stable.",
    },
  },
];

export function getValidationPlanTemplates(
  diagnosticCaseId: string,
): ValidationPlanTemplate[] {
  const templateDiagnosticCaseId = isDatasetDiagnosticCaseId(diagnosticCaseId)
    ? DATASET_PRIMARY_ANOMALY_ID
    : diagnosticCaseId;

  return validationPlanTemplates
    .filter(
      (template) => template.diagnosticCaseId === templateDiagnosticCaseId,
    )
    .map((template) => ({ ...template, diagnosticCaseId }));
}

export function getValidationPlanTemplate(
  diagnosticCaseId: string,
  nextValidationId: string,
): ValidationPlanTemplate | undefined {
  const templateDiagnosticCaseId = isDatasetDiagnosticCaseId(diagnosticCaseId)
    ? DATASET_PRIMARY_ANOMALY_ID
    : diagnosticCaseId;
  const template = validationPlanTemplates.find(
    (template) =>
      template.diagnosticCaseId === templateDiagnosticCaseId &&
      template.nextValidationId === nextValidationId,
  );

  return template ? { ...template, diagnosticCaseId } : undefined;
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
