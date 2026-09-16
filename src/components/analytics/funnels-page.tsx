"use client";

import { Fragment, useState } from "react";
import Link from "next/link";

import {
  ANALYTICS_DIAGNOSTIC_HREF,
  type DemoAnalyticsResult,
} from "@/lib/analytics/demo-analytics";
import { buildFunnelInvestigationContext } from "@/lib/analytics/funnel-investigation-adapter";
import { buildAnalyticsInvestigationHref } from "@/lib/analytics/investigation-context";

import { AnalyticsPageFrame, AnalyticsSectionHeader } from "./analytics-page-frame";
import { AnimatedFunnelPercentage } from "./animated-funnel-percentage";
import styles from "./funnel-journey-track.module.css";
import {
  getFunnelConversionFillStyle,
  getJourneyItemDelay,
  getJourneyMotionStyle,
} from "./funnel-journey-motion";

function formatPercentage(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatDelta(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)} pp`;
}

export function FunnelsPage({ analytics }: { analytics: DemoAnalyticsResult }) {
  const [activeStageIndex, setActiveStageIndex] = useState<number | null>(null);
  const { funnel } = analytics;
  const largestDropOff = funnel.stages.find((stage) => stage.isLargestDropOff);
  const comparisonDelta = largestDropOff
    ? largestDropOff.currentCompletionRate -
      largestDropOff.previousCompletionRate
    : null;
  const investigationContext = largestDropOff
    ? buildFunnelInvestigationContext({ funnel, stage: largestDropOff })
    : null;
  const diagnosticHref = investigationContext
    ? buildAnalyticsInvestigationHref(
        ANALYTICS_DIAGNOSTIC_HREF,
        investigationContext,
        { returnTo: "/analytics/funnels" },
      )
    : null;

  return (
    <AnalyticsPageFrame
      title="Funnels"
      description="Compare the onboarding journey and identify the exact step where users drop away."
    >
      <section className="mt-6" aria-labelledby="primary-funnel-signal-title">
        <AnalyticsSectionHeader
          title="Primary funnel signal"
          meta={`${funnel.currentVersion} vs. ${funnel.previousVersion}`}
        />
        <article className="rounded-xl border border-[#e7eaf0] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.02)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <span className="inline-flex rounded-md bg-[#fff0f0] px-1.5 py-0.5 text-[10px] font-bold tracking-[0.08em] text-[#c44242]">
                BIGGEST DROP-OFF
              </span>
              <h2
                id="primary-funnel-signal-title"
                className="mt-2 text-lg font-semibold tracking-[-0.03em] text-[#172033]"
              >
                {largestDropOff
                  ? `${largestDropOff.label} is the primary friction point`
                  : "No material funnel drop-off detected"}
              </h2>
              <p className="mt-1 text-[13px] leading-5 text-[#778196]">
                {largestDropOff
                  ? `${largestDropOff.dropOffUsers} users were lost after the previous step in ${funnel.currentVersion}.`
                  : "The available funnel steps do not contain a primary loss point."}
              </p>
            </div>
            <span
              className={
                diagnosticHref
                  ? "w-fit shrink-0 rounded-md bg-[#edf1ff] px-2 py-1 text-[10px] font-bold tracking-[0.08em] text-[#3559e8]"
                  : "w-fit shrink-0 rounded-md bg-[#f1f3f6] px-2 py-1 text-[10px] font-bold tracking-[0.08em] text-[#687387]"
              }
            >
              {diagnosticHref ? "DIAGNOSIS AVAILABLE" : "EVIDENCE ONLY"}
            </span>
          </div>

          <div className="mt-4 grid gap-3 border-t border-[#eef0f4] pt-4 sm:grid-cols-2 xl:grid-cols-5">
            <div>
              <p className="text-xs font-medium text-[#8a94a6]">
                Current completion
              </p>
              <p className="mt-1 text-base font-semibold text-[#263247]">
                {largestDropOff
                  ? formatPercentage(largestDropOff.currentCompletionRate)
                  : "—"}
              </p>
              <p className="mt-0.5 text-[11px] text-[#98a1b1]">
                {largestDropOff?.currentUsers ?? 0} of {funnel.currentEntryUsers} users
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-[#8a94a6]">
                Previous completion
              </p>
              <p className="mt-1 text-base font-semibold text-[#263247]">
                {largestDropOff
                  ? formatPercentage(largestDropOff.previousCompletionRate)
                  : "—"}
              </p>
              <p className="mt-0.5 text-[11px] text-[#98a1b1]">
                {largestDropOff?.previousUsers ?? 0} of {funnel.previousEntryUsers} users
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-[#8a94a6]">Change</p>
              <p className="mt-1 text-base font-semibold text-[#c44242]">
                {comparisonDelta === null ? "—" : formatDelta(comparisonDelta)}
              </p>
              <p className="mt-0.5 text-[11px] text-[#98a1b1]">
                Release comparison
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-[#8a94a6]">Lost users</p>
              <p className="mt-1 text-base font-semibold text-[#c44242]">
                {largestDropOff?.dropOffUsers ?? 0}
              </p>
              <p className="mt-0.5 text-[11px] text-[#98a1b1]">
                {largestDropOff
                  ? `${formatPercentage(largestDropOff.dropOffRate)} from prior step`
                  : "No step loss"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-[#8a94a6]">Context</p>
              <p className="mt-1 text-base font-semibold text-[#263247]">
                {funnel.currentPlatform}
              </p>
              <p className="mt-0.5 text-[11px] text-[#98a1b1]">
                {funnel.currentVersion} vs. {funnel.previousVersion}
              </p>
            </div>
          </div>
        </article>
      </section>

      <section
        className="mt-6 w-full min-w-0 max-w-full"
        aria-labelledby="funnel-evidence-title"
      >
        <AnalyticsSectionHeader
          title="Funnel evidence"
          meta="Conversion from journey entry"
        />
        <div className="box-border w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-[#e7eaf0] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.02)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#98a1b1]">
                User journey
              </p>
              <h2
                id="funnel-evidence-title"
                className="mt-1 text-base font-semibold tracking-[-0.02em] text-[#172033]"
              >
                Onboarding completion by step
              </h2>
            </div>
            <div className="flex items-center gap-4 text-[11px] text-[#7e8798]">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-sm bg-[#3559e8]" />
                Current · {funnel.currentVersion}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-sm bg-[#aeb7c6]" />
                Previous · {funnel.previousVersion}
              </span>
            </div>
          </div>

          <div
            className="block w-full min-w-0 max-w-full overflow-x-auto overflow-y-hidden overscroll-x-contain pb-3 pt-6 [scrollbar-color:#cbd5e1_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border-2 [&::-webkit-scrollbar-thumb]:border-solid [&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:bg-[#cbd5e1] [&::-webkit-scrollbar-thumb]:bg-clip-padding [&::-webkit-scrollbar-thumb:hover]:bg-[#94a3b8] [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent"
            style={{
              contain: "inline-size",
              width: "100%",
              maxWidth: "100%",
              overflowX: "auto",
              overflowY: "hidden",
            }}
          >
            <div
              className="flex max-w-none items-stretch px-1"
              style={{
                display: "flex",
                width: "max-content",
                minWidth: "max-content",
              }}
            >
              {funnel.stages.map((stage, index) => {
                const stageComparisonDelta =
                  stage.currentCompletionRate - stage.previousCompletionRate;

                return (
                  <Fragment key={stage.eventName}>
                    {index > 0 ? (
                      <div
                        className={`${styles.journeyItem} ${styles.connector} ${
                          activeStageIndex === index ||
                          activeStageIndex === index - 1
                            ? styles.connectorActive
                            : ""
                        } w-24 min-w-24 max-w-24 flex-none px-2 pt-4 text-center`}
                        style={{
                          ...getJourneyMotionStyle(
                            index * 2 - 1,
                            funnel.stages.length,
                          ),
                          flex: "0 0 96px",
                          width: "96px",
                          minWidth: "96px",
                          maxWidth: "96px",
                        }}
                      >
                        <div
                          aria-hidden="true"
                          className={`flex h-6 items-center ${
                            stage.isLargestDropOff
                              ? "text-[#c44242]"
                              : "text-[#a7b0bf]"
                          }`}
                        >
                          <span
                            className={`${styles.connectorLine} h-px flex-1 ${
                              stage.isLargestDropOff
                                ? "bg-[#e4a0a0]"
                                : "bg-[#d8deea]"
                            }`}
                          />
                          <svg
                            viewBox="0 0 16 16"
                            fill="none"
                            className="size-4 flex-none"
                          >
                            <path
                              d="m5.5 3 5 5-5 5"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </div>

                        {stage.isLargestDropOff ? (
                          <div
                            className={`${styles.metricReveal} ${styles.primaryDropoffValue} mt-2 rounded-md bg-[#fff0f0] px-1.5 py-1.5`}
                          >
                            <p className="whitespace-nowrap text-[10px] font-semibold leading-4 text-[#c44242]">
                              {stage.dropOffUsers} users lost
                            </p>
                            <p className="whitespace-nowrap text-[9px] font-medium leading-3 text-[#c44242]">
                              {formatPercentage(stage.dropOffRate)} drop-off
                            </p>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    <article
                      tabIndex={0}
                      aria-label={`${stage.label} funnel step`}
                      onMouseEnter={() => setActiveStageIndex(index)}
                      onMouseLeave={() => setActiveStageIndex(null)}
                      onFocus={() => setActiveStageIndex(index)}
                      onBlur={() => setActiveStageIndex(null)}
                      className={`${styles.journeyItem} ${styles.transitionCard} ${
                        stage.isLargestDropOff ? styles.primaryCard : ""
                      } ${
                        activeStageIndex === index ? styles.activeCard : ""
                      } box-border flex h-[304px] min-h-[304px] max-h-[304px] w-[180px] min-w-[180px] max-w-[180px] flex-none flex-col rounded-lg border border-solid p-4 shadow-[0_1px_2px_rgba(16,24,40,0.03)] outline-none ring-0 ${
                        stage.isLargestDropOff
                          ? "border-[#efcaca] bg-[#fff7f7]"
                          : "border-[#e7eaf0] bg-white"
                      }`}
                      style={{
                        ...getJourneyMotionStyle(
                          index * 2,
                          funnel.stages.length,
                        ),
                        flex: "0 0 180px",
                        width: "180px",
                        minWidth: "180px",
                        maxWidth: "180px",
                      }}
                    >
                      <div className="min-h-12">
                        <div className="grid grid-cols-[24px_minmax(0,1fr)] items-center gap-2">
                          <span
                            className={`grid size-6 place-items-center rounded-md text-[10px] font-bold ${
                              stage.isLargestDropOff
                                ? "bg-[#ffe5e5] text-[#c44242]"
                                : "bg-[#edf1ff] text-[#3559e8]"
                            }`}
                          >
                            {index + 1}
                          </span>
                          <h3 className="min-w-0 truncate text-xs font-semibold text-[#344056]">
                            {stage.label}
                          </h3>
                        </div>
                        <p className="mt-1 w-full min-w-0 truncate pl-8 text-[9px] text-[#a1a8b5]">
                          {stage.eventName}
                        </p>
                      </div>

                      <div className="mt-5">
                        <p className="text-[10px] font-medium uppercase leading-4 tracking-[0.06em] text-[#98a1b1]">
                          Users
                        </p>
                        <p
                          className={`${styles.metricReveal} mt-1 text-[30px] font-semibold leading-9 tracking-[-0.04em] ${
                            stage.isLargestDropOff
                              ? "text-[#c44242]"
                              : "text-[#172033]"
                          }`}
                        >
                          {stage.currentUsers}
                          <span className="ml-1 text-[10px] font-medium tracking-normal text-[#98a1b1]">
                            users
                          </span>
                        </p>
                      </div>

                      <div className="mt-4">
                        <p className="text-[10px] font-medium uppercase leading-4 tracking-[0.06em] text-[#98a1b1]">
                          Conversion
                        </p>
                        <AnimatedFunnelPercentage
                          value={stage.currentCompletionRate}
                          delayMs={
                            getJourneyItemDelay(
                              index * 2,
                              funnel.stages.length,
                            ) + 240
                          }
                          className={`${styles.metricReveal} mt-1 block text-sm font-semibold leading-5 ${
                            stage.isLargestDropOff
                              ? "text-[#c44242]"
                              : "text-[#344056]"
                          }`}
                        />
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#edf0f5]">
                          <div
                            className={`${styles.conversionFill} h-full rounded-full ${
                              stage.isLargestDropOff
                                ? "bg-[#c44242]"
                                : "bg-[#3559e8]"
                            }`}
                            style={getFunnelConversionFillStyle(
                              stage.currentCompletionRate,
                            )}
                          />
                        </div>
                      </div>

                      <div className="mt-3 h-10 flex-none">
                        <p
                          className={`text-[10px] font-medium uppercase leading-4 tracking-[0.06em] ${
                            stage.isLargestDropOff
                              ? "text-[#c44242]"
                              : "text-[#98a1b1]"
                          }`}
                        >
                          Change
                        </p>
                        <p
                          className={`${styles.metricReveal} ${
                            stage.isLargestDropOff
                              ? styles.primaryDropoffValue
                              : ""
                          } mt-0.5 text-xs font-semibold leading-4 ${
                            stage.isLargestDropOff
                              ? "text-[#c44242]"
                              : "text-[#7e8798]"
                          }`}
                        >
                          {formatDelta(stageComparisonDelta)}
                        </p>
                      </div>

                      <div className="mt-auto text-[9px] leading-4 text-[#98a1b1]">
                        <p>Previous {funnel.previousVersion}</p>
                        <p className="font-medium text-[#7e8798]">
                          {stage.previousUsers} users ·{" "}
                          {formatPercentage(stage.previousCompletionRate)}
                        </p>
                      </div>
                    </article>
                  </Fragment>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6" aria-labelledby="drop-off-diagnosis-title">
        <AnalyticsSectionHeader
          title="Drop-off diagnosis"
          meta="Next investigation step"
        />
        <div className="rounded-xl border border-[#e7eaf0] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.02)]">
          <article className="rounded-lg border border-[#e9ecf1] p-4 transition-colors hover:border-[#d8def0]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <span className="inline-flex rounded-md bg-[#fff0f0] px-1.5 py-0.5 text-[10px] font-bold tracking-[0.08em] text-[#c44242]">
                  HIGH
                </span>
                <h2
                  id="drop-off-diagnosis-title"
                  className="mt-2 text-sm font-semibold tracking-[-0.01em] text-[#263247]"
                >
                  {largestDropOff
                    ? `${largestDropOff.label} needs investigation`
                    : "No drop-off requires investigation"}
                </h2>
                <p className="mt-2 text-sm font-semibold text-[#263247]">
                  {largestDropOff?.dropOffUsers ?? 0} users lost{" "}
                  {largestDropOff ? (
                    <span className="font-medium text-[#c44242]">
                      {formatPercentage(largestDropOff.dropOffRate)} drop-off
                    </span>
                  ) : null}
                </p>
                <p className="mt-1.5 text-xs leading-5 text-[#7e8798]">
                  Affected context: {funnel.currentPlatform} ·{" "}
                  {funnel.currentVersion}. Evidence is available for the current
                  and previous onboarding journeys.
                </p>
              </div>
              {diagnosticHref ? (
                <Link
                  href={diagnosticHref}
                  className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg bg-[#3559e8] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#2446cb]"
                >
                  Investigate <span aria-hidden="true" className="ml-1">→</span>
                </Link>
              ) : (
                <button
                  type="button"
                  disabled
                  className="inline-flex h-9 shrink-0 cursor-not-allowed items-center justify-center rounded-lg bg-[#f1f3f6] px-3 text-xs font-semibold text-[#a1a8b5]"
                >
                  Investigation unavailable
                </button>
              )}
            </div>
          </article>
        </div>
      </section>
    </AnalyticsPageFrame>
  );
}
