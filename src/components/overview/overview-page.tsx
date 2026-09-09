import {
  anomalies,
  feedbackTopics,
  overviewKpis,
  productTrend,
  userSegments,
} from "@/lib/overview-mock-data";

import { AnomalyCard } from "./anomaly-card";
import { FeedbackTopicsCard } from "./feedback-topics-card";
import { KpiCard } from "./kpi-card";
import { OverviewFilters } from "./overview-filters";
import { ProductTrendCard } from "./product-trend-card";
import { UserSegmentCard } from "./user-segment-card";

export function OverviewPage() {
  return (
    <main id="overview" className="mx-auto w-full max-w-[1440px] px-5 py-7 sm:px-7 lg:px-10 lg:py-9">
      <div className="flex flex-col justify-between gap-5 border-b border-[#e6e9ef] pb-6 xl:flex-row xl:items-end">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-[#7e8798]">
            <span>Workspace</span>
            <span aria-hidden="true">/</span>
            <span className="text-[#4e5a70]">Northstar</span>
          </div>
          <h1 className="mt-3 text-[28px] font-semibold tracking-[-0.04em] text-[#172033]">Overview</h1>
          <p className="mt-1.5 text-sm text-[#6f7a8e]">A focused view of product health, emerging risks, and user signals.</p>
        </div>
        <OverviewFilters />
      </div>

      <section className="mt-6" aria-label="Core product metrics">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#344056]">Core metrics</h2>
          <p className="text-xs text-[#98a1b1]">Updated 5 minutes ago</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {overviewKpis.map((kpi) => <KpiCard key={kpi.label} kpi={kpi} />)}
        </div>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <ProductTrendCard data={productTrend} />
        </div>
        <section className="rounded-xl border border-[#e7eaf0] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.02)]" aria-labelledby="anomalies-title">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#98a1b1]">Where to look next</p>
              <h2 id="anomalies-title" className="mt-1 text-base font-semibold tracking-[-0.02em] text-[#172033]">AI anomalies</h2>
              <p className="mt-1 text-[13px] text-[#778196]">3 signals worth investigating</p>
            </div>
            <span className="grid size-8 place-items-center rounded-lg bg-[#edf1ff] text-[#3559e8]" aria-hidden="true">✦</span>
          </div>
          <div className="mt-4 space-y-3">
            {anomalies.map((anomaly) => <AnomalyCard key={anomaly.title} anomaly={anomaly} />)}
          </div>
        </section>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <UserSegmentCard segments={userSegments} />
        <FeedbackTopicsCard topics={feedbackTopics} />
      </section>
    </main>
  );
}
