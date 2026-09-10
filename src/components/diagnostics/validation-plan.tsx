import type { DiagnosticCase } from "@/lib/diagnostics/types";
import type {
  ValidationPlan,
  ValidationPlanPurpose,
} from "@/lib/validations/types";

type ValidationPlanProps = {
  plan: ValidationPlan;
  diagnosticCase: DiagnosticCase;
  onMarkAsPlanned: () => void;
};

const purposeLabels: Record<ValidationPlanPurpose, string> = {
  "hypothesis-validation": "Hypothesis validation",
  "evidence-collection": "Evidence collection",
};

const methodLabels: Record<ValidationPlan["method"]["type"], string> = {
  "funnel-review": "Funnel review",
  "cohort-comparison": "Cohort comparison",
  "feedback-review": "Feedback review",
  "event-quality-check": "Event quality check",
  "usability-review": "Usability review",
};

const evidenceStatusStyles: Record<
  ValidationPlan["requiredEvidence"][number]["status"],
  string
> = {
  available: "bg-[#eaf8f0] text-[#27714b]",
  "to-collect": "bg-[#fff6e4] text-[#92601b]",
};

export function ValidationPlanCard({
  plan,
  diagnosticCase,
  onMarkAsPlanned,
}: ValidationPlanProps) {
  const methodSource = diagnosticCase.nextValidations.find(
    (validation) => validation.id === plan.method.sourceValidationId,
  );
  const targetMetric =
    diagnosticCase.metric.id === plan.targetScope.metricId
      ? diagnosticCase.metric
      : undefined;
  const targetContexts = Object.values(diagnosticCase.context).filter(
    (contextItem) => plan.targetScope.contextIds.includes(contextItem.id),
  );
  const titleId = `validation-plan-${plan.id}`;

  return (
    <section
      className="mt-5 rounded-xl border border-[#d8def0] bg-[#fbfcff] p-5 shadow-[0_1px_2px_rgba(16,24,40,0.02)] sm:p-6"
      aria-labelledby={titleId}
    >
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#3559e8]">
              Validation plan
            </p>
            <span className="rounded-md bg-[#edf1ff] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.06em] text-[#6072b8]">
              {plan.status}
            </span>
          </div>
          <h3
            id={titleId}
            className="mt-2 text-lg font-semibold tracking-[-0.025em] text-[#172033]"
          >
            {purposeLabels[plan.purpose]}
          </h3>
          <p className="mt-1.5 max-w-3xl text-sm leading-6 text-[#68758b]">
            A reviewable plan for what to check next. It does not execute or complete the validation.
          </p>
        </div>

        {plan.status === "draft" ? (
          <button
            type="button"
            onClick={onMarkAsPlanned}
            className="inline-flex min-h-10 w-fit shrink-0 items-center justify-center rounded-lg bg-[#3559e8] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2949ca] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3559e8]"
          >
            Mark as planned
          </button>
        ) : (
          <p
            className="max-w-sm rounded-lg border border-[#dce3fb] bg-white px-4 py-3 text-xs leading-5 text-[#6072b8]"
            role="status"
          >
            Planned does not mean completed. No validation has been run.
          </p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-[0.06em] text-[#778196]">
        <span className="rounded-md border border-[#e1e5ed] bg-white px-2 py-1">
          Not run
        </span>
        <span className="rounded-md border border-[#e1e5ed] bg-white px-2 py-1">
          Session only
        </span>
        <span className="rounded-md border border-[#e1e5ed] bg-white px-2 py-1">
          Mock template
        </span>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <article className="rounded-lg border border-[#e7eaf0] bg-white p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#7e8798]">
            Objective
          </p>
          <p className="mt-2 text-sm font-medium leading-6 text-[#344056]">
            {plan.objective}
          </p>
        </article>

        <article className="rounded-lg border border-[#e7eaf0] bg-white p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#7e8798]">
            Purpose
          </p>
          <p className="mt-2 text-sm font-semibold text-[#344056]">
            {purposeLabels[plan.purpose]}
          </p>
          <p className="mt-1 text-xs leading-5 text-[#778196]">
            Status remains unvalidated until the checks are performed and reviewed.
          </p>
        </article>
      </div>

      <section className="mt-4 rounded-lg border border-[#ddd6f5] bg-[#faf8ff] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#6c4bd1]">
            Hypothesis snapshot
          </p>
          <span className="rounded-md bg-[#f1edff] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.06em] text-[#6244bd]">
            Unvalidated
          </span>
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <div className="rounded-lg bg-white p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#8a7bb5]">
              Original suggestion
            </p>
            <p className="mt-2 text-sm leading-6 text-[#443b64]">
              {plan.hypothesisSnapshot.originalStatement}
            </p>
          </div>
          <div className="rounded-lg bg-white p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#8a7bb5]">
              {plan.hypothesisSnapshot.editedByPm
                ? "PM-refined working hypothesis"
                : "Working hypothesis · Unchanged by PM"}
            </p>
            <p className="mt-2 text-sm leading-6 text-[#443b64]">
              {plan.hypothesisSnapshot.workingStatement}
            </p>
          </div>
        </div>

        <p className="mt-3 text-[11px] text-[#8a7bb5]">
          Linked to {plan.hypothesisSnapshot.evidenceReferenceIds.length} investigation evidence {plan.hypothesisSnapshot.evidenceReferenceIds.length === 1 ? "reference" : "references"}.
        </p>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-[#e7eaf0] bg-white p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#7e8798]">
            Method
          </p>
          <h4 className="mt-2 text-sm font-semibold text-[#344056]">
            {methodSource?.label ?? methodLabels[plan.method.type]}
          </h4>
          <p className="mt-1 text-xs font-medium text-[#6072b8]">
            {methodLabels[plan.method.type]}
          </p>
          <p className="mt-2 text-xs leading-5 text-[#68758b]">
            {methodSource?.description ?? "The source validation is unavailable in this DiagnosticCase."}
          </p>
        </section>

        <section className="rounded-lg border border-[#e7eaf0] bg-white p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#7e8798]">
            Target scope
          </p>
          <p className="mt-2 text-sm font-semibold text-[#344056]">
            {targetMetric
              ? `${targetMetric.label} · ${targetMetric.currentValue}`
              : "Unavailable target metric"}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {targetContexts.length > 0 ? (
              targetContexts.map((contextItem) => (
                <span
                  key={contextItem.id}
                  className="rounded-md bg-[#f2f4f8] px-2 py-1 text-[10px] font-semibold text-[#647087]"
                >
                  {contextItem.label}
                </span>
              ))
            ) : (
              <span className="text-xs text-[#8a94a6]">No matching context found.</span>
            )}
          </div>
        </section>
      </div>

      <section className="mt-4 rounded-lg border border-[#e7eaf0] bg-white p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#7e8798]">
          Required evidence
        </p>
        <div className="mt-3 space-y-3">
          {plan.requiredEvidence.map((requirement) => (
            <article
              key={requirement.id}
              className="flex flex-col justify-between gap-2 rounded-lg bg-[#fafbfc] p-3 sm:flex-row sm:items-start"
            >
              <div>
                <p className="text-xs font-medium leading-5 text-[#344056]">
                  {requirement.description}
                </p>
                <p className="mt-1 text-[11px] text-[#98a1b1]">
                  {requirement.evidenceReferenceIds.length > 0
                    ? `${requirement.evidenceReferenceIds.length} linked investigation evidence ${requirement.evidenceReferenceIds.length === 1 ? "reference" : "references"}`
                    : "New evidence must be collected"}
                </p>
              </div>
              <span className={`w-fit shrink-0 rounded-md px-2 py-1 text-[9px] font-bold uppercase tracking-[0.06em] ${evidenceStatusStyles[requirement.status]}`}>
                {requirement.status === "to-collect" ? "To collect" : "Available"}
              </span>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-4 rounded-lg border border-[#e7eaf0] bg-white p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#7e8798]">
          Checks
        </p>
        <ol className="mt-3 space-y-2">
          {plan.checks.map((check, index) => (
            <li key={check.id} className="flex gap-3 text-xs leading-5 text-[#5f6b80]">
              <span
                className="grid size-5 shrink-0 place-items-center rounded-full bg-[#edf1ff] text-[9px] font-bold text-[#3559e8]"
                aria-hidden="true"
              >
                {index + 1}
              </span>
              {check.description}
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-4" aria-label="Evaluation criteria">
        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#7e8798]">
          Evaluation criteria
        </p>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <article className="rounded-lg border border-[#dcebdd] bg-[#f7fcf8] p-4">
            <p className="text-xs font-semibold text-[#27714b]">Supports the hypothesis</p>
            <p className="mt-2 text-xs leading-5 text-[#4f6758]">
              {plan.evaluationCriteria.supportsHypothesis}
            </p>
          </article>
          <article className="rounded-lg border border-[#eadfca] bg-[#fffcf6] p-4">
            <p className="text-xs font-semibold text-[#92601b]">Weakens the hypothesis</p>
            <p className="mt-2 text-xs leading-5 text-[#6f624e]">
              {plan.evaluationCriteria.weakensHypothesis}
            </p>
          </article>
        </div>
      </section>
    </section>
  );
}
