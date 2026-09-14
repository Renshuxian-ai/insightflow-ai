"use client";

import { useState } from "react";

import type { DemoAnalyticsResult } from "@/lib/analytics/demo-analytics";

import { AnalyticsSectionHeader } from "./analytics-page-frame";

type RetentionInterval =
  DemoAnalyticsResult["retention"]["current"]["intervals"][number];

type RetentionCurveProps = {
  currentIntervals: RetentionInterval[];
  baselineIntervals: RetentionInterval[];
  selectedInterval?: string | null;
  selectedCohortDate?: string | null;
  onSelectInterval?: (interval: string) => void;
  onClearCohortSelection?: () => void;
};

type CurvePoint = {
  day: number;
  current: RetentionInterval;
  baseline: RetentionInterval;
  x: number;
};

const CHART_WIDTH = 760;
const CHART_HEIGHT = 260;
const PLOT_LEFT = 58;
const PLOT_RIGHT = 24;
const PLOT_TOP = 24;
const PLOT_BOTTOM = 42;
const PLOT_HEIGHT = CHART_HEIGHT - PLOT_TOP - PLOT_BOTTOM;
const TOOLTIP_WIDTH = 208;
const TOOLTIP_GAP = 12;

function toY(rate: number) {
  return PLOT_TOP + ((100 - rate) / 100) * PLOT_HEIGHT;
}

function formatRate(rate: number) {
  return `${rate.toFixed(1)}%`;
}

function formatUsers(users: number) {
  return new Intl.NumberFormat("en-US").format(users);
}

function formatGap(gap: number) {
  const value = Number.isInteger(gap) ? gap.toFixed(0) : gap.toFixed(1);

  return `${gap > 0 ? "+" : ""}${value} pp`;
}

function toLinePoints(
  points: CurvePoint[],
  series: "current" | "baseline",
) {
  return points
    .map((point) => `${point.x},${toY(point[series].rate)}`)
    .join(" ");
}

export function RetentionCurve({
  currentIntervals,
  baselineIntervals,
  selectedInterval = null,
  selectedCohortDate = null,
  onSelectInterval,
  onClearCohortSelection,
}: RetentionCurveProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const baselineByDay = new Map(
    baselineIntervals.map((interval) => [interval.day, interval]),
  );
  const matchedIntervals = currentIntervals.flatMap((current) => {
    const baseline = baselineByDay.get(current.day);

    return baseline ? [{ current, baseline }] : [];
  });
  const plotWidth = CHART_WIDTH - PLOT_LEFT - PLOT_RIGHT;
  const points: CurvePoint[] = matchedIntervals.map(
    ({ current, baseline }, index) => ({
      day: current.day,
      current,
      baseline,
      x:
        PLOT_LEFT +
        (matchedIntervals.length === 1
          ? plotWidth / 2
          : (index / (matchedIntervals.length - 1)) * plotWidth),
    }),
  );
  const activeIndex = hoveredIndex ?? focusedIndex;
  const activePoint = activeIndex === null ? null : points[activeIndex];
  const d7Point = points.find((point) => point.day === 7);
  const tooltipPlacement =
    activePoint &&
    activePoint.x + TOOLTIP_WIDTH + TOOLTIP_GAP >
      CHART_WIDTH - PLOT_RIGHT
      ? "left"
      : "right";

  return (
    <section className="mt-6" aria-label="Retention curve">
      <AnalyticsSectionHeader
        title={
          selectedCohortDate
            ? `Retention curve: ${selectedCohortDate} cohort vs baseline`
            : "Retention curve comparison"
        }
        meta="Trend evidence"
      />
      <div className="min-w-0 rounded-xl border border-[#e7eaf0] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.02)]">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <p className="text-[13px] text-[#778196]">
              {selectedCohortDate
                ? "Selected cohort retention compared with baseline."
                : "Current cohort retention compared with baseline."}
            </p>
            {selectedCohortDate ? (
              <div className="mt-2 inline-flex items-center gap-2 rounded-md bg-[#eef2ff] px-2.5 py-1.5 text-[11px] text-[#435675]">
                <span>
                  Selected cohort:{" "}
                  <strong className="font-semibold text-[#294bbf]">
                    {selectedCohortDate}
                  </strong>
                </span>
                <button
                  type="button"
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-[#cfd5df] bg-white px-2.5 py-1 font-semibold text-[#526077] outline-none transition-colors hover:border-[#b8c1cf] hover:bg-[#f7f8fa] hover:text-[#344056] focus-visible:ring-2 focus-visible:ring-[#9fb0f5]"
                  onClick={onClearCohortSelection}
                >
                  <span aria-hidden="true">←</span>
                  <span>Back to current cohort</span>
                </button>
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:justify-end">
            <div
              className="flex items-center gap-4 text-[11px] text-[#7e8798]"
              aria-label="Retention curve legend"
            >
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-[#3559e8]" />
                {selectedCohortDate ? "Selected cohort" : "Current cohort"}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-[#aeb7c6]" />
                Baseline
              </span>
            </div>
            {d7Point ? (
              <span className="rounded-md bg-[#fff3f3] px-2 py-1 text-[10px] font-medium text-[#7e8798]">
                D7 gap{" "}
                <strong className="font-semibold text-[#bd3f3f]">
                  {formatGap(d7Point.current.rate - d7Point.baseline.rate)}
                </strong>
              </span>
            ) : null}
          </div>
        </div>

        <div className="relative mt-4 overflow-visible">
          <div className="w-full min-w-0 overflow-x-auto overflow-y-hidden">
            <div className="min-w-[620px]">
            <svg
              className="h-[260px] w-full"
              viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
              role="img"
              aria-label="Current cohort and baseline retention by interval"
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <text
                x="0"
                y="12"
                fill="#98a1b1"
                fontSize="10"
                fontWeight="600"
              >
                Retention %
              </text>

              {[100, 50, 0].map((rate) => {
                const y = toY(rate);

                return (
                  <g key={rate}>
                    <line
                      x1={PLOT_LEFT}
                      x2={CHART_WIDTH - PLOT_RIGHT}
                      y1={y}
                      y2={y}
                      stroke="#edf0f5"
                      strokeWidth="1"
                    />
                    <text
                      x={PLOT_LEFT - 12}
                      y={y + 3}
                      fill="#98a1b1"
                      fontSize="10"
                      textAnchor="end"
                    >
                      {rate}%
                    </text>
                  </g>
                );
              })}

              <polyline
                points={toLinePoints(points, "baseline")}
                fill="none"
                stroke="#aeb7c6"
                strokeWidth="2"
                strokeDasharray="5 5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <polyline
                points={toLinePoints(points, "current")}
                fill="none"
                stroke="#3559e8"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {activePoint ? (
                <line
                  x1={activePoint.x}
                  x2={activePoint.x}
                  y1={PLOT_TOP}
                  y2={CHART_HEIGHT - PLOT_BOTTOM}
                  stroke="#cfd5df"
                  strokeWidth="1"
                  strokeDasharray="3 4"
                />
              ) : null}

              {points.map((point, index) => {
                const previousX = points[index - 1]?.x ?? PLOT_LEFT;
                const nextX =
                  points[index + 1]?.x ?? CHART_WIDTH - PLOT_RIGHT;
                const hitAreaStart =
                  index === 0 ? PLOT_LEFT : (previousX + point.x) / 2;
                const hitAreaEnd =
                  index === points.length - 1
                    ? CHART_WIDTH - PLOT_RIGHT
                    : (point.x + nextX) / 2;
                const isActive = activeIndex === index;
                const interval = `D${point.day}`;
                const isSelected = selectedInterval === interval;

                return (
                  <g key={point.day}>
                    <circle
                      cx={point.x}
                      cy={toY(point.baseline.rate)}
                      r={isActive ? 4 : 3}
                      fill="#ffffff"
                      stroke="#aeb7c6"
                      strokeWidth="2"
                      pointerEvents="none"
                    />
                    <circle
                      cx={point.x}
                      cy={toY(point.current.rate)}
                      r={isActive || isSelected ? 4.5 : 3.5}
                      fill="#3559e8"
                      stroke={isSelected ? "#cfd9fb" : "#ffffff"}
                      strokeWidth={isSelected ? 4 : 2}
                      pointerEvents="none"
                    />
                    <text
                      x={point.x}
                      y={CHART_HEIGHT - 15}
                      fill="#7e8798"
                      fontSize="11"
                      fontWeight="600"
                      textAnchor="middle"
                      pointerEvents="none"
                    >
                      D{point.day}
                    </text>
                    <rect
                      className="outline-none focus:outline-none focus-visible:outline-none"
                      x={hitAreaStart}
                      y={PLOT_TOP}
                      width={hitAreaEnd - hitAreaStart}
                      height={PLOT_HEIGHT}
                      fill="transparent"
                      tabIndex={0}
                      role="button"
                      aria-pressed={isSelected}
                      aria-label={`D${point.day}: current ${formatRate(point.current.rate)}, ${formatUsers(point.current.users)} retained users; baseline ${formatRate(point.baseline.rate)}, ${formatUsers(point.baseline.users)} retained users; gap ${formatGap(point.current.rate - point.baseline.rate)}`}
                      onFocus={() => setFocusedIndex(index)}
                      onBlur={() => setFocusedIndex(null)}
                      onMouseEnter={() => setHoveredIndex(index)}
                      onMouseLeave={() =>
                        setHoveredIndex((current) =>
                          current === index ? null : current,
                        )
                      }
                      onPointerDown={(event) => {
                        event.preventDefault();
                        event.currentTarget.blur();
                        setFocusedIndex(null);
                      }}
                      onClick={() => onSelectInterval?.(interval)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onSelectInterval?.(interval);
                        }
                      }}
                    />
                  </g>
                );
              })}
            </svg>
            </div>
          </div>

          <div className="pointer-events-none absolute inset-0 z-10 overflow-visible">
            {activePoint ? (
              <div
                className="absolute w-52 rounded-lg border border-[#dfe4ec] bg-white px-3 py-2.5 shadow-[0_8px_24px_rgba(23,32,51,0.12)]"
                style={{
                  left:
                    tooltipPlacement === "right"
                      ? `${(activePoint.x / CHART_WIDTH) * 100}%`
                      : undefined,
                  right:
                    tooltipPlacement === "left"
                      ? `${((CHART_WIDTH - activePoint.x) / CHART_WIDTH) * 100}%`
                      : undefined,
                  top: `${Math.min(
                    toY(activePoint.current.rate),
                    toY(activePoint.baseline.rate),
                  ) + 12}px`,
                  transform:
                    tooltipPlacement === "left"
                      ? `translateX(-${TOOLTIP_GAP}px)`
                      : `translateX(${TOOLTIP_GAP}px)`,
                }}
                role="tooltip"
              >
                <p className="text-[11px] font-semibold text-[#344056]">
                  Interval · D{activePoint.day}
                </p>
                <div className="mt-2 space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[#657084]">Current cohort</span>
                    <span className="font-semibold text-[#3559e8]">
                      {formatRate(activePoint.current.rate)} ·{" "}
                      {formatUsers(activePoint.current.users)} users
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[#657084]">Baseline</span>
                    <span className="font-semibold text-[#687387]">
                      {formatRate(activePoint.baseline.rate)} ·{" "}
                      {formatUsers(activePoint.baseline.users)} users
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t border-[#eef0f4] pt-1.5">
                    <span className="text-[#657084]">Gap</span>
                    <span
                      className={`font-semibold ${
                        activePoint.current.rate - activePoint.baseline.rate < 0
                          ? "text-[#bd3f3f]"
                          : "text-[#168251]"
                      }`}
                    >
                      {formatGap(
                        activePoint.current.rate - activePoint.baseline.rate,
                      )}
                    </span>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
