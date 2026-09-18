"use client";

import type { ReactNode } from "react";

import { useLanguage } from "@/components/i18n/language-provider";

type AnalyticsPageFrameProps = {
  title: string;
  description: string;
  children: ReactNode;
  sourceLabel?: string;
};

export function AnalyticsPageFrame({
  title,
  description,
  children,
  sourceLabel = "DEMO DATA",
}: AnalyticsPageFrameProps) {
  const { t } = useLanguage();
  const displayedSourceLabel =
    sourceLabel === "DEMO DATA"
      ? t("analytics.demoData")
      : sourceLabel === "UPLOADED DATASET"
        ? t("analytics.uploadedDataset")
        : sourceLabel;

  return (
    <main className="desktop-density-page mx-auto w-full px-5 py-7 sm:px-7 lg:px-[var(--page-padding-x)] lg:py-[var(--page-padding-y)]">
      <header className="flex flex-col justify-between gap-5 border-b border-[#e6e9ef] pb-6 sm:flex-row sm:items-end lg:gap-2 lg:pb-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xs font-medium text-[#7e8798]">
              {t("analytics.category")}
            </p>
            <span aria-hidden="true" className="text-[#b3bac6]">
              /
            </span>
            <p className="text-xs font-medium text-[#4e5a70]">{title}</p>
          </div>
          <h1 className="mt-3 text-[28px] font-semibold tracking-[-0.04em] text-[#172033] lg:mt-1.5 lg:text-[21px]">
            {title}
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-5 text-[#6f7a8e] lg:mt-1 lg:text-[13px] lg:leading-[18px]">
            {description}
          </p>
        </div>
        <span
          className={
            sourceLabel === "DEMO DATA"
              ? "w-fit rounded-md bg-[#fff6e4] px-2 py-1 text-[10px] font-bold tracking-[0.08em] text-[#8a5b00]"
              : "w-fit rounded-md bg-[#edf1ff] px-2 py-1 text-[10px] font-bold tracking-[0.08em] text-[#3559e8]"
          }
        >
          {displayedSourceLabel}
        </span>
      </header>
      {children}
    </main>
  );
}

type AnalyticsSummaryCardProps = {
  label: string;
  value: string;
  detail?: string;
  tone?: "default" | "primary" | "negative";
};

const summaryToneStyles = {
  default: {
    value: "text-[#172033]",
  },
  primary: {
    value: "text-[#3559e8]",
  },
  negative: {
    value: "text-[#bd3f3f]",
  },
} as const;

export function AnalyticsSummaryGrid({ children }: { children: ReactNode }) {
  const { t } = useLanguage();

  return (
    <section
      className="mt-6 grid gap-3 sm:grid-cols-3"
      aria-label={t("analytics.summary")}
    >
      {children}
    </section>
  );
}

export function AnalyticsSummaryCard({
  label,
  value,
  detail,
  tone = "default",
}: AnalyticsSummaryCardProps) {
  const toneStyles = summaryToneStyles[tone];

  return (
    <article className="min-w-0 rounded-xl border border-[#e7eaf0] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.02)] lg:min-h-[112px] lg:p-[var(--card-padding)]">
      <p className="truncate text-[13px] font-medium text-[#657084] lg:text-[11px]">
        {label}
      </p>
      <p
        className={`mt-3 truncate text-[25px] font-semibold tracking-[-0.04em] lg:mt-2 lg:text-[21px] ${toneStyles.value}`}
      >
        {value}
      </p>
      {detail ? (
        <p className="mt-2 truncate text-xs text-[#98a1b1] lg:text-[11px]" title={detail}>
          {detail}
        </p>
      ) : null}
    </article>
  );
}

export function AnalyticsSectionHeader({
  title,
  meta,
}: {
  title: string;
  meta?: string;
}) {
  return (
    <div className="mb-2.5 flex items-center justify-between gap-4 lg:mb-1.5 lg:gap-3">
      <h2 className="text-sm font-semibold text-[#344056] lg:text-[13px]">{title}</h2>
      {meta ? <p className="text-xs text-[#98a1b1] lg:text-[11px]">{meta}</p> : null}
    </div>
  );
}

export type AnalyticsMetricGroupItem = {
  label: string;
  value: string;
  detail?: string;
  change?: string;
  tone?: "default" | "positive" | "negative" | "primary";
};

const metricToneStyles = {
  default: "text-[#172033]",
  positive: "text-[#168251]",
  negative: "text-[#c44242]",
  primary: "text-[#3559e8]",
} as const;

export function AnalyticsMetricGroup({
  items,
  ariaLabel,
}: {
  items: AnalyticsMetricGroupItem[];
  ariaLabel: string;
}) {
  return (
    <div
      aria-label={ariaLabel}
      className="grid overflow-hidden rounded-xl border border-[#e7eaf0] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.02)] sm:grid-cols-3"
      role="group"
    >
      {items.map((item) => {
        const tone = item.tone ?? "default";

        return (
          <div
            key={item.label}
            className="border-t border-[#eef0f4] px-4 py-4 first:border-t-0 sm:border-l sm:border-t-0 sm:first:border-l-0 lg:px-2.5 lg:py-2.5"
          >
            <p className="text-[13px] font-medium text-[#657084] lg:text-[11px]">
              {item.label}
            </p>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <p
                className={`text-[23px] font-semibold tracking-[-0.04em] lg:text-xl ${metricToneStyles[tone]}`}
              >
                {item.value}
              </p>
              {item.change ? (
                <span
                  className={`text-xs font-semibold ${metricToneStyles[tone]}`}
                >
                  {item.change}
                </span>
              ) : null}
            </div>
            {item.detail ? (
              <p className="mt-1 text-xs leading-4 text-[#98a1b1]">
                {item.detail}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function AnalyticsStatus({
  title,
  description,
  loading = false,
}: {
  title: string;
  description: string;
  loading?: boolean;
}) {
  return (
    <section
      className="mt-6 rounded-xl border border-[#e7eaf0] bg-white px-5 py-5 shadow-[0_1px_2px_rgba(16,24,40,0.02)] lg:px-[var(--card-padding-lg)] lg:py-[var(--card-padding-lg)]"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        {loading ? (
          <span
            aria-hidden="true"
            className="mt-0.5 size-4 animate-spin rounded-full border-2 border-[#d7ddeb] border-t-[#3559e8]"
          />
        ) : null}
        <div>
          <h2 className="text-sm font-semibold text-[#344056]">{title}</h2>
          <p className="mt-1 text-xs leading-5 text-[#7e8798]">
            {description}
          </p>
        </div>
      </div>
    </section>
  );
}
