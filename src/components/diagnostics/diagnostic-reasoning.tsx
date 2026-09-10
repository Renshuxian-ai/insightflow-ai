import type { DiagnosticCase } from "@/lib/diagnostics-mock-data";

type DiagnosticReasoningProps = {
  reasoning: DiagnosticCase["reasoning"];
};

export function DiagnosticReasoning({ reasoning }: DiagnosticReasoningProps) {
  const levels = [
    {
      key: "observation" as const,
      label: "Observation",
      description: "What the connected signals show",
      marker: "O",
      markerClass: "bg-[#edf1ff] text-[#3559e8]",
      status: "Evidence-backed statement",
      statusClass: "bg-[#f2f4f8] text-[#647087]",
    },
    {
      key: "inference" as const,
      label: "Inference",
      description: "A possible explanation, not a confirmed cause",
      marker: "I",
      markerClass: "bg-[#fff6e4] text-[#a86713]",
      status: reasoning.inference.status,
      statusClass: "bg-[#fff6e4] text-[#92601b]",
    },
    {
      key: "hypothesis" as const,
      label: "Hypothesis",
      description: "A testable idea for further validation",
      marker: "H",
      markerClass: "bg-[#f1edff] text-[#6c4bd1]",
      status: reasoning.hypothesis.status,
      statusClass: "bg-[#f1edff] text-[#6244bd]",
    },
  ];

  return (
    <section
      className="rounded-xl border border-[#e7eaf0] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.02)] sm:p-6"
      aria-labelledby="diagnostic-reasoning-title"
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#3559e8]">Reasoning</p>
        <h2
          id="diagnostic-reasoning-title"
          className="mt-1 text-lg font-semibold tracking-[-0.025em] text-[#172033]"
        >
          From observation to a testable hypothesis
        </h2>
        <p className="mt-1.5 text-sm text-[#778196]">
          Each level represents a different degree of certainty and should be reviewed separately.
        </p>
      </div>

      <ol className="mt-5 space-y-3">
        {levels.map((level, index) => {
          const item = reasoning[level.key];

          return (
            <li key={level.key} className="relative flex gap-4">
              {index < levels.length - 1 ? (
                <span
                  className="absolute left-[17px] top-9 h-[calc(100%-24px)] w-px bg-[#dde2eb]"
                  aria-hidden="true"
                />
              ) : null}
              <span
                className={`relative z-10 grid size-9 shrink-0 place-items-center rounded-lg text-xs font-bold ${level.markerClass}`}
                aria-hidden="true"
              >
                {level.marker}
              </span>
              <article className="min-w-0 flex-1 rounded-lg border border-[#e9ecf1] bg-[#fafbfc] p-4">
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                  <div>
                    <h3 className="text-sm font-semibold text-[#263247]">{level.label}</h3>
                    <p className="mt-0.5 text-xs text-[#8a94a6]">{level.description}</p>
                  </div>
                  <span
                    className={`w-fit shrink-0 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-[0.06em] ${level.statusClass}`}
                  >
                    {level.status}
                  </span>
                </div>
                <p className="mt-3 text-sm font-medium leading-6 text-[#344056]">{item.statement}</p>
                <p className="mt-3 text-[11px] font-medium text-[#98a1b1]">
                  Linked to {item.evidenceIds.length} supporting {item.evidenceIds.length === 1 ? "signal" : "signals"}
                </p>
              </article>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
