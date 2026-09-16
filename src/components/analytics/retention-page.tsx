"use client";

import { useState } from "react";

import {
  ANALYTICS_DIAGNOSTIC_HREF,
  type DemoAnalyticsResult,
} from "@/lib/analytics/demo-analytics";
import { buildAnalyticsInvestigationHref } from "@/lib/analytics/investigation-context";
import { buildRetentionDiagnosis } from "@/lib/analytics/retention-diagnosis-builder";
import { buildRetentionInvestigationContext } from "@/lib/analytics/retention-investigation-adapter";
import type { RetentionBreakdownDimensionPresentation } from "@/lib/analytics/retention-presentation";

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
  const presentationCohorts = cohorts.map((cohort) => ({
    id: `demo-cohort-${cohort.date}`,
    date: cohort.date,
    users: cohort.users,
    intervals: cohort.intervals,
  }));
  const presentationBreakdowns: RetentionBreakdownDimensionPresentation[] = [
    {
      id: "platform",
      label: "Platform",
      segments: retention.breakdowns.platform.map((segment) => ({
        id: `demo-platform-${segment.name.toLocaleLowerCase("en-US")}`,
        label: segment.name,
        users: segment.users,
        intervals: [
          { day: 1, users: Math.round((segment.users * segment.D1) / 100), rate: segment.D1 },
          { day: 7, users: Math.round((segment.users * segment.D7) / 100), rate: segment.D7 },
          { day: 30, users: Math.round((segment.users * segment.D30) / 100), rate: segment.D30 },
        ],
      })),
    },
    {
      id: "user-type",
      label: "User type",
      segments: retention.breakdowns.userType.map((segment) => ({
        id: `demo-user-type-${segment.name.toLocaleLowerCase("en-US")}`,
        label: segment.name,
        users: segment.users,
        intervals: [
          { day: 1, users: Math.round((segment.users * segment.D1) / 100), rate: segment.D1 },
          { day: 7, users: Math.round((segment.users * segment.D7) / 100), rate: segment.D7 },
          { day: 30, users: Math.round((segment.users * segment.D30) / 100), rate: segment.D30 },
        ],
      })),
    },
  ];
  const diagnosis = buildRetentionDiagnosis({
    breakdowns: presentationBreakdowns,
    severity:
      retention.diagnosis.severity === "low" ||
      retention.diagnosis.severity === "high"
        ? retention.diagnosis.severity
        : "medium",
    suggestedCheckTitles: retention.diagnosis.recommendation,
  });
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
        cohorts={presentationCohorts}
        period={definition.period}
        selectedInterval={selectedInterval}
        selectedCohortDate={selectedCohort?.date ?? null}
        onSelectCohort={setSelectedCohortDate}
      />

      <RetentionBreakdown breakdowns={presentationBreakdowns} />

      {diagnosis ? (
        <RetentionDiagnosis
          diagnosis={diagnosis}
          getInvestigationHref={(target) => {
            const primary = diagnosis.primaryEvidence;
            const d1 = primary.segment.retention.D1;
            const d30 = primary.segment.retention.D30;
            const baselineD1 = primary.benchmark.retention.D1;
            const baselineD30 = primary.benchmark.retention.D30;

            if (
              d1 === null ||
              d30 === null ||
              baselineD1 === null ||
              baselineD30 === null
            ) {
              return null;
            }

            const context = {
              ...buildRetentionInvestigationContext({
                cohort: selectedCohort ?? retention.current,
                selectedInterval,
                segment: {
                  dimension: primary.dimensionLabel,
                  selected: {
                    name: primary.segment.label,
                    users: primary.segment.users,
                    D1: d1,
                    D7: primary.segment.retention.D7,
                    D30: d30,
                  },
                  baseline: {
                    name: primary.benchmark.label,
                    users: 0,
                    D1: baselineD1,
                    D7: primary.benchmark.retention.D7,
                    D30: baselineD30,
                  },
                },
                baseline: retention.baselineIntervals,
                retentionValues:
                  (selectedCohort ?? retention.current).intervals,
                definition: retention.definition,
              }),
              investigationTarget: {
                id: target.id,
                title: target.title,
                relatedSegment: `${primary.dimensionLabel}: ${primary.segment.label}`,
                sourceSurface: "retention" as const,
              },
            };

            return buildAnalyticsInvestigationHref(
              ANALYTICS_DIAGNOSTIC_HREF,
              context,
              { returnTo: "/analytics/retention" },
            );
          }}
        />
      ) : null}
    </AnalyticsPageFrame>
  );
}
