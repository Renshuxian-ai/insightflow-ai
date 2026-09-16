import type { DiagnosticCase } from "@/lib/diagnostics/types";
import type { InvestigationResult } from "@/lib/investigations/types";
import type { ValidationPlan } from "@/lib/validations/types";

type ValidationResultProps = {
  diagnosticCase: DiagnosticCase;
  investigationResult: InvestigationResult;
  plan: ValidationPlan;
};

export function ValidationResult({
  diagnosticCase,
  investigationResult,
  plan,
}: ValidationResultProps) {
  const linkedEvidenceIds = new Set(
    plan.hypothesisSnapshot.evidenceReferenceIds,
  );
  const linkedEvidence = investigationResult.evidenceUsed.filter((evidence) =>
    linkedEvidenceIds.has(evidence.id),
  );
  const supportingEvidence =
    linkedEvidence.length > 0 ? linkedEvidence : investigationResult.evidenceUsed;
  const nextRecommendation = investigationResult.recommendedValidations.find(
    (recommendation) =>
      recommendation.validationId !== plan.sourceValidationId,
  );
  const nextValidation = nextRecommendation
    ? diagnosticCase.nextValidations.find(
        (validation) => validation.id === nextRecommendation.validationId,
      )
    : null;

  return (
    <section
      id="investigation-validation-result"
      className="mt-5 scroll-mt-6 rounded-xl border border-[#dce8df] bg-[#fbfdfb] p-5 shadow-[0_1px_2px_rgba(16,24,40,0.02)] sm:p-6"
      aria-labelledby="validation-result-title"
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#27714b]">
          Validation result
        </p>
        <span className="rounded-md bg-[#eaf8f0] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.06em] text-[#27714b]">
          Completed
        </span>
        <span className="rounded-md bg-[#f2f4f8] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.06em] text-[#778196]">
          Mock execution
        </span>
      </div>
      <h3
        id="validation-result-title"
        className="mt-2 text-lg font-semibold tracking-[-0.025em] text-[#172033]"
      >
        Validation completed
      </h3>
      <p className="mt-1.5 max-w-3xl text-sm leading-6 text-[#68758b]">
        The completed mock workflow records the observed signal and linked
        evidence. It does not confirm a cause.
      </p>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <article className="rounded-lg border border-[#e5e9ef] bg-white p-4">
          <span className="rounded-md bg-[#edf1ff] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.06em] text-[#6072b8]">
            Observation
          </span>
          <h4 className="mt-3 text-sm font-semibold text-[#344056]">
            Confirmed finding
          </h4>
          <p className="mt-2 text-xs leading-5 text-[#68758b]">
            {investigationResult.summary.text}
          </p>
        </article>

        <article className="rounded-lg border border-[#e5e9ef] bg-white p-4">
          <span className="rounded-md bg-[#eef4ff] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.06em] text-[#3559e8]">
            Evidence
          </span>
          <h4 className="mt-3 text-sm font-semibold text-[#344056]">
            Supporting evidence
          </h4>
          <ul className="mt-2 space-y-2">
            {supportingEvidence.map((evidence) => (
              <li
                key={evidence.id}
                className="flex gap-2 text-xs leading-5 text-[#68758b]"
              >
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[#8fa2c2]" />
                <span>{evidence.relevance}</span>
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-lg border border-[#e5e9ef] bg-white p-4">
          <span className="rounded-md bg-[#f2f4f8] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.06em] text-[#778196]">
            Recommendation
          </span>
          <h4 className="mt-3 text-sm font-semibold text-[#344056]">
            Next recommendation
          </h4>
          <p className="mt-2 text-xs font-semibold leading-5 text-[#4d5a70]">
            {nextValidation?.label ?? "Review the validation evidence"}
          </p>
          <p className="mt-1 text-xs leading-5 text-[#778196]">
            {nextValidation?.description ??
              "Review the completed checks and linked evidence before deciding what to investigate next."}
          </p>
        </article>
      </div>
    </section>
  );
}
