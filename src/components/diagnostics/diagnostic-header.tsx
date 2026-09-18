import Link from "next/link";

import type { DiagnosticCase } from "@/lib/diagnostics/types";
import type { DiagnosticReturnTarget } from "@/lib/diagnostics/diagnostic-navigation";
import { formatDirectionalPercentageChange } from "@/lib/metric-formatters";

type DiagnosticHeaderProps = {
  diagnosticCase: DiagnosticCase;
  sourceLabel?: string;
  returnTarget: DiagnosticReturnTarget;
};

export function DiagnosticHeader({
  diagnosticCase,
  sourceLabel,
  returnTarget,
}: DiagnosticHeaderProps) {
  const { context, metric } = diagnosticCase;
  const highSeverity = diagnosticCase.severity === "HIGH";
  const isDatasetCase = diagnosticCase.source === "dataset";
  const datasetChange =
    metric.changeType === "percentage-points"
      ? `${metric.changeValue > 0 ? "↑" : metric.changeValue < 0 ? "↓" : "→"} ${Math.abs(metric.changeValue).toFixed(1)} pp`
      : formatDirectionalPercentageChange(metric.changeValue);

  return (
    <header className="border-b border-[#e6e9ef] pb-6 lg:pb-3">
      <Link
        href={returnTarget.href}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#526078] transition-colors hover:text-[#3559e8] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#3559e8] lg:text-xs"
      >
        <span aria-hidden="true">←</span>
        Back to {returnTarget.label}
      </Link>

      {isDatasetCase ? (
        <div className="mt-5 max-w-5xl lg:mt-3 lg:max-w-none">
          <div className="flex flex-wrap items-center gap-2 lg:gap-1.5">
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
              {sourceLabel
                ? `Source: ${sourceLabel}`
                : "Dataset diagnostic · Uploaded dataset"}
            </span>
          </div>

          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.1em] text-[#98a1b1] lg:mt-2 lg:text-[10px]">
            AI Diagnostics
          </p>
          <h1 className="mt-1.5 text-[30px] font-semibold tracking-[-0.04em] text-[#172033] sm:text-[34px] lg:text-[21px] lg:leading-7">
            {diagnosticCase.title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6f7a8e] lg:mt-1 lg:text-[13px] lg:leading-[18px]">
            Review the deterministic metric evidence before deciding what to
            analyze next.
          </p>

          <dl className="mt-5 grid overflow-hidden rounded-xl border border-[#e1e5ed] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.02)] sm:grid-cols-2 lg:mt-3 lg:grid-cols-4">
            {[
              ["Current", metric.currentValue],
              ["Previous", metric.previousValue ?? "Not available"],
              [
                "Change",
                datasetChange,
              ],
              ["Comparison", metric.comparison],
            ].map(([label, value], index) => (
              <div
                key={label}
                className={`px-4 py-4 sm:px-5 lg:px-2.5 lg:py-2.5 ${index > 0 ? "border-t border-[#edf0f4] sm:border-l sm:border-t-0" : ""}`}
              >
                <dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#98a1b1] lg:text-[11px]">
                  {label}
                </dt>
                <dd
                  className={`mt-1.5 font-semibold lg:mt-1 ${label === "Change" ? "text-[#c44242]" : "text-[#263247]"} ${label === "Comparison" ? "text-sm leading-5 lg:text-[13px] lg:leading-[18px]" : "text-xl tracking-[-0.03em] lg:text-[21px] lg:leading-7"}`}
                >
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : (
        <div className="mt-5 flex flex-col justify-between gap-5 lg:mt-3 lg:gap-3 xl:flex-row xl:items-end">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2 lg:gap-1.5">
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

            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.1em] text-[#98a1b1] lg:mt-2 lg:text-[10px]">
              AI Diagnostics
            </p>
            <h1 className="mt-1.5 text-[30px] font-semibold tracking-[-0.04em] text-[#172033] sm:text-[34px] lg:text-[21px] lg:leading-7">
              {diagnosticCase.title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6f7a8e] lg:mt-1 lg:text-[13px] lg:leading-[18px]">
              Review the connected behavior and feedback signals before
              deciding what to validate next.
            </p>
          </div>

          <dl className="min-w-[260px] rounded-xl border border-[#e1e5ed] bg-white px-5 py-4 shadow-[0_1px_2px_rgba(16,24,40,0.02)] lg:min-w-[200px] lg:px-2.5 lg:py-2.5">
            <dt className="text-xs font-medium text-[#7e8798] lg:text-[11px]">{metric.label}</dt>
            <dd className="mt-1 flex items-baseline gap-2 lg:gap-1.5">
              <span className="text-2xl font-semibold tracking-[-0.03em] text-[#172033] lg:text-[21px]">
                {metric.currentValue}
              </span>
              <span className="text-sm font-semibold text-[#c44242] lg:text-[11px]">
                {formatDirectionalPercentageChange(metric.changeValue)}
              </span>
            </dd>
            <dd className="mt-1 text-xs text-[#98a1b1] lg:text-[11px]">
              {metric.comparison}
            </dd>
          </dl>
        </div>
      )}

      <dl className="mt-5 flex flex-wrap gap-2 lg:mt-3 lg:gap-1.5" aria-label="Diagnostic context">
        {[
          ["Date range", context.dateRange.label],
          ["Segment", context.segment.label],
          ["Platform", context.platform.label],
          ["Version", context.version.label],
        ].map(([label, value]) => (
          <div
            key={label}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#e1e5ed] bg-white px-3 py-2 text-xs lg:px-2.5 lg:py-1.5 lg:text-[11px] lg:leading-4"
          >
            <dt className="text-[#98a1b1]">{label}</dt>
            <dd className="font-semibold text-[#46536a]">{value}</dd>
          </div>
        ))}
      </dl>
    </header>
  );
}
