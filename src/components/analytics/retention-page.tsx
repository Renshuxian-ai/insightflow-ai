"use client";

import { useState } from "react";

import type { DemoAnalyticsResult } from "@/lib/analytics/demo-analytics";

import {
  AnalyticsMetricGroup,
  type AnalyticsMetricGroupItem,
  AnalyticsPageFrame,
  AnalyticsSectionHeader,
} from "./analytics-page-frame";
import { RetentionBreakdown } from "./retention-breakdown";
import { RetentionCohortMatrix } from "./retention-cohort-matrix";
import { RetentionCurve } from "./retention-curve";
import { RetentionDiagnosis } from "./retention-diagnosis";

const RETENTION_INTERVALS = ["D0", "D1", "D3", "D7", "D14", "D30"] as const;

type RetentionInterval = (typeof RETENTION_INTERVALS)[number];

function isRetentionInterval(interval: string): interval is RetentionInterval {
  return RETENTION_INTERVALS.some((candidate) => candidate === interval);
}

function formatPercentage(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatChange(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)} pp`;
}

function formatUsers(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatDefinitionValue(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function RetentionPage({ analytics }: { analytics: DemoAnalyticsResult }) {
  const [selectedInterval, setSelectedInterval] =
    useState<RetentionInterval | null>(null);
  const [selectedCohortDate, setSelectedCohortDate] = useState<string | null>(
    null,
  );
  const { retention } = analytics;
  const { definition, summary, cohorts } = retention;
  const selectedCohort = selectedCohortDate
    ? cohorts.find((cohort) => cohort.date === selectedCohortDate) ?? null
    : null;
  const curveIntervals =
    selectedCohort?.intervals ?? retention.current.intervals;
  const definitionItems = [
    { label: "Event", value: definition.event },
    { label: "Returning event", value: definition.returningEvent },
    { label: "Period", value: formatDefinitionValue(definition.period) },
    { label: "Window", value: definition.window },
    { label: "Segment", value: definition.segment },
  ];
  const retentionMetrics: AnalyticsMetricGroupItem[] = [
    {
      label: "Current retention",
      value: formatPercentage(summary.currentRetention),
      detail: `Cohort ${summary.currentCohort}`,
      tone: "primary",
    },
    {
      label: "Baseline retention",
      value: formatPercentage(summary.previousRetention),
      detail: "Reference baseline",
    },
    {
      label: "Change",
      value: formatChange(summary.change),
      detail: "Current retention vs. baseline",
      tone: summary.change < 0 ? "negative" : "default",
    },
  ];
  const cohortMetrics: AnalyticsMetricGroupItem[] = [
    {
      label: "Cohort users",
      value: formatUsers(summary.cohortUsers),
      detail: `Entered ${summary.currentCohort}`,
    },
    {
      label: "Retained users",
      value: formatUsers(summary.retainedUsers),
      detail: "Users retained in the measured interval",
      tone: "primary",
    },
    {
      label: "Lost users",
      value: formatUsers(summary.lostUsers),
      detail: "Users not retained",
      tone: "negative",
    },
  ];

  return (
    <AnalyticsPageFrame
      title="Retention"
      description="Understand how user cohorts return over time and locate where retention weakens."
    >
      <section className="mt-6" aria-label="Retention definition">
        <AnalyticsSectionHeader
          title="Retention definition"
          meta="Analysis context"
        />
        <dl className="grid gap-2.5 rounded-xl border border-[#e7eaf0] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.02)] sm:grid-cols-2 lg:grid-cols-5">
          {definitionItems.map((item) => (
            <div
              key={item.label}
              className="min-w-0 rounded-lg bg-[#f7f8fa] px-3.5 py-3"
            >
              <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#98a1b1]">
                {item.label}
              </dt>
              <dd
                className="mt-1.5 truncate text-[13px] font-semibold text-[#344056]"
                title={item.value}
              >
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-6" aria-label="Primary retention signal">
        <AnalyticsSectionHeader
          title="Primary retention signal"
          meta="Current cohort vs. baseline"
        />
        <div className="space-y-3">
          <AnalyticsMetricGroup
            ariaLabel="Retention performance"
            items={retentionMetrics}
          />
          <AnalyticsMetricGroup
            ariaLabel="Current retention cohort users"
            items={cohortMetrics}
          />
        </div>
      </section>

      <RetentionCurve
        currentIntervals={curveIntervals}
        baselineIntervals={retention.baselineIntervals}
        selectedInterval={selectedInterval}
        selectedCohortDate={selectedCohort?.date ?? null}
        onSelectInterval={(interval) => {
          if (isRetentionInterval(interval)) {
            setSelectedInterval(interval);
          }
        }}
        onClearCohortSelection={() => setSelectedCohortDate(null)}
      />

      <RetentionCohortMatrix
        cohorts={cohorts}
        period={definition.period}
        selectedInterval={selectedInterval}
        selectedCohortDate={selectedCohort?.date ?? null}
        onSelectCohort={setSelectedCohortDate}
      />

      <RetentionBreakdown breakdowns={retention.breakdowns} />

      <RetentionDiagnosis
        diagnosis={retention.diagnosis}
        breakdowns={retention.breakdowns}
      />
    </AnalyticsPageFrame>
  );
}
