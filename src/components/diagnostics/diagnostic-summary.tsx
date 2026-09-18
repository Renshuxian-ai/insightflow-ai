import type { DiagnosticCase } from "@/lib/diagnostics/types";

type DiagnosticSummaryProps = {
  diagnosticCase: DiagnosticCase;
};

export function DiagnosticSummary({
  diagnosticCase,
}: DiagnosticSummaryProps) {
  const nextAction = diagnosticCase.nextValidations[0];
  const summaryItems = [
    {
      label: "What happened",
      value: diagnosticCase.summary.changed,
      accent: "border-l-[#3559e8]",
    },
    {
      label: "What we know",
      value:
        diagnosticCase.source === "dataset"
          ? "The metric change is confirmed from deterministic calculation on the uploaded dataset."
          : "The metric change is supported by the evidence linked to this diagnostic case.",
      accent: "border-l-[#2e8b62]",
    },
    {
      label: "What we don't know",
      value:
        "The available evidence does not confirm why this change occurred.",
      accent: "border-l-[#c58a33]",
    },
    {
      label: "Recommended next",
      value: nextAction
        ? `${nextAction.label} — ${nextAction.description}`
        : "Review the available evidence before deciding what to validate.",
      accent: "border-l-[#6c4bd1]",
    },
  ];

  return (
    <section
      className="rounded-xl border border-[#dce3fb] bg-white p-5 shadow-[0_6px_20px_rgba(37,69,180,0.06)] sm:p-6 lg:p-3"
      aria-labelledby="diagnostic-summary-title"
    >
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start lg:gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#3559e8] lg:text-[10px]">
            AI Investigation Summary
          </p>
          <h2
            id="diagnostic-summary-title"
            className="mt-1 text-lg font-semibold tracking-[-0.025em] text-[#172033] lg:mt-0.5 lg:text-[13px]"
          >
            Start with the decision-relevant facts
          </h2>
        </div>
        <span className="w-fit rounded-md bg-[#eef8f2] px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.06em] text-[#27714b] lg:px-2 lg:py-1 lg:text-[9px]">
          Observation confirmed · Cause requires validation
        </span>
      </div>

      <dl className="mt-5 grid gap-3 md:grid-cols-2 lg:mt-2 lg:gap-2">
        {summaryItems.map((item) => (
          <div
            key={item.label}
            className={`rounded-lg border border-[#e8ebf1] border-l-[3px] bg-[#fafbfc] px-4 py-3.5 lg:px-2.5 lg:py-2 ${item.accent}`}
          >
            <dt className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#7e8798] lg:text-[10px]">
              {item.label}
            </dt>
            <dd className="mt-1.5 text-sm font-medium leading-6 text-[#344056] lg:mt-0.5 lg:text-xs lg:leading-4">
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
