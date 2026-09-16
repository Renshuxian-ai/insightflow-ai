"use client";

import { useState } from "react";
import Link from "next/link";

import type { RetentionRuntime } from "@/lib/analytics/analytics-runtime";
import { buildAnalyticsInvestigationHref } from "@/lib/analytics/investigation-context";

import {
  AnalyticsMetricGroup,
  type AnalyticsMetricGroupItem,
  AnalyticsPageFrame,
  AnalyticsSectionHeader,
  AnalyticsStatus,
} from "./analytics-page-frame";
import { RetentionBreakdown } from "./retention-breakdown";
import { RetentionCohortMatrix } from "./retention-cohort-matrix";
import { RetentionCurve } from "./retention-curve";
import { RetentionDiagnosis } from "./retention-diagnosis";

type AvailableRetentionRuntime = Extract<
  RetentionRuntime,
  { status: "available" }
>;

function formatPercentage(value: number) {
  return `${value.toFixed(1)}%`;
}

export function DatasetRetentionPage({
  runtime,
}: {
  runtime: AvailableRetentionRuntime;
}) {
  const [selectedInterval, setSelectedInterval] = useState<string | null>(null);
  const [selectedCohortDate, setSelectedCohortDate] = useState<string | null>(
    null,
  );
  const primary =
    runtime.intervals.find(
      (interval) => interval.label === runtime.primaryInterval,
    ) ?? runtime.intervals[0]!;
  const context = runtime.investigationContext;
  const selectedCohort = selectedCohortDate
    ? runtime.cohorts?.find((cohort) => cohort.date === selectedCohortDate) ?? null
    : null;
  const href = context
    ? buildAnalyticsInvestigationHref(
        `/ai-diagnostics/${encodeURIComponent(context.signalId)}`,
        context,
        { returnTo: "/analytics/retention" },
      )
    : null;
  const currentIntervals = selectedCohort?.intervals ??
    runtime.intervals.map((interval) => ({
      day: interval.day,
      rate: interval.currentRate,
      users: interval.currentRetainedUsers,
    }));
  const baselineIntervals = runtime.intervals.map((interval) => ({
    day: interval.day,
    rate: interval.baselineRate,
    users: interval.baselineRetainedUsers,
  }));
  const diagnosisPrimary = runtime.diagnosis?.primaryEvidence ?? null;
  const retentionMetrics: AnalyticsMetricGroupItem[] = diagnosisPrimary
    ? [
        {
          label: `D7 · ${diagnosisPrimary.segment.label}`,
          value: formatPercentage(diagnosisPrimary.segment.retention.D7),
          detail: `${diagnosisPrimary.segment.users.toLocaleString("en-US")} affected users`,
          tone: "primary",
        },
        {
          label: `D7 · ${diagnosisPrimary.benchmark.label}`,
          value: formatPercentage(diagnosisPrimary.benchmark.retention.D7),
          detail: `${diagnosisPrimary.dimensionLabel} benchmark`,
        },
        {
          label: "Gap",
          value: `${diagnosisPrimary.d7Gap.toFixed(1)} pp`,
          detail: "Observed segment difference",
          tone: "negative",
        },
      ]
    : [
        {
          label: `${primary.label} current`,
          value: formatPercentage(primary.currentRate),
          detail: `${primary.currentRetainedUsers.toLocaleString("en-US")} retained users`,
          tone: "primary",
        },
        {
          label: `${primary.label} baseline`,
          value: formatPercentage(primary.baselineRate),
          detail: `${primary.baselineRetainedUsers.toLocaleString("en-US")} retained users`,
        },
        {
          label: "Gap",
          value: `${primary.gapPercentagePoints > 0 ? "+" : ""}${primary.gapPercentagePoints.toFixed(1)} pp`,
          detail: "Current window vs. baseline window",
          tone: primary.gapPercentagePoints < 0 ? "negative" : "default",
        },
      ];

  return (
    <AnalyticsPageFrame
      title="Retention"
      description="Compare observed retention windows without substituting demo cohorts."
      sourceLabel="UPLOADED DATASET"
    >
      <section className="mt-6" aria-label="Retention definition">
        <AnalyticsSectionHeader
          title="Retention definition"
          meta="Estimated dataset windows"
        />
        <dl className="grid gap-2.5 rounded-xl border border-[#e7eaf0] bg-white p-4 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ["Metric", runtime.definition.metricField],
            ["Interval", runtime.definition.retentionDayField],
            ["Date", runtime.definition.dateField],
            ["User", runtime.definition.userIdentifierField],
            ["Method", "Latest half vs. previous half"],
          ].map(([label, value]) => (
            <div key={label} className="min-w-0 rounded-lg bg-[#f7f8fa] px-3.5 py-3">
              <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#98a1b1]">
                {label}
              </dt>
              <dd className="mt-1.5 truncate text-[13px] font-semibold text-[#344056]" title={value}>
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-6" aria-label="Primary retention signal">
        <div className="flex items-center justify-between gap-3">
          <AnalyticsSectionHeader
            title="Primary retention signal"
            meta={
              diagnosisPrimary
                ? `${diagnosisPrimary.dimensionLabel} · D7 comparison`
                : `${runtime.currentWindow.start} to ${runtime.currentWindow.end}`
            }
          />
          {href ? (
            <Link
              href={href}
              className="mb-2.5 inline-flex h-9 items-center rounded-lg bg-[#3559e8] px-3.5 text-xs font-semibold text-white hover:bg-[#2446cb]"
            >
              Investigate <span aria-hidden="true" className="ml-1">→</span>
            </Link>
          ) : null}
        </div>
        <AnalyticsMetricGroup
          ariaLabel="Retention comparison"
          items={retentionMetrics}
        />
      </section>

      <RetentionCurve
        currentIntervals={currentIntervals}
        baselineIntervals={baselineIntervals}
        selectedInterval={selectedInterval}
        selectedCohortDate={selectedCohort?.date ?? null}
        onSelectInterval={setSelectedInterval}
        onClearCohortSelection={() => setSelectedCohortDate(null)}
      />

      {runtime.cohorts ? (
        <RetentionCohortMatrix
          cohorts={runtime.cohorts}
          period="observed"
          selectedInterval={selectedInterval}
          selectedCohortDate={selectedCohort?.date ?? null}
          onSelectCohort={setSelectedCohortDate}
        />
      ) : (
        <section className="mt-6" aria-label="Unavailable cohort evidence">
          <AnalyticsStatus
            title="Cohort analysis unavailable"
            description="This dataset does not contain an explicit cohort identity required to build independently observed cohort rows."
          />
        </section>
      )}

      {runtime.breakdowns ? (
        <RetentionBreakdown breakdowns={runtime.breakdowns} />
      ) : (
        <section className="mt-6" aria-label="Unavailable segment evidence">
          <AnalyticsStatus
            title="Segment breakdown unavailable"
            description="No comparable platform or user type retention evidence was found in the uploaded dataset."
          />
        </section>
      )}

      {runtime.diagnosis ? (
        <RetentionDiagnosis
          diagnosis={runtime.diagnosis}
          getInvestigationHref={(target) => {
            if (!context) {
              return null;
            }

            const primaryEvidence = runtime.diagnosis!.primaryEvidence;
            const segmentContext = {
              ...context,
              investigationTarget: {
                id: target.id,
                title: target.title,
                relatedSegment: `${primaryEvidence.dimensionLabel}: ${primaryEvidence.segment.label}`,
                sourceSurface: "retention" as const,
              },
            };

            return buildAnalyticsInvestigationHref(
              `/ai-diagnostics/${encodeURIComponent(segmentContext.signalId)}`,
              segmentContext,
              { returnTo: "/analytics/retention" },
            );
          }}
        />
      ) : runtime.breakdowns ? (
        <section className="mt-6" aria-label="Unavailable retention diagnosis">
          <AnalyticsStatus
            title="Retention diagnosis unavailable"
            description="At least two segments with comparable D7 retention evidence are required for diagnosis."
          />
        </section>
      ) : null}

    </AnalyticsPageFrame>
  );
}
