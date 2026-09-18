"use client";

import { useId, useState } from "react";

import type { ProductTrendPoint } from "@/lib/overview/overview-view-model";

import styles from "./product-trend-card.module.css";

type ProductTrendCardProps = {
  metricLabel: string;
  latestValue: string;
  change: string;
  changeDirection: "positive" | "negative" | "neutral";
  data: ProductTrendPoint[];
  heightClassName?: string;
};

const CHART_WIDTH = 600;
const CHART_HEIGHT = 178;
const CHART_PADDING = 14;

function createChartPoints(data: ProductTrendPoint[]) {
  if (data.length === 1) {
    return [{ x: CHART_WIDTH / 2, y: CHART_HEIGHT / 2 }];
  }

  const values = data.map((point) => point.value);
  const minimum = Math.min(...values) - 5;
  const maximum = Math.max(...values) + 5;
  const range = maximum - minimum || 1;
  const timestamps = data.map((point) =>
    point.date && /^\d{4}-\d{2}-\d{2}$/.test(point.date)
      ? Date.parse(`${point.date}T00:00:00Z`)
      : Number.NaN,
  );
  const hasTimeScale = timestamps.every(Number.isFinite);
  const firstTimestamp = timestamps[0];
  const timeRange = hasTimeScale
    ? timestamps.at(-1)! - firstTimestamp
    : 0;

  return data.map((point, index) => {
    const xRatio =
      hasTimeScale && timeRange > 0
        ? (timestamps[index] - firstTimestamp) / timeRange
        : index / (data.length - 1);
    const x =
      CHART_PADDING + xRatio * (CHART_WIDTH - CHART_PADDING * 2);
    const y =
      CHART_HEIGHT -
      CHART_PADDING -
      ((point.value - minimum) / range) *
        (CHART_HEIGHT - CHART_PADDING * 2);
    return { x, y };
  });
}

function getFallbackLabelIndexes(pointCount: number, maximumLabels: number) {
  if (pointCount <= maximumLabels) {
    return new Set(Array.from({ length: pointCount }, (_, index) => index));
  }

  return new Set(
    Array.from({ length: maximumLabels }, (_, index) =>
      Math.round((index * (pointCount - 1)) / (maximumLabels - 1)),
    ),
  );
}

function getNaturalDayInterval(spanDays: number, compact: boolean) {
  if (compact) {
    if (spanDays <= 16) return 4;
    if (spanDays <= 35) return 7;
    if (spanDays <= 70) return 14;
    if (spanDays <= 105) return 21;
  } else {
    if (spanDays <= 16) return 3;
    if (spanDays <= 35) return 5;
    if (spanDays <= 70) return 10;
    if (spanDays <= 105) return 15;
  }

  const roughInterval = Math.ceil(spanDays / (compact ? 4 : 6));
  const naturalIntervals = [30, 45, 60, 90, 120, 180, 365];

  return (
    naturalIntervals.find((interval) => interval >= roughInterval) ??
    roughInterval
  );
}

function getNaturalTickIndexes(
  data: ProductTrendPoint[],
  compact: boolean,
) {
  const timestamps = data.map((point) =>
    point.date && /^\d{4}-\d{2}-\d{2}$/.test(point.date)
      ? Date.parse(`${point.date}T00:00:00Z`)
      : Number.NaN,
  );

  if (
    timestamps.some((timestamp) => !Number.isFinite(timestamp)) ||
    timestamps.length < 2 ||
    timestamps.at(-1)! <= timestamps[0]
  ) {
    return getFallbackLabelIndexes(data.length, compact ? 6 : 8);
  }

  const dayMs = 24 * 60 * 60 * 1_000;
  const firstTimestamp = timestamps[0];
  const lastTimestamp = timestamps.at(-1)!;
  const spanDays = Math.max(1, (lastTimestamp - firstTimestamp) / dayMs);
  const intervalMs = getNaturalDayInterval(spanDays, compact) * dayMs;
  const indexes = [0];

  for (
    let target = firstTimestamp + intervalMs;
    target < lastTimestamp;
    target += intervalMs
  ) {
    let closestIndex = 1;

    for (let index = 2; index < timestamps.length - 1; index += 1) {
      if (
        Math.abs(timestamps[index] - target) <
        Math.abs(timestamps[closestIndex] - target)
      ) {
        closestIndex = index;
      }
    }

    if (closestIndex > indexes.at(-1)! && closestIndex < data.length - 1) {
      indexes.push(closestIndex);
    }
  }

  const previousIndex = indexes.at(-1)!;

  if (
    indexes.length > 1 &&
    lastTimestamp - timestamps[previousIndex] < intervalMs * 0.6
  ) {
    indexes.pop();
  }

  indexes.push(data.length - 1);
  return new Set(indexes);
}

export function ProductTrendCard({
  metricLabel,
  latestValue,
  change,
  changeDirection,
  data,
  heightClassName = "h-[420px] lg:h-[288px]",
}: ProductTrendCardProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const chartId = useId().replaceAll(":", "");
  const fillGradientId = `${chartId}-trend-fill`;
  const revealClipId = `${chartId}-trend-reveal`;
  const chartPoints = createChartPoints(data);
  const linePoints = chartPoints.map(({ x, y }) => `${x},${y}`).join(" ");
  const fillPoints = `${CHART_PADDING},${CHART_HEIGHT - CHART_PADDING} ${linePoints} ${CHART_WIDTH - CHART_PADDING},${CHART_HEIGHT - CHART_PADDING}`;
  const visibleLabelIndexes = getNaturalTickIndexes(data, false);
  const compactLabelIndexes = getNaturalTickIndexes(data, true);
  const activePoint = activeIndex === null ? null : chartPoints[activeIndex];
  const activeData = activeIndex === null ? null : data[activeIndex];
  const changeClassName =
    changeDirection === "positive"
      ? "text-[#168251]"
      : changeDirection === "negative"
        ? "text-[#c44242]"
        : "text-[#687387]";

  return (
    <section className={`flex min-h-0 flex-col rounded-xl border border-[#e7eaf0] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.02)] lg:p-[var(--card-padding-lg)] ${heightClassName}`} aria-labelledby="product-trend-title">
      <div className="flex items-start justify-between gap-4 lg:gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#98a1b1] lg:text-[10px]">Product health</p>
          <h2 id="product-trend-title" className="mt-1 text-base font-semibold tracking-[-0.02em] text-[#172033] lg:mt-0.5 lg:text-[13px]">Product trend</h2>
          <p className="mt-1 text-[13px] text-[#778196] lg:mt-0.5 lg:text-[11px]">{metricLabel}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold tracking-[-0.03em] text-[#172033] lg:text-[15px]">{latestValue}</p>
          <p className={`text-xs font-medium lg:text-[11px] ${changeClassName}`}>{change}</p>
        </div>
      </div>

      <div className="mt-5 min-h-0 flex-1 lg:mt-2">
        <div className="relative h-[230px] w-full lg:h-[142px]">
        <svg viewBox="0 0 600 178" className="absolute inset-0 h-full w-full" preserveAspectRatio="none" role="img" aria-label={metricLabel}>
          <defs>
            <linearGradient id={fillGradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#3559e8" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#3559e8" stopOpacity="0" />
            </linearGradient>
            <clipPath id={revealClipId}>
              <rect
                className={styles.trendReveal}
                x="0"
                y="0"
                width={CHART_WIDTH}
                height={CHART_HEIGHT}
              />
            </clipPath>
          </defs>
          {[35, 78, 121, 164].map((y) => (
            <line key={y} x1="0" x2="600" y1={y} y2={y} stroke="#edf0f5" strokeWidth="1" />
          ))}
          <polygon
            points={fillPoints}
            fill={`url(#${fillGradientId})`}
            clipPath={`url(#${revealClipId})`}
          />
          <polyline
            className={styles.trendLine}
            points={linePoints}
            pathLength="1"
            fill="none"
            stroke="#3559e8"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {chartPoints.map((point, index) => (
          <button
            key={`${data[index].label}-${index}`}
            type="button"
            aria-label={`${data[index].label}: ${data[index].value.toLocaleString("en-US", { maximumFractionDigits: 1 })}`}
            onMouseEnter={() => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(null)}
            onFocus={() => setActiveIndex(index)}
            onBlur={() => setActiveIndex(null)}
            className="group absolute z-10 grid size-5 -translate-x-1/2 -translate-y-1/2 cursor-default place-items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3559e8]/30"
            style={{
              left: `${(point.x / CHART_WIDTH) * 100}%`,
              top: `${(point.y / CHART_HEIGHT) * 100}%`,
            }}
          >
            <span className="size-2 rounded-full border-2 border-white bg-[#3559e8] opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
          </button>
        ))}
        {activePoint && activeData ? (
          <div
            className="pointer-events-none absolute z-20 min-w-28 rounded-lg border border-[#dfe4ec] bg-white px-3 py-2 text-xs shadow-[0_4px_14px_rgba(28,39,60,0.10)]"
            style={{
              left: `${(activePoint.x / CHART_WIDTH) * 100}%`,
              top: `${(activePoint.y / CHART_HEIGHT) * 100}%`,
              transform: `translate(${activePoint.x > CHART_WIDTH * 0.72 ? "calc(-100% - 8px)" : "8px"}, ${activePoint.y < 52 ? "8px" : "calc(-100% - 8px)"})`,
            }}
          >
            <p className="font-semibold text-[#344056]">{activeData.label}</p>
            <p className="mt-0.5 text-[#7e8798]">
              {activeData.value.toLocaleString("en-US", {
                maximumFractionDigits: 1,
              })}
            </p>
          </div>
        ) : null}
        </div>
        <div className="relative mt-2 h-5 text-[11px] text-[#98a1b1] lg:mt-1 lg:h-4 lg:text-[10px]">
          {data.map((point, index) =>
            visibleLabelIndexes.has(index) ? (
              <span
                key={`${point.label}-${index}`}
                className={`absolute whitespace-nowrap ${compactLabelIndexes.has(index) ? "" : "hidden sm:block"}`}
                style={{
                  left: `${(chartPoints[index].x / CHART_WIDTH) * 100}%`,
                  transform:
                    index === 0
                      ? "none"
                      : index === data.length - 1
                        ? "translateX(-100%)"
                        : "translateX(-50%)",
                }}
              >
                {point.label}
              </span>
            ) : null,
          )}
        </div>
      </div>
    </section>
  );
}
