"use client";

import Link from "next/link";
import { useState } from "react";

import { overviewScrollRegionClassName } from "@/components/overview/overview-scroll-region";
import { buildAnalyticsInvestigationHref } from "@/lib/analytics/investigation-context";
import type {
  TrendRuntime,
  TrendRuntimeChangeType,
  TrendRuntimeMetric,
  TrendRuntimeMetricUnit,
  TrendRuntimeSignal,
} from "@/lib/analytics/trend-runtime";
import { DATASET_PRIMARY_ANOMALY_ID } from "@/lib/diagnostics/dataset-diagnostic-case";

import { AnalyticsPageFrame, AnalyticsSectionHeader } from "./analytics-page-frame";
import { TrendEvidenceVisualization } from "./trend-evidence-visualization";

type AvailableTrendRuntime = Extract<TrendRuntime, { status: "available" }>;

export type TrendsPageData = Pick<
  AvailableTrendRuntime,
  "metrics" | "signals" | "unavailableEvidence"
>;

function formatValue(value: number, unit: TrendRuntimeMetricUnit) {
  if (unit === "percentage") {
    return `${value.toFixed(1)}%`;
  }

  return `${value.toLocaleString("en-US", { maximumFractionDigits: 1 })}${
    unit === "mentions" ? " mentions" : ""
  }`;
}

function formatChange(
  value: number | null,
  type: TrendRuntimeChangeType,
  unit: TrendRuntimeMetricUnit,
) {
  if (value === null) {
    return "No comparison";
  }

  const sign = value > 0 ? "+" : "";

  if (type === "percentage-points") {
    return `${sign}${value.toFixed(1)} pp`;
  }

  if (type === "relative-percent") {
    return `${sign}${value.toFixed(1)}%`;
  }

  return `${sign}${value.toLocaleString("en-US", {
    maximumFractionDigits: 1,
  })}${unit === "mentions" ? " mentions" : ""}`;
}

function isInvestigatable(
  signal: TrendRuntimeSignal,
  investigationHrefs: Record<string, string>,
) {
  return Boolean(
    signal.investigationContext || investigationHrefs[signal.id],
  );
}

function findPrimarySignal(
  signals: TrendRuntimeSignal[],
  investigationHrefs: Record<string, string>,
) {
  return (
    signals.find((signal) => isInvestigatable(signal, investigationHrefs)) ??
    signals[0]
  );
}

function rankSignals(
  signals: TrendRuntimeSignal[],
  investigationHrefs: Record<string, string>,
) {
  return signals
    .map((signal, runtimeIndex) => ({ signal, runtimeIndex }))
    .sort((left, right) => {
      const investigationPriority =
        Number(isInvestigatable(right.signal, investigationHrefs)) -
        Number(isInvestigatable(left.signal, investigationHrefs));

      return investigationPriority || left.runtimeIndex - right.runtimeIndex;
    })
    .map(({ signal }) => signal);
}

function rankSupportingTrends(
  trends: TrendRuntimeMetric[],
  primarySurface?: TrendRuntimeMetric["surface"],
) {
  return trends
    .map((trend, runtimeIndex) => ({ trend, runtimeIndex }))
    .sort((left, right) => {
      const surfacePriority =
        Number(right.trend.surface === primarySurface) -
        Number(left.trend.surface === primarySurface);

      return surfacePriority || left.runtimeIndex - right.runtimeIndex;
    })
    .map(({ trend }) => trend);
}

function getSurfaceLabel(surface: TrendRuntimeMetric["surface"]) {
  return {
    activity: "Activity",
    retention: "Retention",
    funnel: "Funnel",
    feedback: "Feedback",
  }[surface];
}

function getInvestigationHref(signal: TrendRuntimeSignal) {
  if (!signal.investigationContext) {
    return null;
  }

  return buildAnalyticsInvestigationHref(
    `/ai-diagnostics/${DATASET_PRIMARY_ANOMALY_ID}`,
    signal.investigationContext,
    { returnTo: "/analytics/trends" },
  );
}

function SignalCard({
  signal,
  investigationHref,
  primary = false,
  selected = false,
  onSelect,
}: {
  signal: TrendRuntimeSignal;
  investigationHref?: string | null;
  primary?: boolean;
  selected?: boolean;
  onSelect: () => void;
}) {
  const investigateHref = investigationHref ?? getInvestigationHref(signal);
  const negative = signal.direction === "decline" || signal.change > 0;

  return (
    <article
      className={`relative overflow-hidden rounded-lg border transition-colors ${
        selected
          ? "border-[#9bace8] bg-[#f5f7ff]"
          : primary
            ? "border-[#d8def0] bg-[#fbfcff] hover:border-[#bdc8e8]"
            : "border-[#e9ecf1] bg-white hover:border-[#d8def0]"
      }`}
    >
      <button
        type="button"
        aria-pressed={selected}
        aria-label={`View evidence for ${signal.title}`}
        onClick={onSelect}
        className="block w-full cursor-pointer p-3 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#3559e8]/40"
      >
        <div className="min-w-0 pr-20">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex rounded-md bg-[#fff0f0] px-1.5 py-0.5 text-[10px] font-bold tracking-[0.08em] text-[#c44242]">
              {signal.direction === "decline" ? "DECLINE" : "INCREASE"}
            </span>
            {primary ? (
              <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#526fca]">
                Primary
              </span>
            ) : selected ? (
              <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#526fca]">
                Selected
              </span>
            ) : null}
          </div>
          <h3 className="mt-1.5 line-clamp-2 text-[13px] font-semibold leading-[18px] tracking-[-0.01em] text-[#263247]">
            {signal.title}
          </h3>
        </div>
        <p className="mt-2 text-sm font-semibold text-[#263247]">
          {formatValue(signal.current, signal.unit)}{" "}
          <span
            className={
              negative
                ? "font-medium text-[#c44242]"
                : "font-medium text-[#168251]"
            }
          >
            {formatChange(signal.change, signal.changeType, signal.unit)}
          </span>
        </p>
        <p className="mt-1 truncate text-[11px] text-[#8a94a6]">
          Previous: {formatValue(signal.previous, signal.unit)} · {signal.comparison}
        </p>
        <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-[#8a94a6]">
          Evidence context: {signal.contextLabel}
        </p>
      </button>
      {investigateHref ? (
        <Link
          href={investigateHref}
          aria-label={`Investigate ${signal.title}`}
          className="absolute top-3 right-3 z-10 text-xs font-semibold text-[#3559e8] transition-colors hover:text-[#2446cb] focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3559e8]/30"
        >
          Investigate <span aria-hidden="true">→</span>
        </Link>
      ) : (
        <span className="absolute top-3 right-3 text-xs font-medium text-[#a1a8b5]">
          Evidence only
        </span>
      )}
    </article>
  );
}

export function TrendsPage({
  runtime,
  mode = "dataset",
  investigationHrefs = {},
}: {
  runtime: TrendsPageData;
  mode?: "dataset" | "demo";
  investigationHrefs?: Record<string, string>;
}) {
  const primarySignal = findPrimarySignal(runtime.signals, investigationHrefs);
  const [selectedSignalId, setSelectedSignalId] = useState<string | null>(
    primarySignal?.id ?? null,
  );
  const selectedSignal =
    runtime.signals.find((signal) => signal.id === selectedSignalId) ??
    primarySignal;
  const selectedMetric = runtime.metrics.find(
    (metric) => metric.id === selectedSignal?.metricId,
  );
  const rankedSignals = rankSignals(runtime.signals, investigationHrefs);
  const supportingTrends = rankSupportingTrends(
    runtime.metrics.filter((trend) => trend.id !== selectedMetric?.id),
    selectedMetric?.surface,
  );
  const hasSelectedInvestigation = selectedSignal
    ? isInvestigatable(selectedSignal, investigationHrefs)
    : false;

  return (
    <AnalyticsPageFrame
      title="Trends"
      description="See where product metrics changed, then move supported signals into diagnosis."
      sourceLabel={mode === "demo" ? "DEMO DATA" : "UPLOADED DATASET"}
    >
      <section className="mt-6" aria-labelledby="key-finding-title">
        <AnalyticsSectionHeader
          title="Key finding"
          meta={
            mode === "demo"
              ? "Calculated from demo metrics"
              : "Calculated from uploaded dataset evidence"
          }
        />
        <div className="grid overflow-hidden rounded-xl border border-[#e7eaf0] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.02)] sm:grid-cols-2 xl:grid-cols-4">
          <div className="px-4 py-4">
            <p className="text-[13px] font-medium text-[#657084]">
              Signal
            </p>
            <p
              id="key-finding-title"
              className="mt-2 text-lg font-semibold tracking-[-0.03em] text-[#172033]"
            >
              {selectedSignal?.title ?? "No signal detected"}
            </p>
            <p className="mt-1 text-xs text-[#98a1b1]">
              {runtime.signals.length} detected signal
              {runtime.signals.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="border-t border-[#eef0f4] px-4 py-4 sm:border-l sm:border-t-0">
            <p className="text-[13px] font-medium text-[#657084]">Change</p>
            <p className="mt-2 text-lg font-semibold tracking-[-0.03em] text-[#c44242]">
              {selectedSignal
                ? formatChange(
                    selectedSignal.change,
                    selectedSignal.changeType,
                    selectedSignal.unit,
                  )
                : "—"}
            </p>
            <p className="mt-1 text-xs text-[#98a1b1]">
              {selectedSignal?.comparison ?? "No comparison available"}
            </p>
          </div>
          <div className="border-t border-[#eef0f4] px-4 py-4 xl:border-l xl:border-t-0">
            <p className="text-[13px] font-medium text-[#657084]">Context</p>
            <p className="mt-2 text-lg font-semibold tracking-[-0.03em] text-[#172033]">
              {selectedMetric?.contextLabel ?? "Not available"}
            </p>
            <p className="mt-1 text-xs text-[#98a1b1]">
              {mode === "demo" ? "Demo evidence scope" : "Dataset evidence scope"}
            </p>
          </div>
          <div className="border-t border-[#eef0f4] px-4 py-4 sm:border-l xl:border-t-0">
            <p className="text-[13px] font-medium text-[#657084]">
              Diagnosis status
            </p>
            <p className="mt-2 text-lg font-semibold tracking-[-0.03em] text-[#3559e8]">
              {hasSelectedInvestigation ? "Available" : "Evidence only"}
            </p>
            <p className="mt-1 text-xs text-[#98a1b1]">
              {hasSelectedInvestigation
                ? mode === "demo"
                  ? "Demo investigation is ready"
                  : "Dataset-backed investigation is ready"
                : "No supported DiagnosticCase for this signal"}
            </p>
          </div>
        </div>
      </section>

      <section className="mt-6 grid items-start gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <AnalyticsSectionHeader
            title="Signal evidence"
            meta={mode === "demo" ? "Demo evidence" : "Observed dataset values"}
          />
          {selectedSignal && selectedMetric ? (
            <TrendEvidenceVisualization
              signal={selectedSignal}
              metric={selectedMetric}
            />
          ) : (
            <div className="h-[448px] rounded-xl border border-[#e7eaf0] bg-white p-5 text-sm text-[#8a94a6]">
              Signal evidence is unavailable.
            </div>
          )}
        </div>

        <div>
          <AnalyticsSectionHeader
            title="Detected signals"
            meta={`${runtime.signals.length} found`}
          />
          <div className="flex h-[448px] min-h-0 flex-col rounded-xl border border-[#e7eaf0] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.02)]">
            <div
              className={`min-h-0 flex-1 overflow-y-auto pr-2 ${overviewScrollRegionClassName}`}
            >
              <div className="space-y-2.5">
                {rankedSignals.length > 0 ? (
                  rankedSignals.map((signal) => (
                    <SignalCard
                      key={signal.id}
                      signal={signal}
                      investigationHref={investigationHrefs[signal.id]}
                      primary={signal.id === primarySignal?.id}
                      selected={signal.id === selectedSignal?.id}
                      onSelect={() => setSelectedSignalId(signal.id)}
                    />
                  ))
                ) : (
                  <div className="rounded-lg bg-[#fafbfc] px-4 py-6 text-center">
                    <p className="text-sm font-semibold text-[#526078]">
                      No anomaly detected
                    </p>
                    <p className="mt-1 text-xs text-[#8a94a6]">
                      Available comparisons do not contain a supported adverse signal.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6" aria-labelledby="supporting-evidence-title">
        <AnalyticsSectionHeader
          title="Supporting evidence"
          meta="Other observed metrics"
        />
        <div className="flex h-[392px] min-h-0 flex-col rounded-xl border border-[#e7eaf0] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.02)]">
          <div className="flex shrink-0 items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#98a1b1]">
                Related movement
              </p>
              <h2
                id="supporting-evidence-title"
                className="mt-1 text-base font-semibold tracking-[-0.02em] text-[#172033]"
              >
                Additional metric context
              </h2>
            </div>
            <span className="text-xs text-[#98a1b1]">
              {supportingTrends.length} metrics
            </span>
          </div>

          <div
            className={`mt-3 min-h-0 flex-1 overflow-y-auto pr-2 ${overviewScrollRegionClassName}`}
          >
            <div className="divide-y divide-[#eef0f4]">
              {supportingTrends.map((trend: TrendRuntimeMetric) => (
              <article
                key={trend.id}
                className="flex min-h-[54px] flex-col gap-1.5 py-2.5 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <h3 className="truncate text-[13px] font-semibold text-[#344056]">
                      {trend.label}
                    </h3>
                    <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#98a1b1]">
                      {getSurfaceLabel(trend.surface)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-[#8a94a6]">
                    {trend.contextLabel} · {trend.current.label}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3 sm:text-right">
                  <div>
                    <p className="text-sm font-semibold text-[#263247]">
                      {formatValue(trend.current.value, trend.unit)}
                    </p>
                    <p
                      className={`mt-0.5 text-xs font-semibold ${
                        trend.change !== null && trend.change < 0
                          ? "text-[#c44242]"
                          : "text-[#8a94a6]"
                      }`}
                    >
                      {formatChange(trend.change, trend.changeType, trend.unit)}
                    </p>
                  </div>
                  {!trend.previous ? (
                    <span className="rounded-md bg-[#f4f5f7] px-1.5 py-0.5 text-[10px] font-medium text-[#98a1b1]">
                      No comparison
                    </span>
                  ) : null}
                </div>
              </article>
              ))}
            </div>
            {runtime.unavailableEvidence.length > 0 ? (
              <div className="mt-4 border-t border-[#eef0f4] pt-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#98a1b1]">
                  Unavailable evidence
                </p>
                <ul className="mt-2 space-y-1 text-xs leading-5 text-[#8a94a6]">
                  {runtime.unavailableEvidence.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </AnalyticsPageFrame>
  );
}
