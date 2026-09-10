import type { DiagnosticCase } from "@/lib/diagnostics-mock-data";

type DiagnosticTraceProps = {
  traceSteps: DiagnosticCase["traceSteps"];
};

export function DiagnosticTrace({ traceSteps }: DiagnosticTraceProps) {
  return (
    <section aria-labelledby="diagnostic-trace-title">
      <details className="group rounded-xl border border-[#e7eaf0] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.02)]">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-xl px-5 py-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3559e8] sm:px-6 [&::-webkit-details-marker]:hidden">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2
                id="diagnostic-trace-title"
                className="text-base font-semibold tracking-[-0.02em] text-[#172033]"
              >
                Signals checked · Mock trace
              </h2>
              <span className="rounded-md bg-[#edf1ff] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#3559e8]">
                Prototype
              </span>
            </div>
            <p className="mt-1.5 text-xs leading-5 text-[#778196]">
              An illustrative sequence only. No AI agent or workflow engine executed these steps.
            </p>
          </div>
          <span
            className="grid size-8 shrink-0 place-items-center rounded-lg border border-[#e1e5ed] text-[#68758b] transition-transform group-open:rotate-180"
            aria-hidden="true"
          >
            ↓
          </span>
        </summary>

        <div className="border-t border-[#eef0f4] px-5 py-5 sm:px-6">
          <ol className="space-y-4">
            {traceSteps.map((step, index) => (
              <li key={step.id} className="relative flex gap-3">
                {index < traceSteps.length - 1 ? (
                  <span className="absolute left-3 top-7 h-[calc(100%-10px)] w-px bg-[#dde2eb]" aria-hidden="true" />
                ) : null}
                <span
                  className="relative z-10 grid size-6 shrink-0 place-items-center rounded-full bg-[#edf1ff] text-[10px] font-bold text-[#3559e8]"
                  aria-hidden="true"
                >
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1 pb-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-[#344056]">{step.label}</h3>
                    <span className="rounded-md bg-[#f2f4f8] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-[#778196]">
                      {step.status === "mock-checked" ? "Mock checked" : step.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-[#778196]">{step.description}</p>
                  <p className="mt-1 text-[11px] text-[#98a1b1]">
                    {step.evidenceIds.length} linked {step.evidenceIds.length === 1 ? "signal" : "signals"}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </details>
    </section>
  );
}
