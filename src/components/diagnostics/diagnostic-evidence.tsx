import type { DiagnosticCase } from "@/lib/diagnostics/types";

type DiagnosticEvidenceProps = {
  diagnosticCase: DiagnosticCase;
};

const contextLabels: Record<keyof DiagnosticCase["context"], string> = {
  dateRange: "Period",
  segment: "Segment",
  platform: "Platform",
  version: "Version",
};

export function DiagnosticEvidence({
  diagnosticCase,
}: DiagnosticEvidenceProps) {
  const { context, evidence, metric, source } = diagnosticCase;
  const isDatasetCase = source === "dataset";
  const availableContext = Object.entries(context).filter(
    ([, item]) => item.label !== "Not segmented",
  ) as Array<[keyof DiagnosticCase["context"], (typeof context)[keyof typeof context]]>;
  const limitations = [
    evidence.feedbackSignals.length === 0 ? "No feedback evidence" : null,
    context.segment.label === "Not segmented" ? "No segment breakdown" : null,
    context.platform.label === "Not segmented" ? "No platform breakdown" : null,
    context.version.label === "Not segmented" ? "No version breakdown" : null,
  ].filter((item): item is string => Boolean(item));

  return (
    <section
      className="rounded-xl border border-[#e7eaf0] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.02)] sm:p-6 lg:p-3"
      aria-labelledby="diagnostic-evidence-title"
    >
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#3559e8] lg:text-[10px]">
            Evidence
          </p>
          <h2
            id="diagnostic-evidence-title"
            className="mt-1 text-lg font-semibold tracking-[-0.025em] text-[#172033] lg:mt-0.5 lg:text-[13px]"
          >
            Evidence supporting this finding
          </h2>
        </div>
        <p className="text-xs text-[#8a94a6] lg:text-[11px]">
          {isDatasetCase
            ? "Calculated from the uploaded dataset."
            : "Connected behavior and feedback signals."}
        </p>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3 lg:mt-2 lg:gap-2" aria-label="Evidence summary">
        <article className="rounded-lg border border-[#dfe4f2] bg-[#f8f9ff] p-4 lg:p-2.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#6072b8]">
            Metric evidence
          </p>
          <p className="mt-2 text-sm font-semibold text-[#263247] lg:mt-0.5 lg:text-xs">
            {metric.currentValue}
            {metric.previousValue ? ` vs ${metric.previousValue}` : ""}
          </p>
          <p className="mt-1 text-xs leading-5 text-[#778196] lg:mt-0.5 lg:text-[11px] lg:leading-4">
            {metric.comparison}
          </p>
        </article>

        <article className="rounded-lg border border-[#d9ebe1] bg-[#f5fbf7] p-4 lg:p-2.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#51806a]">
            {isDatasetCase
              ? "Dataset calculation evidence"
              : "Connected signal evidence"}
          </p>
          <p className="mt-2 text-sm font-semibold text-[#315b48] lg:mt-0.5 lg:text-xs">
            {evidence.behaviorSignals.length} quantitative signal
            {evidence.behaviorSignals.length === 1 ? "" : "s"}
          </p>
          <p className="mt-1 text-xs leading-5 text-[#668171] lg:mt-0.5 lg:text-[11px] lg:leading-4">
            {isDatasetCase
              ? "Deterministic metric calculations completed."
              : `${evidence.feedbackSignals.length} qualitative signal${
                  evidence.feedbackSignals.length === 1 ? "" : "s"
                } also available.`}
          </p>
        </article>

        <article className="rounded-lg border border-[#e3e7ee] bg-[#fafbfc] p-4 lg:p-2.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#7e8798]">
            Available context / limitations
          </p>
          <p className="mt-2 text-sm font-semibold text-[#526078] lg:mt-0.5 lg:text-xs">
            {availableContext.map(([, item]) => item.label).join(" · ") ||
              "No additional context"}
          </p>
          <p className="mt-1 text-xs leading-5 text-[#778196] lg:mt-0.5 lg:text-[11px] lg:leading-4">
            {limitations.length > 0
              ? limitations.join(" · ")
              : "No missing evidence is identified in this case."}
          </p>
        </article>
      </div>

      <details className="group mt-4 rounded-lg border border-[#e7eaf0] bg-[#fafbfc] lg:mt-2">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-4 py-3.5 text-sm font-semibold text-[#465268] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3559e8] lg:px-2.5 lg:py-2 lg:text-xs [&::-webkit-details-marker]:hidden">
          <span>View all evidence</span>
          <span
            className="text-base text-[#7e8798] transition-transform group-open:rotate-180"
            aria-hidden="true"
          >
            ↓
          </span>
        </summary>

        <div className="grid gap-4 border-t border-[#e7eaf0] p-4 lg:gap-3 lg:p-3 xl:grid-cols-2">
          <div className="rounded-lg border border-[#e7eaf0] bg-white p-4 lg:p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#98a1b1]">
                  Quantitative
                </p>
                <h3 className="mt-1 text-sm font-semibold text-[#263247]">
                  Behavior signals
                </h3>
              </div>
              <span className="rounded-md bg-[#edf1ff] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.06em] text-[#3559e8]">
                {isDatasetCase ? "Deterministic evidence" : "Mock data"}
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {evidence.behaviorSignals.map((signal) => (
                <article
                  key={signal.id}
                  className="rounded-lg border border-[#e9ecf1] bg-[#fafbfc] p-4 lg:p-3"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-medium text-[#7e8798]">
                        {signal.label}
                      </p>
                      <p className="mt-1 text-sm font-semibold leading-6 text-[#263247]">
                        {signal.finding}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-md bg-white px-2 py-1 text-sm font-semibold text-[#c44242] shadow-[inset_0_0_0_1px_#e7eaf0]">
                      {signal.value}
                    </span>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-[#778196]">
                    {signal.detail}
                  </p>
                  <p className="mt-3 text-[11px] font-medium text-[#98a1b1]">
                    Source: {signal.source}
                  </p>
                </article>
              ))}
            </div>
          </div>

          {evidence.feedbackSignals.length > 0 ? (
            <div className="rounded-lg border border-[#e7eaf0] bg-white p-4 lg:p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#98a1b1]">
                    Qualitative
                  </p>
                  <h3 className="mt-1 text-sm font-semibold text-[#263247]">
                    Feedback signals
                  </h3>
                </div>
                <span className="rounded-md bg-[#edf1ff] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.06em] text-[#3559e8]">
                  {isDatasetCase ? "Uploaded dataset" : "Mock data"}
                </span>
              </div>

              <div className="mt-4 space-y-3">
                {evidence.feedbackSignals.map((signal) => (
                  <article
                    key={signal.id}
                    className="rounded-lg border border-[#e9ecf1] bg-[#fafbfc] p-4 lg:p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-sm font-semibold text-[#263247]">
                          {signal.topic}
                        </h4>
                        <span className="rounded-md bg-[#fff0f0] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.06em] text-[#c44242]">
                          {signal.sentiment}
                        </span>
                      </div>
                      <span className="text-sm font-semibold text-[#c44242]">
                        {signal.change}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-[#778196]">
                      {signal.finding}
                    </p>
                    {signal.snippets.length > 0 ? (
                      <div
                        className="mt-3 space-y-2"
                        aria-label={`Feedback excerpts for ${signal.topic}`}
                      >
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
                    <p className="mt-3 text-[11px] font-medium text-[#98a1b1]">
                      Source: {signal.source}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          ) : null}

          <div className="rounded-lg border border-[#e7eaf0] bg-white p-4 lg:p-3 xl:col-span-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#98a1b1]">
              Context used
            </p>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {availableContext.map(([key, item]) => (
                <div key={item.id}>
                  <dt className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#98a1b1]">
                    {contextLabels[key]}
                  </dt>
                  <dd className="mt-1 text-xs font-medium text-[#526078]">
                    {item.label}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </details>
    </section>
  );
}
