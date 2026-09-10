import type { DiagnosticCase } from "@/lib/diagnostics/types";

type DiagnosticEvidenceProps = {
  evidence: DiagnosticCase["evidence"];
};

export function DiagnosticEvidence({ evidence }: DiagnosticEvidenceProps) {
  return (
    <section aria-labelledby="diagnostic-evidence-title">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#3559e8]">Evidence</p>
          <h2
            id="diagnostic-evidence-title"
            className="mt-1 text-lg font-semibold tracking-[-0.025em] text-[#172033]"
          >
            Signals behind the anomaly
          </h2>
        </div>
        <p className="text-xs text-[#8a94a6]">Behavior and feedback are the supporting evidence.</p>
      </div>

      <div className="mt-4 grid gap-5 xl:grid-cols-2">
        <div className="rounded-xl border border-[#e7eaf0] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.02)] sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#98a1b1]">Quantitative</p>
              <h3 className="mt-1 text-base font-semibold tracking-[-0.02em] text-[#172033]">
                Behavior signals
              </h3>
            </div>
            <span className="rounded-md bg-[#edf1ff] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#3559e8]">
              Mock data
            </span>
          </div>

          <div className="mt-5 space-y-3">
            {evidence.behaviorSignals.map((signal) => (
              <article key={signal.id} className="rounded-lg border border-[#e9ecf1] bg-[#fafbfc] p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium text-[#7e8798]">{signal.label}</p>
                    <p className="mt-1 text-sm font-semibold leading-6 text-[#263247]">{signal.finding}</p>
                  </div>
                  <span className="shrink-0 rounded-md bg-white px-2 py-1 text-sm font-semibold text-[#c44242] shadow-[inset_0_0_0_1px_#e7eaf0]">
                    {signal.value}
                  </span>
                </div>
                <p className="mt-3 text-xs leading-5 text-[#778196]">{signal.detail}</p>
                <p className="mt-3 text-[11px] font-medium text-[#98a1b1]">Source: {signal.source}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-[#e7eaf0] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.02)] sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#98a1b1]">Qualitative</p>
              <h3 className="mt-1 text-base font-semibold tracking-[-0.02em] text-[#172033]">
                Feedback signals
              </h3>
            </div>
            <span className="rounded-md bg-[#edf1ff] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#3559e8]">
              Mock data
            </span>
          </div>

          <div className="mt-5 space-y-3">
            {evidence.feedbackSignals.map((signal) => (
              <article key={signal.id} className="rounded-lg border border-[#e9ecf1] bg-[#fafbfc] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-semibold text-[#263247]">{signal.topic}</h4>
                    <span className="rounded-md bg-[#fff0f0] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-[#c44242]">
                      {signal.sentiment}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-[#c44242]">{signal.change}</span>
                </div>
                <p className="mt-2 text-xs leading-5 text-[#778196]">{signal.finding}</p>

                {signal.snippets.length > 0 ? (
                  <div className="mt-3 space-y-2" aria-label={`Mock feedback excerpts for ${signal.topic}`}>
                    {signal.snippets.map((snippet) => (
                      <blockquote
                        key={snippet}
                        className="border-l-2 border-[#cfd7f5] pl-3 text-xs italic leading-5 text-[#5f6b80]"
                      >
                        “{snippet}”
                      </blockquote>
                    ))}
                  </div>
                ) : null}

                <p className="mt-3 text-[11px] font-medium text-[#98a1b1]">Source: {signal.source}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
