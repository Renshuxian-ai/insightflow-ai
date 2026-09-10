import Link from "next/link";

import type { DiagnosticCase } from "@/lib/diagnostics/types";
import { formatDirectionalPercentageChange } from "@/lib/metric-formatters";

type DiagnosticHeaderProps = {
  diagnosticCase: DiagnosticCase;
};

export function DiagnosticHeader({ diagnosticCase }: DiagnosticHeaderProps) {
  const { context, metric } = diagnosticCase;
  const highSeverity = diagnosticCase.severity === "HIGH";

  return (
    <header className="border-b border-[#e6e9ef] pb-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#526078] transition-colors hover:text-[#3559e8] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#3559e8]"
      >
        <span aria-hidden="true">←</span>
        Back to Overview
      </Link>

      <div className="mt-5 flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={
                highSeverity
                  ? "inline-flex rounded-md bg-[#fff0f0] px-2 py-1 text-[10px] font-bold tracking-[0.08em] text-[#c44242]"
                  : "inline-flex rounded-md bg-[#fff6e4] px-2 py-1 text-[10px] font-bold tracking-[0.08em] text-[#a86713]"
              }
            >
              {diagnosticCase.severity}
            </span>
            <span className="inline-flex rounded-md border border-[#dce2ef] bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#6f7a8e]">
              Prototype diagnostic · Mock data
            </span>
          </div>

          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.1em] text-[#98a1b1]">
            AI Diagnostics
          </p>
          <h1 className="mt-1.5 text-[30px] font-semibold tracking-[-0.04em] text-[#172033] sm:text-[34px]">
            {diagnosticCase.title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6f7a8e]">
            Review the connected behavior and feedback signals before deciding what to validate next.
          </p>
        </div>

        <dl className="min-w-[260px] rounded-xl border border-[#e1e5ed] bg-white px-5 py-4 shadow-[0_1px_2px_rgba(16,24,40,0.02)]">
          <dt className="text-xs font-medium text-[#7e8798]">{metric.label}</dt>
          <dd className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-semibold tracking-[-0.03em] text-[#172033]">
              {metric.currentValue}
            </span>
            <span className="text-sm font-semibold text-[#c44242]">
              {formatDirectionalPercentageChange(metric.changeValue)}
            </span>
          </dd>
          <dd className="mt-1 text-xs text-[#98a1b1]">{metric.comparison}</dd>
        </dl>
      </div>

      <dl className="mt-5 flex flex-wrap gap-2" aria-label="Diagnostic context">
        {[
          ["Date range", context.dateRange.label],
          ["Segment", context.segment.label],
          ["Platform", context.platform.label],
          ["Version", context.version.label],
        ].map(([label, value]) => (
          <div
            key={label}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#e1e5ed] bg-white px-3 py-2 text-xs"
          >
            <dt className="text-[#98a1b1]">{label}</dt>
            <dd className="font-semibold text-[#46536a]">{value}</dd>
          </div>
        ))}
      </dl>
    </header>
  );
}
