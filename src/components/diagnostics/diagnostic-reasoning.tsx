import type { DiagnosticCase } from "@/lib/diagnostics/types";

type DiagnosticReasoningProps = {
  reasoning: DiagnosticCase["reasoning"];
};

export function DiagnosticReasoning({ reasoning }: DiagnosticReasoningProps) {
  const levels = [
    {
      key: "observation" as const,
      label: "Observation",
      description: "Confirmed signal",
      marker: "O",
      markerClass: "bg-[#edf1ff] text-[#3559e8]",
      status: "Confirmed",
      statusClass: "bg-[#f2f4f8] text-[#647087]",
    },
    {
      key: "inference" as const,
      label: "Inference",
      description: "Evidence interpretation",
      marker: "I",
      markerClass: "bg-[#fff6e4] text-[#a86713]",
      status: reasoning.inference.status,
      statusClass: "bg-[#fff6e4] text-[#92601b]",
    },
    {
      key: "hypothesis" as const,
      label: "Hypothesis",
      description: "What to validate next",
      marker: "H",
      markerClass: "bg-[#f1edff] text-[#6c4bd1]",
      status: reasoning.hypothesis.status,
      statusClass: "bg-[#f1edff] text-[#6244bd]",
    },
  ];

  return (
    <section
      className="rounded-xl border border-[#e7eaf0] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.02)] sm:p-6 lg:p-[var(--card-padding-lg)]"
      aria-labelledby="diagnostic-reasoning-title"
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#3559e8] lg:text-[10px]">
          Analysis path
        </p>
        <h2
          id="diagnostic-reasoning-title"
          className="mt-1 text-lg font-semibold tracking-[-0.025em] text-[#172033] lg:mt-0.5 lg:text-[13px]"
        >
          Analysis Path
        </h2>
        <p className="mt-1.5 text-sm text-[#778196] lg:mt-0.5 lg:text-[11px] lg:leading-4">
          Observation is confirmed; inference and hypothesis still require
          human review and validation.
        </p>
      </div>

      <ol className="mt-5 grid gap-0 lg:mt-2 lg:grid-cols-3 lg:items-stretch">
        {levels.map((level, index) => {
          const item = reasoning[level.key];

          return (
            <li key={level.key} className="relative flex gap-3 lg:flex-col">
              {index < levels.length - 1 ? (
                <span
                  className="absolute left-[17px] top-9 h-[calc(100%-12px)] w-px bg-[#dde2eb] lg:left-auto lg:right-[-4px] lg:top-[17px] lg:h-px lg:w-8"
                  aria-hidden="true"
                />
              ) : null}
              <span
                className={`relative z-10 grid size-9 shrink-0 place-items-center rounded-lg text-xs font-bold lg:size-8 ${level.markerClass}`}
                aria-hidden="true"
              >
                {level.marker}
              </span>
              <article className="mb-3 min-w-0 flex-1 rounded-lg border border-[#e9ecf1] bg-[#fafbfc] p-4 lg:mr-3 lg:mb-0 lg:p-2.5">
                <div className="flex flex-col justify-between gap-2 xl:flex-row xl:items-start">
                  <div>
                    <h3 className="text-sm font-semibold text-[#263247] lg:text-xs">{level.label}</h3>
                    <p className="mt-0.5 text-xs text-[#8a94a6] lg:text-[11px]">{level.description}</p>
                  </div>
                  <span
                    className={`w-fit shrink-0 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-[0.06em] lg:px-1.5 lg:py-0.5 lg:text-[9px] ${level.statusClass}`}
                  >
                    {level.status}
                  </span>
                </div>
                <p className="mt-3 text-sm font-medium leading-6 text-[#344056] lg:mt-2 lg:text-xs lg:leading-4">
                  {item.statement}
                </p>
              </article>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
