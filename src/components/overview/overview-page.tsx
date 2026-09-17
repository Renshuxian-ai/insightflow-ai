"use client";

import { useDatasetWorkspaceSession } from "@/components/datasets/dataset-workspace-session";
import {
  createOverviewViewModel,
  type OverviewViewModel,
} from "@/lib/overview/overview-view-model";

import { AnomalyCard } from "./anomaly-card";
import { FeedbackTopicsCard } from "./feedback-topics-card";
import { KpiCard } from "./kpi-card";
import { OverviewFilters } from "./overview-filters";
import { ProductTrendCard } from "./product-trend-card";
import {
  RecentInvestigationsCard,
  type RecentInvestigationItem,
} from "./recent-investigations-card";
import { UserSegmentCard } from "./user-segment-card";
import { overviewScrollRegionClassName } from "./overview-scroll-region";

function OverviewStatusCard({ viewModel }: { viewModel: OverviewViewModel }) {
  const isLoading = viewModel.status === "loading";

  return (
    <section
      className="mt-6 rounded-xl border border-[#e3e7ee] bg-white px-5 py-8 shadow-[0_1px_2px_rgba(16,24,40,0.02)]"
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        {isLoading ? (
          <span
            className="size-4 animate-spin rounded-full border-2 border-[#d7ddeb] border-t-[#3559e8]"
            aria-hidden="true"
          />
        ) : null}
        <div>
          <h2 className="text-sm font-semibold text-[#344056]">
            {isLoading ? "Preparing analytics..." : "Analytics unavailable"}
          </h2>
          {!isLoading ? (
            <p className="mt-1 text-xs leading-5 text-[#7e8798]">
              {viewModel.error ?? "Dataset analytics could not be prepared."}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function OverviewPage({
  recentInvestigations,
}: {
  recentInvestigations: RecentInvestigationItem[];
}) {
  const {
    dataset,
    datasetName,
    datasetMode,
    overviewRuntime,
    overviewStatus,
    overviewError,
  } =
    useDatasetWorkspaceSession();
  const viewModel = createOverviewViewModel({
    overviewRuntime,
    overviewStatus,
    overviewError,
    datasetName: dataset?.file.originalFileName ?? datasetName,
    hasDataset: datasetMode,
  });

  return (
    <main id="overview" className="mx-auto w-full max-w-[1440px] px-5 py-7 sm:px-7 lg:px-10 lg:py-9">
      <div className="flex flex-col justify-between gap-5 border-b border-[#e6e9ef] pb-6 xl:flex-row xl:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[#7e8798]">
            <span>Workspace</span>
            <span aria-hidden="true">/</span>
            <span className="text-[#4e5a70]">Northstar</span>
            <span
              className={
                viewModel.mode === "demo"
                  ? "rounded-md bg-[#fff6e4] px-2 py-1 text-[10px] font-bold tracking-[0.08em] text-[#8a5b00]"
                  : "rounded-md bg-[#edf1ff] px-2 py-1 text-[10px] font-bold tracking-[0.08em] text-[#3559e8]"
              }
            >
              {viewModel.sourceLabel}
            </span>
          </div>
          <h1 className="mt-3 text-[28px] font-semibold tracking-[-0.04em] text-[#172033]">Overview</h1>
          <p className="mt-1.5 text-sm text-[#6f7a8e]">
            {viewModel.mode === "dataset" && viewModel.datasetName
              ? `Dataset: ${viewModel.datasetName}`
              : "A focused view of product health, emerging risks, and user signals."}
          </p>
        </div>
        {viewModel.mode === "demo" ? <OverviewFilters /> : null}
      </div>

      {viewModel.status !== "ready" ? (
        <OverviewStatusCard viewModel={viewModel} />
      ) : (
        <>
          <section className="mt-6" aria-label="Core product metrics">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#344056]">Core metrics</h2>
              <p className="text-xs text-[#98a1b1]">
                {viewModel.mode === "dataset"
                  ? "Calculated from uploaded data"
                  : "Updated 5 minutes ago"}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {viewModel.kpis.map((kpi) => <KpiCard key={kpi.label} kpi={kpi} />)}
            </div>
          </section>

          <section className="mt-6 grid gap-6 xl:grid-cols-3">
            <div className="xl:col-span-2">
              {viewModel.trend?.status === "available" ? (
                <ProductTrendCard
                  metricLabel={viewModel.trend.metricLabel}
                  latestValue={viewModel.trend.latestValue}
                  change={viewModel.trend.change}
                  changeDirection={viewModel.trend.changeDirection}
                  data={viewModel.trend.data}
                />
              ) : (
                <section className="h-[420px] rounded-xl border border-[#e7eaf0] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.02)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#98a1b1]">Product health</p>
                  <h2 className="mt-1 text-base font-semibold text-[#172033]">Product trend</h2>
                  <p className="mt-6 text-xl font-semibold text-[#687387]">Unavailable</p>
                  <p className="mt-2 text-xs leading-5 text-[#98a1b1]">
                    {viewModel.trend?.reason ?? "Daily DAU is not available."}
                  </p>
                </section>
              )}
            </div>
            <section className="flex h-[420px] min-h-0 flex-col rounded-xl border border-[#e7eaf0] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.02)]" aria-labelledby="anomalies-title">
              <div className="shrink-0">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#98a1b1]">Where to look next</p>
                <h2 id="anomalies-title" className="mt-1 text-base font-semibold tracking-[-0.02em] text-[#172033]">{viewModel.anomalyTitle}</h2>
                <p className="mt-1 text-[13px] text-[#778196]">{viewModel.anomalySummary}</p>
              </div>
              <div className={`mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-y-contain pr-1 ${overviewScrollRegionClassName}`}>
                {viewModel.anomalies.length > 0 ? (
                  viewModel.anomalies.map((anomaly) => (
                    <AnomalyCard key={anomaly.id} anomaly={anomaly} />
                  ))
                ) : (
                  <div className="rounded-lg border border-[#e9ecf1] bg-[#fafbfc] px-4 py-6 text-center">
                    <p className="text-sm font-semibold text-[#526078]">No anomaly detected</p>
                    <p className="mt-1 text-xs text-[#8a94a6]">The deterministic checks found no material decline.</p>
                  </div>
                )}
              </div>
            </section>
          </section>

          <section className="mt-6 grid gap-6 lg:grid-cols-2">
            {viewModel.mode === "dataset" ? (
              <RecentInvestigationsCard
                investigations={recentInvestigations}
              />
            ) : (
              <UserSegmentCard
                segments={
                  viewModel.userSegments.status === "available"
                    ? viewModel.userSegments.items
                    : []
                }
                unavailableReason={
                  viewModel.userSegments.status === "unavailable"
                    ? viewModel.userSegments.reason
                    : undefined
                }
              />
            )}
            <FeedbackTopicsCard
              topics={
                viewModel.feedbackTopics.status === "available"
                  ? viewModel.feedbackTopics.items
                  : []
              }
              unavailableReason={
                viewModel.feedbackTopics.status === "unavailable"
                  ? viewModel.feedbackTopics.reason
                  : undefined
              }
            />
          </section>
        </>
      )}
    </main>
  );
}
