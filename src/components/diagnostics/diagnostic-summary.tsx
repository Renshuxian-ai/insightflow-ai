import type { DiagnosticCase } from "@/lib/diagnostics/types";

type DiagnosticSummaryProps = {
  summary: DiagnosticCase["summary"];
};

const summaryItems = [
  { key: "changed", label: "What changed" },
  { key: "affected", label: "Who was affected" },
  { key: "started", label: "When it started" },
] as const;

export function DiagnosticSummary({ summary }: DiagnosticSummaryProps) {
  return (
    <section
      className="rounded-xl border border-[#e7eaf0] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.02)] sm:p-6"
      aria-labelledby="diagnostic-summary-title"
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#98a1b1]">At a glance</p>
        <h2
          id="diagnostic-summary-title"
          className="mt-1 text-base font-semibold tracking-[-0.02em] text-[#172033]"
        >
          Diagnostic summary
        </h2>
      </div>

      <dl className="mt-5 grid gap-4 md:grid-cols-3">
        {summaryItems.map((item, index) => (
          <div
            key={item.key}
            className={
              index === 0
                ? "rounded-lg bg-[#fafbfc] p-4"
                : "rounded-lg border-t border-[#eef0f4] bg-[#fafbfc] p-4 md:border-l md:border-t-0"
            }
          >
            <dt className="text-xs font-semibold text-[#7e8798]">{item.label}</dt>
            <dd className="mt-2 text-sm font-medium leading-6 text-[#344056]">{summary[item.key]}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
