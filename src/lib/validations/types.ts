export type ReviewDecision =
  | "use-as-working-hypothesis"
  | "needs-more-evidence"
  | "reject-suggestion";

export type ReviewedHypothesis = {
  workingStatement: string;
  editedByPm: boolean;
};

type PMReviewBase = {
  id: string;
  diagnosticCaseId: string;
  investigationResultId: string;
  sourceHypothesisId: string;
  refinedHypothesis: string | null;
  note: string | null;
  persistence: "session-only";
};

export type PMReview =
  | (PMReviewBase & {
      decision: "use-as-working-hypothesis";
      selectedValidationId: string;
      rejectionReason: null;
    })
  | (PMReviewBase & {
      decision: "needs-more-evidence";
      selectedValidationId: string;
      rejectionReason: null;
    })
  | (PMReviewBase & {
      decision: "reject-suggestion";
      selectedValidationId: null;
      rejectionReason: string;
    });

export type ActionablePMReview = Exclude<
  PMReview,
  { decision: "reject-suggestion" }
>;

export type ValidationPlanPurpose =
  | "hypothesis-validation"
  | "evidence-collection";

export type ValidationPlanStatus = "draft" | "planned";

export type ValidationExecutionStatus = "not-run";

export type ValidationMethodType =
  | "funnel-review"
  | "cohort-comparison"
  | "feedback-review"
  | "event-quality-check"
  | "usability-review";

export type ValidationEvidenceRequirement = {
  id: string;
  description: string;
  status: "available" | "to-collect";
  evidenceReferenceIds: string[];
};

export type ValidationCheck = {
  id: string;
  description: string;
};

export type ValidationEvaluationCriteria = {
  supportsHypothesis: string;
  weakensHypothesis: string;
};

export type ValidationPlanTemplate = {
  id: string;
  diagnosticCaseId: string;
  nextValidationId: string;
  objectives: Record<ValidationPlanPurpose, string>;
  methodType: ValidationMethodType;
  requiredEvidence: ValidationEvidenceRequirement[];
  checks: ValidationCheck[];
  evaluationCriteria: ValidationEvaluationCriteria;
};

export type HypothesisSnapshot = ReviewedHypothesis & {
  sourceHypothesisId: string;
  originalStatement: string;
  evidenceReferenceIds: string[];
  epistemicStatus: "unvalidated";
};

export type ValidationTargetScope = {
  metricId: string;
  contextIds: string[];
};

export type ValidationPlan = {
  id: string;
  templateId: string;
  diagnosticCaseId: string;
  investigationResultId: string;
  pmReviewId: string;
  sourceValidationId: string;
  source: "mock-template";
  persistence: "session-only";
  objective: string;
  purpose: ValidationPlanPurpose;
  hypothesisSnapshot: HypothesisSnapshot;
  method: {
    type: ValidationMethodType;
    sourceValidationId: string;
  };
  targetScope: ValidationTargetScope;
  requiredEvidence: ValidationEvidenceRequirement[];
  checks: ValidationCheck[];
  evaluationCriteria: ValidationEvaluationCriteria;
  status: ValidationPlanStatus;
  executionStatus: ValidationExecutionStatus;
};
