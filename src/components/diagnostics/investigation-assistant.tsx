"use client";

import { useState } from "react";

import type { DiagnosticCase } from "@/lib/diagnostics/types";
import type { InvestigationResult } from "@/lib/investigations/types";
import { buildValidationPlan } from "@/lib/validations/mock-data";
import type {
  ActionablePMReview,
  PMReview,
  ReviewDecision,
  ValidationPlan,
  ValidationPlanTemplate,
} from "@/lib/validations/types";

import { InvestigationDraft } from "./investigation-draft";
import { PMReviewPanel } from "./pm-review";
import { ValidationPlanCard } from "./validation-plan";

type InvestigationAssistantProps = {
  diagnosticCase: DiagnosticCase;
  result?: InvestigationResult;
  validationPlanTemplates: ValidationPlanTemplate[];
};

export function InvestigationAssistant({
  diagnosticCase,
  result,
  validationPlanTemplates,
}: InvestigationAssistantProps) {
  const [isDraftVisible, setIsDraftVisible] = useState(false);
  const [decision, setDecision] = useState<ReviewDecision | null>(null);
  const [refinedHypothesis, setRefinedHypothesis] = useState("");
  const [note, setNote] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [selectedValidationId, setSelectedValidationId] = useState("");
  const [confirmedReview, setConfirmedReview] = useState<PMReview | null>(null);
  const [validationPlan, setValidationPlan] = useState<ValidationPlan | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const workflowRegionId = result ? `investigation-workflow-${result.id}` : undefined;

  const validationOptions = result
    ? validationPlanTemplates.flatMap((template) => {
        const validation = diagnosticCase.nextValidations.find(
          (item) => item.id === template.nextValidationId,
        );

        if (!validation) {
          return [];
        }

        return [validation];
      })
    : [];

  function handleDecisionChange(nextDecision: ReviewDecision) {
    setDecision(nextDecision);
    setConfirmedReview(null);
    setValidationPlan(null);
    setReviewError(null);

    if (nextDecision === "reject-suggestion") {
      setSelectedValidationId("");
    }
  }

  function handleConfirmReview() {
    if (!result || !decision) {
      return;
    }

    const reviewId = `pm-review-${result.id}`;
    const normalizedRefinement = refinedHypothesis.trim();
    const normalizedNote = note.trim() || null;

    if (decision === "reject-suggestion") {
      const normalizedReason = rejectionReason.trim();

      if (!normalizedReason) {
        setReviewError("Add a rejection reason before recording this decision.");
        return;
      }

      const review: PMReview = {
        id: reviewId,
        diagnosticCaseId: diagnosticCase.id,
        investigationResultId: result.id,
        sourceHypothesisId: result.workingHypothesis.id,
        decision,
        refinedHypothesis: null,
        note: normalizedNote,
        selectedValidationId: null,
        rejectionReason: normalizedReason,
        persistence: "session-only",
      };

      setConfirmedReview(review);
      setValidationPlan(null);
      setReviewError(null);
      return;
    }

    if (!selectedValidationId) {
      setReviewError("Select a validation before creating the plan.");
      return;
    }

    const template = validationPlanTemplates.find(
      (item) => item.nextValidationId === selectedValidationId,
    );

    if (!template) {
      setReviewError("No prototype plan template is available for this validation.");
      return;
    }

    const review: ActionablePMReview = {
      id: reviewId,
      diagnosticCaseId: diagnosticCase.id,
      investigationResultId: result.id,
      sourceHypothesisId: result.workingHypothesis.id,
      decision,
      refinedHypothesis:
        normalizedRefinement &&
        normalizedRefinement !== result.workingHypothesis.statement
          ? normalizedRefinement
          : null,
      note: normalizedNote,
      selectedValidationId,
      rejectionReason: null,
      persistence: "session-only",
    };
    const plan = buildValidationPlan(review, template, diagnosticCase, result);

    if (!plan) {
      setReviewError("The selected validation does not match this diagnostic case.");
      return;
    }

    setConfirmedReview(review);
    setValidationPlan(plan);
    setReviewError(null);
  }

  function handleEditReview() {
    setConfirmedReview(null);
    setValidationPlan(null);
    setReviewError(null);
  }

  function handleMarkAsPlanned() {
    setValidationPlan((currentPlan) =>
      currentPlan ? { ...currentPlan, status: "planned" } : currentPlan,
    );
  }

  return (
    <section
      className="rounded-xl border border-[#dce3fb] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.02)] sm:p-6"
      aria-labelledby="investigation-assistant-title"
    >
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#3559e8]">
              AI Investigation Assistant
            </p>
            <span className="rounded-md bg-[#edf1ff] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#3559e8]">
              Prototype
            </span>
            <span className="rounded-md bg-[#f2f4f8] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#778196]">
              Mock result
            </span>
          </div>
          <h2
            id="investigation-assistant-title"
            className="mt-2 text-lg font-semibold tracking-[-0.025em] text-[#172033]"
          >
            Turn this diagnostic into a reviewable investigation draft
          </h2>
          <p className="mt-1.5 text-sm leading-6 text-[#68758b]">
            The draft is limited to this case and references its existing evidence. It proposes possible explanations and validation steps without making a causal conclusion.
          </p>
        </div>

        {result ? (
          <button
            type="button"
            className="inline-flex min-h-10 w-fit shrink-0 items-center justify-center rounded-lg bg-[#3559e8] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2949ca] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3559e8]"
            aria-expanded={isDraftVisible}
            aria-controls={workflowRegionId}
            onClick={() => setIsDraftVisible((current) => !current)}
          >
            {isDraftVisible ? "Hide mock investigation draft" : "Create mock investigation draft"}
          </button>
        ) : (
          <span className="w-fit rounded-md bg-[#f2f4f8] px-2.5 py-1.5 text-xs font-semibold text-[#778196]">
            No mock draft available
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-[#778196]">
        <span className="rounded-md border border-[#e4e7ee] bg-[#fafbfc] px-2.5 py-1.5">
          Case: {diagnosticCase.title}
        </span>
        <span className="rounded-md border border-[#e4e7ee] bg-[#fafbfc] px-2.5 py-1.5">
          {result
            ? `${result.evidenceUsed.length} evidence references`
            : `${diagnosticCase.evidence.behaviorSignals.length + diagnosticCase.evidence.feedbackSignals.length} evidence signals`}
        </span>
        <span className="rounded-md border border-[#e4e7ee] bg-[#fafbfc] px-2.5 py-1.5">
          No AI API or workflow executed
        </span>
      </div>

      {result && isDraftVisible ? (
        <div id={workflowRegionId}>
          <InvestigationDraft diagnosticCase={diagnosticCase} result={result} />
          <PMReviewPanel
            originalHypothesis={result.workingHypothesis.statement}
            decision={decision}
            refinedHypothesis={refinedHypothesis}
            note={note}
            rejectionReason={rejectionReason}
            selectedValidationId={selectedValidationId}
            validationOptions={validationOptions}
            confirmedReview={confirmedReview}
            error={reviewError}
            onDecisionChange={handleDecisionChange}
            onRefinedHypothesisChange={setRefinedHypothesis}
            onNoteChange={setNote}
            onRejectionReasonChange={setRejectionReason}
            onValidationChange={setSelectedValidationId}
            onConfirm={handleConfirmReview}
            onEdit={handleEditReview}
          />
          {validationPlan ? (
            <ValidationPlanCard
              plan={validationPlan}
              diagnosticCase={diagnosticCase}
              onMarkAsPlanned={handleMarkAsPlanned}
            />
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
