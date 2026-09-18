import type { DiagnosticCase } from "@/lib/diagnostics/types";

type NextValidationProps = {
  actions: DiagnosticCase["nextValidations"];
};

export function NextValidation({ actions }: NextValidationProps) {
  return (
    <section
      className="mt-5 rounded-xl border border-[#dce3fb] bg-gradient-to-br from-[#f7f9ff] to-white p-4 sm:p-5 lg:mt-3 lg:p-[var(--card-padding-lg)]"
      aria-labelledby="next-validation-title"
    >
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#3559e8]">
            Step 1 · Choose a direction
          </p>
          <h2
            id="next-validation-title"
            className="mt-1 text-lg font-semibold tracking-[-0.025em] text-[#172033] lg:mt-0.5 lg:text-[13px]"
          >
            Recommended next actions
          </h2>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[#68758b] lg:mt-0.5 lg:text-[11px] lg:leading-4">
            Use these as investigation directions. They do not confirm a cause
            or execute analysis automatically.
          </p>
        </div>
        <span className="w-fit rounded-md border border-[#cfd8f7] bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#6072b8]">
          Ready for tool connection
        </span>
      </div>

      <ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:mt-2 lg:gap-2">
        {actions.map((action, index) => (
          <li
            key={action.id}
            className="rounded-lg border border-[#dfe4f2] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.02)] lg:p-2.5"
          >
            <div className="flex items-start gap-3 lg:gap-2">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#3559e8] text-xs font-bold text-white lg:size-6 lg:text-[10px]">
                {index + 1}
              </span>
              <div>
                <h3 className="text-sm font-semibold text-[#263247] lg:text-xs">
                  {action.label}
                </h3>
                <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.06em] text-[#8a94a6] lg:mt-1">
                  Purpose
                </p>
                <p className="mt-1 text-xs leading-5 text-[#657084] lg:text-[11px] lg:leading-4">
                  {action.description}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
