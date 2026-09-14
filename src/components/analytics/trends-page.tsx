import Link from "next/link";

import { ProductTrendCard } from "@/components/overview/product-trend-card";
import type {
  AnalyticsAnomaly,
  AnalyticsMetricTrend,
  DemoAnalyticsResult,
} from "@/lib/analytics/demo-analytics";

import { AnalyticsPageFrame, AnalyticsSectionHeader } from "./analytics-page-frame";

function formatPercentage(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatChange(value: number | null) {
  if (value === null) {
    return "No comparison";
  }

  return `${value > 0 ? "+" : ""}${value.toFixed(1)} pp`;
}

function getChangeDirection(value: number | null) {
  if (value === null || value === 0) {
    return "neutral" as const;
  }

  return value > 0 ? ("positive" as const) : ("negative" as const);
}

function findPrimarySignal(anomalies: AnalyticsAnomaly[]) {
  const diagnosableSignal = anomalies.find(
    (anomaly) => anomaly.investigateHref,
  );

  if (diagnosableSignal) {
    return diagnosableSignal;
  }

  return anomalies.reduce<AnalyticsAnomaly | null>(
    (largest, anomaly) =>
      !largest || anomaly.change < largest.change ? anomaly : largest,
    null,
  );
}

function SignalCard({
  anomaly,
  trend,
}: {
  anomaly: AnalyticsAnomaly;
  trend: AnalyticsMetricTrend | undefined;
}) {
  return (
    <article className="rounded-lg border border-[#e9ecf1] p-4 transition-colors hover:border-[#d8def0]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <span className="inline-flex rounded-md bg-[#fff0f0] px-1.5 py-0.5 text-[10px] font-bold tracking-[0.08em] text-[#c44242]">
            DECLINE
          </span>
          <h3 className="mt-2 text-sm font-semibold tracking-[-0.01em] text-[#263247]">
            {anomaly.title}
          </h3>
        </div>
        {anomaly.investigateHref ? (
          <Link
            href={anomaly.investigateHref}
            className="shrink-0 text-xs font-semibold text-[#3559e8] transition-colors hover:text-[#2446cb]"
          >
            Investigate <span aria-hidden="true">→</span>
          </Link>
        ) : (
          <span className="shrink-0 text-xs font-medium text-[#a1a8b5]">
            Evidence only
          </span>
        )}
      </div>
      <p className="mt-3 text-sm font-semibold text-[#263247]">
        {formatPercentage(anomaly.current)}{" "}
        <span className="font-medium text-[#c44242]">
          {formatChange(anomaly.change)}
        </span>
      </p>
      <p className="mt-1 text-xs text-[#7e8798]">
        Previous: {formatPercentage(anomaly.previous)} · {anomaly.comparison}
      </p>
      <p className="mt-1.5 text-xs leading-5 text-[#7e8798]">
        Affected context: {trend?.current.segment ?? "All available data"}
      </p>
    </article>
  );
}

export function TrendsPage({ analytics }: { analytics: DemoAnalyticsResult }) {
  const primarySignal = findPrimarySignal(analytics.trends.anomalies);
  const primaryTrend =
    analytics.trends.metrics.find(
      (trend) => trend.label === primarySignal?.metricLabel,
    ) ??
    analytics.trends.metrics.find((trend) => trend.points.length > 1) ??
    analytics.trends.metrics[0];
  const supportingTrends = analytics.trends.metrics.filter(
    (trend) => trend.id !== primaryTrend?.id,
  );

  return (
    <AnalyticsPageFrame
      title="Trends"
      description="See where product metrics changed, then move supported signals into diagnosis."
    >
      <section className="mt-6" aria-labelledby="key-finding-title">
        <AnalyticsSectionHeader
          title="Key finding"
          meta="Calculated from metrics.csv"
        />
        <div className="grid overflow-hidden rounded-xl border border-[#e7eaf0] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.02)] sm:grid-cols-2 xl:grid-cols-4">
          <div className="px-4 py-4">
            <p className="text-[13px] font-medium text-[#657084]">
              Primary signal
            </p>
            <p
              id="key-finding-title"
              className="mt-2 text-lg font-semibold tracking-[-0.03em] text-[#172033]"
            >
              {primarySignal?.metricLabel ?? "No signal detected"}
            </p>
            <p className="mt-1 text-xs text-[#98a1b1]">
              {analytics.trends.anomalies.length} detected signal
              {analytics.trends.anomalies.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="border-t border-[#eef0f4] px-4 py-4 sm:border-l sm:border-t-0">
            <p className="text-[13px] font-medium text-[#657084]">Change</p>
            <p className="mt-2 text-lg font-semibold tracking-[-0.03em] text-[#c44242]">
              {primarySignal ? formatChange(primarySignal.change) : "—"}
            </p>
            <p className="mt-1 text-xs text-[#98a1b1]">
              {primarySignal?.comparison ?? "No comparison available"}
            </p>
          </div>
          <div className="border-t border-[#eef0f4] px-4 py-4 xl:border-l xl:border-t-0">
            <p className="text-[13px] font-medium text-[#657084]">Context</p>
            <p className="mt-2 text-lg font-semibold tracking-[-0.03em] text-[#172033]">
              {primaryTrend?.current.segment ?? "Not segmented"}
            </p>
            <p className="mt-1 text-xs text-[#98a1b1]">
              Latest observed segment
            </p>
          </div>
          <div className="border-t border-[#eef0f4] px-4 py-4 sm:border-l xl:border-t-0">
            <p className="text-[13px] font-medium text-[#657084]">
              Diagnosis status
            </p>
            <p className="mt-2 text-lg font-semibold tracking-[-0.03em] text-[#3559e8]">
              {primarySignal?.investigateHref ? "Available" : "Evidence only"}
            </p>
            <p className="mt-1 text-xs text-[#98a1b1]">
              {primarySignal?.investigateHref
                ? "AI-assisted investigation is ready"
                : "No linked diagnostic case"}
            </p>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <AnalyticsSectionHeader
            title="Primary trend evidence"
            meta="Current vs. previous observation"
          />
          {primaryTrend ? (
            <div className="[&_svg]:!h-[152px]">
              <ProductTrendCard
                metricLabel={`${primaryTrend.label} · ${primaryTrend.current.segment}`}
                latestValue={formatPercentage(primaryTrend.current.value)}
                change={formatChange(primaryTrend.change)}
                changeDirection={getChangeDirection(primaryTrend.change)}
                data={primaryTrend.points.map((point) => ({
                  label: point.date.slice(5),
                  value: point.value,
                }))}
              />
            </div>
          ) : null}
        </div>

        <div>
          <AnalyticsSectionHeader
            title="Detected signals"
            meta={`${analytics.trends.anomalies.length} found`}
          />
          <div className="rounded-xl border border-[#e7eaf0] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.02)]">
            <div className="space-y-3">
              {analytics.trends.anomalies.map((anomaly) => (
                <SignalCard
                  key={anomaly.id}
                  anomaly={anomaly}
                  trend={analytics.trends.metrics.find(
                    (trend) => trend.label === anomaly.metricLabel,
                  )}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6" aria-labelledby="supporting-evidence-title">
        <AnalyticsSectionHeader
          title="Supporting evidence"
          meta="Other observed metrics"
        />
        <div className="rounded-xl border border-[#e7eaf0] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.02)]">
          <div className="flex items-start justify-between gap-4">
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

          <div className="mt-4 divide-y divide-[#eef0f4]">
            {supportingTrends.map((trend) => (
              <article
                key={trend.id}
                className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <h3 className="truncate text-[13px] font-semibold text-[#344056]">
                    {trend.label}
                  </h3>
                  <p className="mt-0.5 truncate text-xs text-[#8a94a6]">
                    {trend.current.segment} · {trend.current.date}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-4 sm:text-right">
                  <div>
                    <p className="text-sm font-semibold text-[#263247]">
                      {formatPercentage(trend.current.value)}
                    </p>
                    <p
                      className={`mt-0.5 text-xs font-semibold ${
                        trend.change !== null && trend.change < 0
                          ? "text-[#c44242]"
                          : "text-[#8a94a6]"
                      }`}
                    >
                      {formatChange(trend.change)}
                    </p>
                  </div>
                  <span className="min-w-24 text-right text-[11px] text-[#98a1b1]">
                    {trend.previous ? "Comparison available" : "Current observation only"}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </AnalyticsPageFrame>
  );
}
