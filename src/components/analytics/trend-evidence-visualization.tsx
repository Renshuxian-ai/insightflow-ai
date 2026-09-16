import { ProductTrendCard } from "@/components/overview/product-trend-card";
import type {
  TrendRuntimeMetric,
  TrendRuntimeMetricUnit,
  TrendRuntimeSignal,
} from "@/lib/analytics/trend-runtime";

function formatValue(value: number, unit: TrendRuntimeMetricUnit) {
  if (unit === "percentage") {
    return `${value.toFixed(1)}%`;
  }

  return `${value.toLocaleString("en-US", { maximumFractionDigits: 1 })}${
    unit === "mentions" ? " mentions" : ""
  }`;
}

function formatChange(signal: TrendRuntimeSignal) {
  const sign = signal.change > 0 ? "+" : "";

  if (signal.changeType === "percentage-points") {
    return `${sign}${signal.change.toFixed(1)} pp`;
  }

  if (signal.changeType === "relative-percent") {
    return `${sign}${signal.change.toFixed(1)}%`;
  }

  return `${sign}${signal.change.toLocaleString("en-US", {
    maximumFractionDigits: 1,
  })}${signal.unit === "mentions" ? " mentions" : ""}`;
}

function formatPointLabel(label: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(label) ? label.slice(5) : label;
}

function ComparisonArrow() {
  return (
    <svg
      aria-hidden="true"
      className="size-5 rotate-90 text-[#9aa4b5] sm:rotate-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <path
        d="M5 12h14m-5-5 5 5-5 5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const comparisonCopy = {
  retention: {
    eyebrow: "Retention evidence",
    title: "Retention comparison",
  },
  funnel: {
    eyebrow: "Funnel evidence",
    title: "Funnel comparison",
  },
  feedback: {
    eyebrow: "Feedback evidence",
    title: "Feedback movement",
  },
} as const;

function ComparisonEvidence({
  signal,
  metric,
}: {
  signal: TrendRuntimeSignal;
  metric: TrendRuntimeMetric;
}) {
  const copy =
    metric.surface === "activity" ? null : comparisonCopy[metric.surface];
  const previous = metric.previous ?? metric.points.at(-2) ?? null;
  const current = metric.current;

  if (!copy || !previous) {
    return null;
  }

  return (
    <section
      className="flex h-[448px] min-h-0 flex-col rounded-xl border border-[#e7eaf0] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.02)]"
      aria-label={`${copy.title}: ${signal.title}`}
    >
      <div className="shrink-0">
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#98a1b1]">
          {copy.eyebrow}
        </p>
        <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-base font-semibold tracking-[-0.02em] text-[#172033]">
              {copy.title}
            </h2>
            <p className="mt-1 line-clamp-2 text-[13px] text-[#778196]">
              {metric.label} · {metric.contextLabel}
            </p>
          </div>
          <span className="shrink-0 rounded-md bg-[#fff0f0] px-2 py-1 text-xs font-semibold text-[#c44242]">
            {formatChange(signal)}
          </span>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center py-5">
        <div className="grid w-full max-w-3xl items-stretch gap-3 sm:grid-cols-[minmax(0,1fr)_112px_minmax(0,1fr)] sm:gap-4">
          <div className="flex min-h-24 flex-col justify-center rounded-xl border border-[#e5e8ee] bg-[#fafbfc] px-4 py-3 sm:min-h-32 sm:px-5 sm:py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8a94a6]">
              {previous.label}
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[#526078] sm:mt-3 sm:text-3xl">
              {formatValue(previous.value, metric.unit)}
            </p>
            <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#8a94a6]">
              {previous.context}
            </p>
          </div>

          <div className="flex flex-col items-center justify-center gap-2 text-center">
            <div className="flex items-center gap-2">
              <span className="hidden h-px w-7 bg-[#dfe3ea] sm:block" />
              <ComparisonArrow />
              <span className="hidden h-px w-7 bg-[#dfe3ea] sm:block" />
            </div>
            <p className="text-sm font-semibold text-[#c44242]">
              {formatChange(signal)}
            </p>
          </div>

          <div className="flex min-h-24 flex-col justify-center rounded-xl border border-[#dce3fb] bg-[#f7f9ff] px-4 py-3 sm:min-h-32 sm:px-5 sm:py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#526fca]">
              {current.label}
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[#263247] sm:mt-3 sm:text-3xl">
              {formatValue(current.value, metric.unit)}
            </p>
            <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#778196]">
              {current.context}
            </p>
          </div>
        </div>
      </div>

      <p className="shrink-0 border-t border-[#eef0f4] pt-3 text-xs text-[#8a94a6]">
        {signal.comparison}
      </p>
    </section>
  );
}

export function TrendEvidenceVisualization({
  signal,
  metric,
}: {
  signal: TrendRuntimeSignal;
  metric: TrendRuntimeMetric;
}) {
  if (metric.surface === "activity") {
    return (
      <ProductTrendCard
        heightClassName="h-[448px]"
        metricLabel={`${metric.label} · ${metric.contextLabel}`}
        latestValue={formatValue(metric.current.value, metric.unit)}
        change={formatChange(signal)}
        changeDirection={
          signal.direction === "decline" ? "negative" : "positive"
        }
        data={metric.points.map((point) => ({
          label: formatPointLabel(point.label),
          value: point.value,
          date: /^\d{4}-\d{2}-\d{2}$/.test(point.label)
            ? point.label
            : undefined,
        }))}
      />
    );
  }

  return <ComparisonEvidence signal={signal} metric={metric} />;
}
