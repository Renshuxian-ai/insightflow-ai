import type { DiagnosticCase } from "@/lib/diagnostics/types";

type DiagnosticTraceProps = {
  traceSteps: DiagnosticCase["traceSteps"];
  source: DiagnosticCase["source"];
};

export function DiagnosticTrace({ traceSteps, source }: DiagnosticTraceProps) {
  const isDatasetCase = source === "dataset";

  return (
    <section aria-labelledby="diagnostic-trace-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#6072b8]">
            Diagnostic trace
          </p>
          <h3
            id="diagnostic-trace-title"
            className="mt-1 text-sm font-semibold text-[#263247]"
          >
            {isDatasetCase
              ? "How this anomaly was identified"
              : "Signals checked for this prototype case"}
          </h3>
          <p className="mt-1 text-xs leading-5 text-[#778196]">
            {isDatasetCase
              ? "A transparent record of the deterministic metric comparison."
              : "An illustrative sequence; no AI agent executed these steps."}
          </p>
        </div>
        <span className="rounded-md bg-[#edf1ff] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.06em] text-[#3559e8]">
          {isDatasetCase ? "Dataset calculated" : "Mock trace"}
        </span>
      </div>

      <ol className="mt-4 space-y-3">
        {traceSteps.map((step, index) => (
          <li key={step.id} className="relative flex gap-3">
            {index < traceSteps.length - 1 ? (
              <span
                className="absolute left-3 top-7 h-[calc(100%-8px)] w-px bg-[#dde2eb]"
                aria-hidden="true"
              />
            ) : null}
            <span
              className="relative z-10 grid size-6 shrink-0 place-items-center rounded-full bg-[#edf1ff] text-[10px] font-bold text-[#3559e8]"
              aria-hidden="true"
            >
              {index + 1}
            </span>
            <div className="min-w-0 flex-1 pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-sm font-semibold text-[#344056]">
                  {step.label}
                </h4>
                <span className="rounded-md bg-[#f2f4f8] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.06em] text-[#778196]">
                  {step.status === "mock-checked"
                    ? "Mock checked"
                    : "Calculated from dataset"}
                </span>
              </div>
              <p className="mt-1 text-xs leading-5 text-[#778196]">
                {step.description}
              </p>
              <p className="mt-1 text-[11px] text-[#98a1b1]">
                {step.evidenceIds.length} linked evidence item
                {step.evidenceIds.length === 1 ? "" : "s"}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
