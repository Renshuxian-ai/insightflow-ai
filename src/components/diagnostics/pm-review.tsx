import type { PMReview, ReviewDecision } from "@/lib/validations/types";

type ValidationOption = {
  id: string;
  label: string;
  description: string;
};

type PMReviewPanelProps = {
  originalHypothesis: string;
  decision: ReviewDecision | null;
  refinedHypothesis: string;
  note: string;
  rejectionReason: string;
  selectedValidationId: string;
  validationOptions: ValidationOption[];
  confirmedReview: PMReview | null;
  error: string | null;
  onDecisionChange: (decision: ReviewDecision) => void;
  onRefinedHypothesisChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onRejectionReasonChange: (value: string) => void;
  onValidationChange: (validationId: string) => void;
  onConfirm: () => void;
  onEdit: () => void;
};

const reviewOptions: Array<{
  value: ReviewDecision;
  label: string;
  description: string;
}> = [
  {
    value: "use-as-working-hypothesis",
    label: "Use as working hypothesis",
    description: "Move this unvalidated hypothesis into a validation plan.",
  },
  {
    value: "needs-more-evidence",
    label: "Needs more evidence",
    description: "Create an evidence-collection plan before prioritizing the hypothesis.",
  },
  {
    value: "reject-suggestion",
    label: "Reject suggestion",
    description: "Record why this suggestion should not move into validation.",
  },
];

const decisionLabels: Record<ReviewDecision, string> = {
  "use-as-working-hypothesis": "Use as working hypothesis",
  "needs-more-evidence": "Needs more evidence",
  "reject-suggestion": "Suggestion rejected",
};

export function PMReviewPanel({
  originalHypothesis,
  decision,
  refinedHypothesis,
  note,
  rejectionReason,
  selectedValidationId,
  validationOptions,
  confirmedReview,
  error,
  onDecisionChange,
  onRefinedHypothesisChange,
  onNoteChange,
  onRejectionReasonChange,
  onValidationChange,
  onConfirm,
  onEdit,
}: PMReviewPanelProps) {
  if (confirmedReview) {
    const selectedValidation = validationOptions.find(
      (validation) => validation.id === confirmedReview.selectedValidationId,
    );
    const workingHypothesis =
      confirmedReview.refinedHypothesis ?? originalHypothesis;

    return (
      <section
        className="mt-6 rounded-xl border border-[#dfe4f2] bg-[#fafbff] p-5"
        aria-labelledby="pm-review-title"
      >
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#3559e8]">
                PM Review
              </p>
              <span className="rounded-md bg-[#eaf8f0] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.06em] text-[#27714b]">
                Review recorded
              </span>
              <span className="rounded-md bg-[#f2f4f8] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.06em] text-[#778196]">
                Session only
              </span>
              <span className="rounded-md bg-[#f2f4f8] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.06em] text-[#778196]">
                No persistence
              </span>
            </div>
            <h3
              id="pm-review-title"
              className="mt-2 text-base font-semibold text-[#172033]"
            >
              {decisionLabels[confirmedReview.decision]}
            </h3>
          </div>

          <button
            type="button"
            className="w-fit rounded-lg border border-[#dfe4f2] bg-white px-3 py-2 text-xs font-semibold text-[#4d5a70] transition-colors hover:border-[#cbd4e5] hover:text-[#263247] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3559e8]"
            onClick={onEdit}
          >
            Edit review
          </button>
        </div>

        {confirmedReview.decision === "reject-suggestion" ? (
          <article className="mt-4 rounded-lg border border-[#f0d7d7] bg-[#fffafa] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#a44848]">
              Rejection reason
            </p>
            <p className="mt-2 text-sm leading-6 text-[#5d3f45]">
              {confirmedReview.rejectionReason}
            </p>
            <p className="mt-2 text-xs text-[#916d74]">
              No Validation Plan was created from this suggestion.
            </p>
          </article>
        ) : (
          <div className="mt-4 grid gap-3 lg:grid-cols-[1.4fr_0.6fr]">
            <article className="rounded-lg border border-[#ddd6f5] bg-white p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#6c4bd1]">
                  Working hypothesis
                </p>
                <span className="rounded-md bg-[#f1edff] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.06em] text-[#6244bd]">
                  Unvalidated
                </span>
                {confirmedReview.refinedHypothesis ? (
                  <span className="rounded-md bg-[#edf1ff] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.06em] text-[#6072b8]">
                    PM refined
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-sm font-medium leading-6 text-[#443b64]">
                {workingHypothesis}
              </p>
            </article>

            <article className="rounded-lg border border-[#e9ecf1] bg-white p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#6072b8]">
                Selected validation
              </p>
              <p className="mt-2 text-sm font-semibold text-[#344056]">
                {selectedValidation?.label ?? "Unavailable validation"}
              </p>
              {selectedValidation ? (
                <p className="mt-1 text-xs leading-5 text-[#778196]">
                  {selectedValidation.description}
                </p>
              ) : null}
            </article>
          </div>
        )}

        {confirmedReview.note ? (
          <div className="mt-3 rounded-lg border border-[#e9ecf1] bg-white px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#7e8798]">
              PM note
            </p>
            <p className="mt-1 text-xs leading-5 text-[#5f6b80]">
              {confirmedReview.note}
            </p>
          </div>
        ) : null}

        <p className="mt-3 text-[11px] leading-5 text-[#8a94a6]">
          This review records a product manager&apos;s decision for this page session. It does not confirm causality or validate the hypothesis.
        </p>
      </section>
    );
  }

  const canConfirm =
    decision === "reject-suggestion"
      ? rejectionReason.trim().length > 0
      : decision !== null && selectedValidationId.length > 0;

  return (
    <section
      className="mt-6 rounded-xl border border-[#dfe4f2] bg-[#fafbff] p-5"
      aria-labelledby="pm-review-title"
    >
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#3559e8]">
            PM Review
          </p>
          <h3
            id="pm-review-title"
            className="mt-1 text-base font-semibold text-[#172033]"
          >
            Decide how this AI suggestion should move forward
          </h3>
          <p className="mt-1 text-xs leading-5 text-[#778196]">
            The AI draft remains read-only. Your decision is stored separately and only for this page session.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-md bg-[#f2f4f8] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.06em] text-[#778196]">
            Session only
          </span>
          <span className="rounded-md bg-[#f2f4f8] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.06em] text-[#778196]">
            No persistence
          </span>
        </div>
      </div>

      <fieldset className="mt-5">
        <legend className="text-xs font-semibold text-[#344056]">
          Review decision
        </legend>
        <div className="mt-2 grid gap-3 lg:grid-cols-3">
          {reviewOptions.map((option) => {
            const isSelected = decision === option.value;

            return (
              <label
                key={option.value}
                className={`cursor-pointer rounded-lg border p-4 transition-colors ${
                  isSelected
                    ? "border-[#9caced] bg-[#f5f7ff] ring-1 ring-[#cbd5ff]"
                    : "border-[#e4e7ee] bg-white hover:border-[#cfd6e4]"
                }`}
              >
                <span className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="pm-review-decision"
                    value={option.value}
                    checked={isSelected}
                    onChange={() => onDecisionChange(option.value)}
                    className="mt-0.5 size-4 accent-[#3559e8]"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-[#344056]">
                      {option.label}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-[#778196]">
                      {option.description}
                    </span>
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {decision && decision !== "reject-suggestion" ? (
        <div className="mt-5 space-y-5">
          <div>
            <p className="text-xs font-semibold text-[#344056]">AI working hypothesis</p>
            <p className="mt-2 rounded-lg border border-[#e4e0f3] bg-[#faf8ff] px-4 py-3 text-xs leading-5 text-[#5d5478]">
              {originalHypothesis}
            </p>
          </div>

          <div>
            <label
              htmlFor="pm-refined-hypothesis"
              className="text-xs font-semibold text-[#344056]"
            >
              Refined hypothesis <span className="font-normal text-[#98a1b1]">(optional)</span>
            </label>
            <textarea
              id="pm-refined-hypothesis"
              value={refinedHypothesis}
              onChange={(event) => onRefinedHypothesisChange(event.target.value)}
              rows={3}
              placeholder="Refine the wording without changing the original AI draft."
              className="mt-2 w-full resize-y rounded-lg border border-[#dfe3ea] bg-white px-3 py-2.5 text-sm leading-6 text-[#344056] outline-none transition-colors placeholder:text-[#a1a9b7] focus:border-[#8fa2ee] focus:ring-2 focus:ring-[#e5eaff]"
            />
          </div>

          <fieldset>
            <legend className="text-xs font-semibold text-[#344056]">
              Select validation
            </legend>
            {validationOptions.length > 0 ? (
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                {validationOptions.map((validation) => {
                  const isSelected = selectedValidationId === validation.id;

                  return (
                    <label
                      key={validation.id}
                      className={`cursor-pointer rounded-lg border p-4 transition-colors ${
                        isSelected
                          ? "border-[#9caced] bg-white ring-1 ring-[#cbd5ff]"
                          : "border-[#e4e7ee] bg-white hover:border-[#cfd6e4]"
                      }`}
                    >
                      <span className="flex items-start gap-3">
                        <input
                          type="radio"
                          name="pm-review-validation"
                          value={validation.id}
                          checked={isSelected}
                          onChange={() => onValidationChange(validation.id)}
                          className="mt-0.5 size-4 accent-[#3559e8]"
                        />
                        <span>
                          <span className="block text-sm font-semibold text-[#344056]">
                            {validation.label}
                          </span>
                          <span className="mt-1 block text-xs leading-5 text-[#778196]">
                            {validation.description}
                          </span>
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <p className="mt-2 rounded-lg border border-dashed border-[#dfe3ea] bg-white px-4 py-3 text-xs text-[#778196]">
                No prototype validation template is available for this case.
              </p>
            )}
          </fieldset>
        </div>
      ) : null}

      {decision === "reject-suggestion" ? (
        <div className="mt-5">
          <label
            htmlFor="pm-rejection-reason"
            className="text-xs font-semibold text-[#344056]"
          >
            Rejection reason <span className="text-[#b34c4c]">*</span>
          </label>
          <textarea
            id="pm-rejection-reason"
            value={rejectionReason}
            onChange={(event) => onRejectionReasonChange(event.target.value)}
            rows={3}
            required
            placeholder="Explain why this suggestion should not move into validation."
            className="mt-2 w-full resize-y rounded-lg border border-[#ead7d7] bg-white px-3 py-2.5 text-sm leading-6 text-[#344056] outline-none transition-colors placeholder:text-[#a1a9b7] focus:border-[#d69a9a] focus:ring-2 focus:ring-[#f8eaea]"
          />
        </div>
      ) : null}

      {decision ? (
        <div className="mt-5">
          <label htmlFor="pm-review-note" className="text-xs font-semibold text-[#344056]">
            PM note <span className="font-normal text-[#98a1b1]">(optional)</span>
          </label>
          <textarea
            id="pm-review-note"
            value={note}
            onChange={(event) => onNoteChange(event.target.value)}
            rows={2}
            placeholder="Add context for this review decision."
            className="mt-2 w-full resize-y rounded-lg border border-[#dfe3ea] bg-white px-3 py-2.5 text-sm leading-6 text-[#344056] outline-none transition-colors placeholder:text-[#a1a9b7] focus:border-[#8fa2ee] focus:ring-2 focus:ring-[#e5eaff]"
          />
        </div>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-lg border border-[#f0d7d7] bg-[#fffafa] px-3 py-2 text-xs text-[#a44848]" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex flex-col justify-between gap-3 border-t border-[#e7eaf0] pt-4 sm:flex-row sm:items-center">
        <p className="text-[11px] leading-5 text-[#8a94a6]">
          A review decision does not confirm the hypothesis or execute validation.
        </p>
        <button
          type="button"
          disabled={!canConfirm}
          onClick={onConfirm}
          className="inline-flex min-h-10 w-fit items-center justify-center rounded-lg bg-[#3559e8] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2949ca] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3559e8] disabled:cursor-not-allowed disabled:bg-[#b7c0d6]"
        >
          {decision === "reject-suggestion"
            ? "Record rejection"
            : "Create validation plan"}
        </button>
      </div>
    </section>
  );
}
