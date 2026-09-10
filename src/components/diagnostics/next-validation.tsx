import type { DiagnosticCase } from "@/lib/diagnostics-mock-data";

type NextValidationProps = {
  actions: DiagnosticCase["nextValidations"];
};

export function NextValidation({ actions }: NextValidationProps) {
  return (
    <section
      className="rounded-xl border border-[#dce3fb] bg-[#f8f9ff] p-5 shadow-[0_1px_2px_rgba(16,24,40,0.02)] sm:p-6"
      aria-labelledby="next-validation-title"
    >
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#3559e8]">Next validation</p>
          <h2
            id="next-validation-title"
            className="mt-1 text-lg font-semibold tracking-[-0.025em] text-[#172033]"
          >
            Turn the hypothesis into an investigation
          </h2>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[#68758b]">
            These prototype actions show where a product manager could continue. No analytics or experiment workflow is connected yet.
          </p>
        </div>
        <span className="w-fit rounded-md border border-[#cfd8f7] bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#6072b8]">
          Prototype only
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            disabled
            className="cursor-not-allowed rounded-lg border border-[#dfe4f2] bg-white p-4 text-left opacity-75"
          >
            <span className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-[#344056]">{action.label}</span>
              <span className="rounded-md bg-[#f2f4f8] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.06em] text-[#7e8798]">
                Planned
              </span>
            </span>
            <span className="mt-2 block text-xs leading-5 text-[#778196]">{action.description}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
