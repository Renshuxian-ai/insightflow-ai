"use client";

import { useState } from "react";

import { InvestigationLaunchLink } from "@/components/diagnostics/investigation-launch-link";
import { KpiCard } from "@/components/overview/kpi-card";
import { ANALYTICS_DIAGNOSTIC_HREF } from "@/lib/analytics/demo-analytics";
import { buildFeedbackInvestigationContext } from "@/lib/analytics/feedback-investigation-adapter";
import { buildAnalyticsInvestigationHref } from "@/lib/analytics/investigation-context";
import {
  feedbackOverviewMetrics,
  feedbackTopics,
  type FeedbackSentiment,
  type FeedbackTopic,
} from "@/lib/feedback/mock-feedback-data";

const sentimentStyles: Record<
  FeedbackSentiment,
  { badge: string; dot: string }
> = {
  Negative: {
    badge: "bg-[#fff0f0] text-[#c44242]",
    dot: "bg-[#d95a5a]",
  },
  Mixed: {
    badge: "bg-[#fff6e4] text-[#986315]",
    dot: "bg-[#d79a3b]",
  },
};

function getInvestigationHref(topic: FeedbackTopic) {
  return buildAnalyticsInvestigationHref(
    ANALYTICS_DIAGNOSTIC_HREF,
    buildFeedbackInvestigationContext(topic),
    { returnTo: "/feedback" },
  );
}

function ArrowIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <path d="M5 12h14m-5-5 5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TopicCard({
  topic,
  selected,
  onSelect,
}: {
  topic: FeedbackTopic;
  selected: boolean;
  onSelect: () => void;
}) {
  const sentiment = sentimentStyles[topic.sentiment];

  return (
    <article
      className={[
        "min-h-[250px] overflow-hidden rounded-xl border bg-white shadow-[0_1px_2px_rgba(16,24,40,0.02)] transition-colors lg:min-h-[132px]",
        selected
          ? "border-[#aebeff] ring-2 ring-[#3559e8]/10"
          : "border-[#e7eaf0] hover:border-[#d5dbea]",
      ].join(" ")}
    >
      <button
        type="button"
        aria-pressed={selected}
        onClick={onSelect}
        className="flex min-h-[250px] w-full cursor-pointer flex-col p-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#3559e8]/30 lg:min-h-[132px] lg:p-3"
      >
        <div className="flex items-start justify-between gap-3 lg:gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#98a1b1] lg:text-[9px] lg:leading-3">
              AI-grouped topic
            </p>
            <h3 className="mt-1.5 text-base font-semibold tracking-[-0.02em] text-[#263247] lg:mt-0.5 lg:text-[13px] lg:leading-[18px]">
              {topic.title}
            </h3>
          </div>
          <span
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-[0.06em] lg:gap-1 lg:px-1.5 lg:py-0.5 lg:text-[9px] ${sentiment.badge}`}
          >
            <span className={`size-1.5 rounded-full lg:size-1 ${sentiment.dot}`} />
            {topic.sentiment}
          </span>
        </div>

        <div className="mt-5 flex items-end justify-between gap-4 border-b border-[#eef0f4] pb-4 lg:mt-1.5 lg:gap-2 lg:pb-1.5">
          <div>
            <p className="text-[25px] font-semibold tracking-[-0.04em] text-[#172033] lg:text-xl lg:leading-6">
              {topic.mentionCount}
            </p>
            <p className="mt-0.5 text-xs text-[#8a94a6] lg:text-[10px] lg:leading-3">mentions</p>
          </div>
          <span className="rounded-md bg-[#fff0f0] px-2 py-1 text-xs font-semibold text-[#c44242] lg:px-1.5 lg:py-0.5 lg:text-[10px]">
            ↑ {topic.trend}
          </span>
        </div>

        <div className="mt-auto pt-5 lg:flex lg:items-center lg:gap-2 lg:pt-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#98a1b1] lg:text-[9px] lg:leading-3">
            Affected
          </p>
          <p className="mt-1 text-sm font-medium text-[#526078] lg:mt-0 lg:text-xs lg:leading-4">
            {topic.affectedSegments.join(" · ")}
          </p>
        </div>
      </button>
    </article>
  );
}

function TopicDetail({
  topic,
  investigationHref,
}: {
  topic: FeedbackTopic;
  investigationHref: string;
}) {
  return (
    <section className="mt-6 lg:mt-4" aria-labelledby="feedback-topic-detail-title">
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-3 lg:mb-2.5 lg:gap-3">
        <div>
          <h2
            id="feedback-topic-detail-title"
            className="text-sm font-semibold text-[#344056] lg:text-[13px]"
          >
            Topic detail
          </h2>
          <p className="mt-1 text-xs text-[#98a1b1] lg:text-[11px]">
            Evidence and context for {topic.title}
          </p>
        </div>
        <InvestigationLaunchLink
          href={investigationHref}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#3559e8] px-3.5 text-xs font-semibold text-white transition-colors hover:bg-[#2446cb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3559e8]/30 lg:h-7 lg:px-2.5 lg:text-[11px]"
        >
          Investigate
          <ArrowIcon />
        </InvestigationLaunchLink>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#e7eaf0] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.02)]">
        <div className="grid lg:grid-cols-[1.4fr_1fr_1fr]">
          <div className="p-5 lg:border-r lg:border-[#eef0f4] lg:p-3">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-[#fff6e4] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#986315]">
                Inference
              </span>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#98a1b1]">
                AI summary
              </p>
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#526078] lg:mt-2 lg:text-xs lg:leading-[17px]">
              {topic.aiSummary}
            </p>
            <p className="mt-3 text-xs leading-5 text-[#98a1b1] lg:mt-2 lg:text-[11px] lg:leading-4">
              AI grouping highlights a pattern to investigate. It does not establish causation.
            </p>
          </div>

          <div className="border-t border-[#eef0f4] p-5 lg:border-r lg:border-t-0 lg:border-[#eef0f4] lg:p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#98a1b1]">
              Context
            </p>
            <dl className="mt-3 space-y-3 lg:mt-2 lg:space-y-1.5">
              {Object.entries({
                Platform: topic.context.platform,
                Version: topic.context.version,
                Segment: topic.context.segment,
              }).map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-3">
                  <dt className="text-xs text-[#8a94a6] lg:text-[11px]">{label}</dt>
                  <dd className="text-xs font-semibold text-[#526078] lg:text-[11px]">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="border-t border-[#eef0f4] p-5 lg:border-t-0 lg:p-3">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-[#edf1ff] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#3559e8]">
                Evidence
              </span>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#98a1b1]">
                Supporting Product Signal
              </p>
            </div>
            <p className="mt-3 text-sm font-semibold text-[#344056] lg:mt-2 lg:text-xs">
              {topic.relatedSignal.title}
            </p>
            <p className="mt-1 text-lg font-semibold tracking-[-0.03em] text-[#c44242] lg:text-sm">
              {topic.relatedSignal.change}
            </p>
            <p className="mt-2 text-xs leading-5 text-[#98a1b1] lg:text-[11px] lg:leading-4">
              This signal provides supporting evidence, not confirmed causation.
            </p>
          </div>
        </div>

        <div className="border-t border-[#eef0f4] p-5 lg:p-3">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-[#edf1ff] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#3559e8]">
              Evidence
            </span>
            <h3 className="text-sm font-semibold text-[#344056] lg:text-[13px]">
              Representative Evidence Quotes
            </h3>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-3 lg:gap-3">
            {topic.evidenceQuotes.map((quote) => (
              <figure
                key={quote.id}
                className="rounded-lg border border-[#e9ecf1] bg-[#fafbfc] p-4 lg:p-3"
              >
                <blockquote className="text-[13px] leading-5 text-[#526078] lg:text-xs lg:leading-[17px]">
                  “{quote.text}”
                </blockquote>
                <figcaption className="mt-3 text-[11px] font-medium text-[#98a1b1] lg:mt-2 lg:text-[10px]">
                  {quote.source}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function FeedbackPage() {
  const [selectedTopicId, setSelectedTopicId] = useState(
    feedbackTopics[0]?.id ?? "",
  );
  const selectedTopic =
    feedbackTopics.find((topic) => topic.id === selectedTopicId) ??
    feedbackTopics[0];
  const selectedInvestigationHref = selectedTopic
    ? getInvestigationHref(selectedTopic)
    : null;
  const analyzedFeedbackCount =
    feedbackOverviewMetrics.find((metric) => metric.id === "total-feedback")
      ?.value ?? "—";

  return (
    <main className="desktop-density-page mx-auto w-full px-5 py-7 sm:px-7 lg:px-6 lg:py-4">
      <header className="flex flex-col justify-between gap-5 border-b border-[#e6e9ef] pb-6 sm:flex-row sm:items-end lg:gap-2 lg:pb-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-[#7e8798] lg:gap-1.5 lg:text-[11px]">
            <span>Insights</span>
            <span aria-hidden="true" className="text-[#b3bac6]">/</span>
            <span className="text-[#4e5a70]">Feedback</span>
          </div>
          <h1 className="mt-3 text-[28px] font-semibold tracking-[-0.04em] text-[#172033] lg:mt-1.5 lg:text-[21px] lg:leading-7">
            Feedback Intelligence
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-5 text-[#6f7a8e] lg:mt-1 lg:text-[13px] lg:leading-[18px]">
            Understand emerging user pain points and connect qualitative evidence with product signals.
          </p>
        </div>
        <span className="w-fit rounded-md bg-[#fff6e4] px-2 py-1 text-[10px] font-bold tracking-[0.08em] text-[#8a5b00] lg:px-2 lg:py-0.5 lg:text-[9px]">
          DEMO DATA
        </span>
      </header>

      <section className="mt-6 lg:mt-4" aria-labelledby="feedback-overview-title">
        <div className="mb-3 flex items-center justify-between gap-4 lg:mb-2.5 lg:gap-3">
          <h2 id="feedback-overview-title" className="text-sm font-semibold text-[#344056] lg:text-[13px]">
            Feedback overview
          </h2>
          <p className="text-xs text-[#98a1b1] lg:text-[11px]">Last 30 days</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {feedbackOverviewMetrics.map((metric) => (
            <KpiCard
              key={metric.id}
              compactDesktop
              kpi={{
                status: "available",
                label: metric.label,
                value: metric.value,
                change: metric.change,
                changeDirection: metric.changeDirection,
                comparison: metric.comparison,
              }}
            />
          ))}
        </div>
      </section>

      <section className="mt-6 lg:mt-4" aria-labelledby="feedback-topics-title">
        <div className="mb-2.5 flex flex-wrap items-end justify-between gap-3 lg:mb-2.5 lg:gap-3">
          <div>
            <h2 id="feedback-topics-title" className="text-sm font-semibold text-[#344056] lg:text-[13px]">
              AI detected topics
            </h2>
            <p className="mt-1 text-xs text-[#98a1b1] lg:text-[11px]">
              Grouped patterns are investigation directions, not confirmed causes.
            </p>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-xs font-medium text-[#68748a] lg:text-[11px]">
              AI analyzed {analyzedFeedbackCount} feedback items
            </p>
            <p className="mt-1 text-xs text-[#98a1b1] lg:text-[11px]">
              Grouped into {feedbackTopics.length} emerging topics
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2 lg:gap-3 2xl:grid-cols-3">
          {feedbackTopics.map((topic) => (
            <TopicCard
              key={topic.id}
              topic={topic}
              selected={topic.id === selectedTopic?.id}
              onSelect={() => setSelectedTopicId(topic.id)}
            />
          ))}
        </div>
      </section>

      {selectedTopic && selectedInvestigationHref ? (
        <TopicDetail
          topic={selectedTopic}
          investigationHref={selectedInvestigationHref}
        />
      ) : null}
    </main>
  );
}
