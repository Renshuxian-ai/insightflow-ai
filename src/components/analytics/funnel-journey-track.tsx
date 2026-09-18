"use client";

import { Fragment, useState } from "react";

import type { FunnelRuntimeTransition } from "@/lib/analytics/analytics-runtime";

import styles from "./funnel-journey-track.module.css";
import {
  getFunnelConversionFillStyle,
  getJourneyMotionStyle,
} from "./funnel-journey-motion";

function formatPercentage(value: number) {
  return `${value.toFixed(1)}%`;
}

export function FunnelJourneyTrack({
  transitions,
  primaryTransitionId,
}: {
  transitions: FunnelRuntimeTransition[];
  primaryTransitionId: string;
}) {
  const [activeTransitionIndex, setActiveTransitionIndex] = useState<
    number | null
  >(null);

  return (
    <div className="mt-5 w-full min-w-0 max-w-full overflow-x-auto overflow-y-hidden overscroll-x-contain pb-3 pt-1 [scrollbar-color:#cbd5e1_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border-2 [&::-webkit-scrollbar-thumb]:border-solid [&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:bg-[#cbd5e1] [&::-webkit-scrollbar-thumb]:bg-clip-padding [&::-webkit-scrollbar-thumb:hover]:bg-[#94a3b8] [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
      <div className="flex w-max min-w-max items-stretch">
        {transitions.map((transition, index) => {
          const isPrimary = transition.id === primaryTransitionId;
          const isActive = activeTransitionIndex === index;

          return (
            <Fragment key={transition.id}>
              {index > 0 ? (
                <div
                  className={`${styles.journeyItem} ${styles.connector} ${
                    activeTransitionIndex === index ||
                    activeTransitionIndex === index - 1
                      ? styles.connectorActive
                      : ""
                  } flex w-16 flex-none items-center justify-center`}
                  style={getJourneyMotionStyle(
                    index * 2 - 1,
                    transitions.length,
                  )}
                  aria-hidden="true"
                >
                  <span className={`${styles.connectorLine} h-px w-8`} />
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
              ) : null}
              <article
                tabIndex={0}
                aria-label={`${transition.fromStep} to ${transition.toStep} transition`}
                onMouseEnter={() => setActiveTransitionIndex(index)}
                onMouseLeave={() => setActiveTransitionIndex(null)}
                onFocus={() => setActiveTransitionIndex(index)}
                onBlur={() => setActiveTransitionIndex(null)}
                className={`${styles.journeyItem} ${styles.transitionCard} ${
                  isPrimary ? styles.primaryCard : ""
                } ${isActive ? styles.activeCard : ""} flex w-[200px] min-w-[200px] max-w-[200px] flex-none flex-col rounded-lg border p-4 ${
                  isPrimary
                    ? "border-[#efcaca] bg-[#fff7f7]"
                    : "border-[#e7eaf0] bg-white"
                }`}
                style={getJourneyMotionStyle(index * 2, transitions.length)}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`grid size-6 place-items-center rounded-md text-[10px] font-bold ${
                      isPrimary
                        ? "bg-[#ffe5e5] text-[#c44242]"
                        : "bg-[#edf1ff] text-[#3559e8]"
                    }`}
                  >
                    {index + 1}
                  </span>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#98a1b1]">
                    Transition
                  </p>
                </div>
                <h3 className="mt-3 min-h-10 break-words [overflow-wrap:anywhere] text-xs font-semibold leading-5 text-[#344056]">
                  {transition.fromStep} → {transition.toStep}
                </h3>
                <div className={styles.transitionDetails}>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#98a1b1]">
                      Observed users
                    </p>
                    <p
                      className={`${styles.metricReveal} mt-1 text-2xl font-semibold ${
                        isPrimary ? "text-[#c44242]" : "text-[#172033]"
                      }`}
                    >
                      {transition.users.toLocaleString("en-US")}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-[#98a1b1]">Completion</p>
                      <p
                        className={`${styles.metricReveal} mt-1 font-semibold ${
                          isPrimary ? "text-[#c44242]" : "text-[#344056]"
                        }`}
                      >
                        {formatPercentage(transition.completionRate)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[#98a1b1]">Drop-off</p>
                      <p
                        className={`${styles.metricReveal} ${
                          isPrimary ? styles.primaryDropoffValue : ""
                        } mt-1 font-semibold ${
                          isPrimary ? "text-[#c44242]" : "text-[#344056]"
                        }`}
                      >
                        {transition.dropOffUsers}
                      </p>
                    </div>
                  </div>
                  <div
                    className={`${styles.progressTrack} h-1.5 w-full overflow-hidden rounded-full bg-[#edf0f5]`}
                    aria-hidden="true"
                  >
                    <div
                      className={`${styles.conversionFill} h-full rounded-full ${
                        isPrimary ? "bg-[#c44242]" : "bg-[#3559e8]"
                      }`}
                      style={getFunnelConversionFillStyle(
                        transition.completionRate,
                      )}
                    />
                  </div>
                </div>
                <p
                  className={`${styles.stepLabel} text-[10px] text-[#98a1b1]`}
                >
                  {transition.eventNames.join(", ")}
                </p>
              </article>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
