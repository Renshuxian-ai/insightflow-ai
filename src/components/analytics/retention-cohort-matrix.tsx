"use client";

import { useEffect, useRef } from "react";

import type { DemoAnalyticsResult } from "@/lib/analytics/demo-analytics";

import { AnalyticsSectionHeader } from "./analytics-page-frame";

type RetentionCohort = DemoAnalyticsResult["retention"]["cohorts"][number];

type RetentionCohortMatrixProps = {
  cohorts: RetentionCohort[];
  period: string;
  selectedInterval?: string | null;
  selectedCohortDate?: string | null;
  onSelectCohort?: (cohortDate: string) => void;
};

function formatPercentage(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatUsers(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function getRetentionCellTone(rate: number) {
  if (rate >= 75) {
    return "border-[#cfd9fb] bg-[#eef2ff] text-[#294bbf]";
  }

  if (rate >= 50) {
    return "border-[#dbe2f3] bg-[#f3f6fc] text-[#435675]";
  }

  if (rate >= 30) {
    return "border-[#e3e7ef] bg-[#f7f8fb] text-[#5c687b]";
  }

  return "border-[#eceef2] bg-[#fafafa] text-[#7b8493]";
}

export function RetentionCohortMatrix({
  cohorts,
  period,
  selectedInterval = null,
  selectedCohortDate = null,
  onSelectCohort,
}: RetentionCohortMatrixProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const intervalHeaderRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const intervalDays =
    cohorts[0]?.intervals.map((interval) => interval.day) ?? [];
  const matrixColumns = `184px repeat(${intervalDays.length}, 104px)`;

  useEffect(() => {
    if (!selectedInterval) {
      return;
    }

    const container = scrollContainerRef.current;
    const header = intervalHeaderRefs.current[selectedInterval];

    if (!container || !header) {
      return;
    }

    const containerBounds = container.getBoundingClientRect();
    const headerBounds = header.getBoundingClientRect();
    const targetLeft =
      container.scrollLeft +
      (headerBounds.left - containerBounds.left) -
      (container.clientWidth - headerBounds.width) / 2;
    const maxScrollLeft = container.scrollWidth - container.clientWidth;

    container.scrollTo({
      left: Math.max(0, Math.min(targetLeft, maxScrollLeft)),
      behavior: "smooth",
    });
  }, [selectedInterval]);

  return (
    <section className="mt-6" aria-label="Retention cohort matrix">
      <AnalyticsSectionHeader
        title="Retention cohort matrix"
        meta={`${cohorts.length} ${period} cohorts`}
      />
      <div className="min-w-0 rounded-xl border border-[#e7eaf0] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.02)]">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#98a1b1]">
              Cohort evidence
            </p>
            <h2 className="mt-1 text-base font-semibold tracking-[-0.02em] text-[#172033]">
              Retention by interval
            </h2>
            <p className="mt-1 text-[13px] text-[#778196]">
              Each cell shows the share of the starting cohort retained.
            </p>
          </div>
          <p className="text-[11px] text-[#98a1b1]">
            Rate · retained users
          </p>
        </div>

        <div
          ref={scrollContainerRef}
          className="mt-4 block w-full min-w-0 max-w-full overflow-x-auto overflow-y-hidden pb-2"
        >
          <div
            className="w-max min-w-max"
            role="table"
            aria-label="Retention by cohort and interval"
          >
            <div
              className="grid gap-2 border-b border-[#eef0f4] px-1 pb-2"
              role="row"
              style={{ gridTemplateColumns: matrixColumns }}
            >
              <div
                className="px-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-[#98a1b1]"
                role="columnheader"
              >
                Cohort
              </div>
              {intervalDays.map((day) => {
                const interval = `D${day}`;
                const isSelected = selectedInterval === interval;

                return (
                  <div
                    key={day}
                    ref={(element) => {
                      intervalHeaderRefs.current[interval] = element;
                    }}
                    className={`rounded-md py-1 text-center text-[11px] font-semibold transition-colors ${
                      isSelected
                        ? "bg-[#eef2ff] text-[#3559e8]"
                        : "text-[#657084]"
                    }`}
                    role="columnheader"
                    aria-selected={isSelected}
                  >
                    {interval}
                  </div>
                );
              })}
            </div>

            <div className="divide-y divide-[#f0f2f5]" role="rowgroup">
              {cohorts.map((cohort) => (
                <div
                  key={cohort.date}
                  className="group grid cursor-pointer gap-2 rounded-xl px-1 py-2 outline-none transition-colors hover:bg-[#f8faff] focus-visible:bg-[#f8faff] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#9fb0f5] data-[selected=true]:bg-[#eef2ff] data-[selected=true]:ring-1 data-[selected=true]:ring-inset data-[selected=true]:ring-[#cfd9fb]"
                  data-selected={selectedCohortDate === cohort.date}
                  role="row"
                  tabIndex={0}
                  aria-selected={selectedCohortDate === cohort.date}
                  style={{ gridTemplateColumns: matrixColumns }}
                  onClick={() => onSelectCohort?.(cohort.date)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelectCohort?.(cohort.date);
                    }
                  }}
                >
                  <div
                    className="flex h-16 min-w-0 flex-col justify-center rounded-lg bg-[#f7f8fa] px-3 transition-colors group-hover:bg-[#eef2f8]"
                    role="rowheader"
                  >
                    <p className="truncate text-[13px] font-semibold text-[#344056]">
                      {cohort.date}
                    </p>
                    <p className="mt-1 text-[11px] text-[#8a94a6]">
                      {formatUsers(cohort.users)} users
                    </p>
                  </div>
                  {cohort.intervals.map((interval) => {
                    const isSelected =
                      selectedInterval === `D${interval.day}`;

                    return (
                      <div
                        key={interval.day}
                        className={`flex h-16 flex-col items-center justify-center rounded-lg border transition-[border-color,box-shadow] group-hover:border-[#cfd8e6] ${getRetentionCellTone(interval.rate)} ${
                          isSelected
                            ? "ring-1 ring-inset ring-[#8fa4f4]"
                            : ""
                        }`}
                        role="cell"
                        data-selected={isSelected}
                      >
                        <p className="text-[13px] font-semibold">
                          {formatPercentage(interval.rate)}
                        </p>
                        <p className="mt-1 text-[10px] opacity-70">
                          {formatUsers(interval.users)} users
                        </p>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
