import type { DiagnosticCase } from "@/lib/diagnostics/types";

type NextValidationProps = {
  actions: DiagnosticCase["nextValidations"];
};

export function NextValidation({ actions }: NextValidationProps) {
  return (
    <section
      className="mt-5 rounded-xl border border-[#dce3fb] bg-gradient-to-br from-[#f7f9ff] to-white p-4 sm:p-5"
      aria-labelledby="next-validation-title"
    >
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#3559e8]">
            Step 1 · Choose a direction
          </p>
          <h2
            id="next-validation-title"
            className="mt-1 text-lg font-semibold tracking-[-0.025em] text-[#172033]"
          >
            Recommended next actions
          </h2>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[#68758b]">
            Use these as investigation directions. They do not confirm a cause
            or execute analysis automatically.
          </p>
        </div>
        <span className="w-fit rounded-md border border-[#cfd8f7] bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#6072b8]">
          Ready for tool connection
        </span>
      </div>

      <ol className="mt-5 grid gap-3 sm:grid-cols-2">
        {actions.map((action, index) => (
          <li
            key={action.id}
            className="rounded-lg border border-[#dfe4f2] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.02)]"
          >
            <div className="flex items-start gap-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#3559e8] text-xs font-bold text-white">
                {index + 1}
              </span>
              <div>
                <h3 className="text-sm font-semibold text-[#263247]">
                  {action.label}
                </h3>
                <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.06em] text-[#8a94a6]">
                  Purpose
                </p>
                <p className="mt-1 text-xs leading-5 text-[#657084]">
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
