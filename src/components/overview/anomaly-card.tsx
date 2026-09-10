import Link from "next/link";

import type { Anomaly } from "@/lib/overview-mock-data";

type AnomalyCardProps = {
  anomaly: Anomaly;
};

export function AnomalyCard({ anomaly }: AnomalyCardProps) {
  const highSeverity = anomaly.severity === "HIGH";

  return (
    <article className="rounded-lg border border-[#e9ecf1] p-4 transition-colors hover:border-[#d8def0]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className={highSeverity ? "inline-flex rounded-md bg-[#fff0f0] px-1.5 py-0.5 text-[10px] font-bold tracking-[0.08em] text-[#c44242]" : "inline-flex rounded-md bg-[#fff6e4] px-1.5 py-0.5 text-[10px] font-bold tracking-[0.08em] text-[#a86713]"}>
            {anomaly.severity}
          </span>
          <h3 className="mt-2 text-sm font-semibold tracking-[-0.01em] text-[#263247]">{anomaly.title}</h3>
        </div>
        {anomaly.diagnosticAvailable ? (
          <Link
            href={`/ai-diagnostics/${anomaly.id}`}
            className="shrink-0 text-xs font-semibold text-[#3559e8] transition-colors hover:text-[#2446cb]"
          >
            Investigate <span aria-hidden="true">→</span>
          </Link>
        ) : (
          <button
            type="button"
            disabled
            title="Diagnostic case planned"
            className="shrink-0 cursor-not-allowed text-xs font-semibold text-[#a1a8b5]"
          >
            Investigate <span aria-hidden="true">→</span>
          </button>
        )}
      </div>
      <p className="mt-3 text-sm font-semibold text-[#263247]">
        {anomaly.metric} <span className="font-medium text-[#c44242]">{anomaly.change}</span>
      </p>
      <p className="mt-1.5 text-xs leading-5 text-[#7e8798]">{anomaly.context}</p>
    </article>
  );
}
