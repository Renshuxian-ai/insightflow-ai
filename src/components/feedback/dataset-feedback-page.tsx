"use client";

import { useState } from "react";

import { InvestigationLaunchLink } from "@/components/diagnostics/investigation-launch-link";
import type {
  FeedbackRuntime,
  FeedbackRuntimeTopic,
} from "@/lib/analytics/analytics-runtime";
import { buildAnalyticsInvestigationHref } from "@/lib/analytics/investigation-context";

type AvailableFeedbackRuntime = Extract<
  FeedbackRuntime,
  { status: "available" }
>;

const sentimentStyles: Record<
  FeedbackRuntimeTopic["sentiment"],
  string
> = {
  negative: "bg-[#fff0f0] text-[#c44242]",
  mixed: "bg-[#fff6e4] text-[#986315]",
  neutral: "bg-[#f1f3f6] text-[#687387]",
  positive: "bg-[#ebf8f1] text-[#168251]",
  unknown: "bg-[#f1f3f6] text-[#7e8798]",
};

function formatTrend(topic: FeedbackRuntimeTopic) {
  if (!topic.trend) {
    return "Trend unavailable";
  }

  const change = topic.trend.changePercent;
  return `${change > 0 ? "+" : ""}${change.toFixed(1)}% vs. previous period`;
}

function investigationHref(topic: FeedbackRuntimeTopic) {
  const context = topic.investigationContext;

  return context
    ? buildAnalyticsInvestigationHref(
        `/ai-diagnostics/${encodeURIComponent(context.signalId)}`,
        context,
        { returnTo: "/feedback" },
      )
    : null;
}

export function DatasetFeedbackPage({
  runtime,
}: {
  runtime: AvailableFeedbackRuntime;
}) {
  const [selectedTopicId, setSelectedTopicId] = useState(
    runtime.topics[0]?.id ?? "",
  );
  const selectedTopic =
    runtime.topics.find((topic) => topic.id === selectedTopicId) ??
    runtime.topics[0];
  const href = selectedTopic ? investigationHref(selectedTopic) : null;

  return (
    <main className="mx-auto w-full max-w-[1440px] px-5 py-7 sm:px-7 lg:px-10 lg:py-9">
      <header className="flex flex-col justify-between gap-5 border-b border-[#e6e9ef] pb-6 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-[#7e8798]">
            <span>Insights</span><span aria-hidden="true">/</span><span className="text-[#4e5a70]">Feedback</span>
          </div>
          <h1 className="mt-3 text-[28px] font-semibold tracking-[-0.04em] text-[#172033]">
            Feedback Intelligence
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-5 text-[#6f7a8e]">
            Explore topic, sentiment, and quote evidence observed in the uploaded dataset.
          </p>
        </div>
        <span className="w-fit rounded-md bg-[#edf1ff] px-2 py-1 text-[10px] font-bold tracking-[0.08em] text-[#3559e8]">
          UPLOADED DATASET
        </span>
      </header>

      <section className="mt-6" aria-labelledby="feedback-overview-title">
        <div className="mb-3 flex items-center justify-between gap-4">
          <h2 id="feedback-overview-title" className="text-sm font-semibold text-[#344056]">
            Feedback overview
          </h2>
          <p className="text-xs text-[#98a1b1]">Observed dataset evidence</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: "Total feedback",
              value: runtime.totalFeedback.toLocaleString("en-US"),
              detail: "Rows with topic and feedback text",
            },
            {
              label: "Negative feedback",
              value:
                runtime.negativeFeedbackRate === null
                  ? "Unavailable"
                  : `${runtime.negativeFeedbackRate.toFixed(1)}%`,
              detail: "Observed negative sentiment share",
            },
            {
              label: "Detected topics",
              value: runtime.topics.length.toLocaleString("en-US"),
              detail: "Topics present in the uploaded data",
            },
            {
              label: "Linked product signals",
              value: "Unavailable",
              detail: "No cross-surface link is inferred automatically",
            },
          ].map((metric) => (
            <article key={metric.label} className="rounded-xl border border-[#e7eaf0] bg-white p-5">
              <p className="text-[13px] font-medium text-[#657084]">{metric.label}</p>
              <p className="mt-3 text-[25px] font-semibold tracking-[-0.04em] text-[#172033]">{metric.value}</p>
              <p className="mt-2 text-xs leading-4 text-[#98a1b1]">{metric.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-6" aria-labelledby="feedback-topics-title">
        <div className="mb-2.5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="feedback-topics-title" className="text-sm font-semibold text-[#344056]">
              Detected topics
            </h2>
            <p className="mt-1 text-xs text-[#98a1b1]">
              Dataset groupings are evidence to inspect, not causal conclusions.
            </p>
          </div>
          <p className="text-xs text-[#68748a]">
            Analyzed {runtime.totalFeedback.toLocaleString("en-US")} feedback items
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {runtime.topics.map((topic) => (
            <button
              key={topic.id}
              type="button"
              aria-pressed={selectedTopic?.id === topic.id}
              onClick={() => setSelectedTopicId(topic.id)}
              className={`min-h-[210px] cursor-pointer rounded-xl border bg-white p-5 text-left transition-colors ${
                selectedTopic?.id === topic.id
                  ? "border-[#aebeff] ring-2 ring-[#3559e8]/10"
                  : "border-[#e7eaf0] hover:border-[#d5dbea]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#98a1b1]">
                    Dataset topic
                  </p>
                  <h3 className="mt-1.5 text-base font-semibold text-[#263247]">{topic.title}</h3>
                </div>
                <span className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase ${sentimentStyles[topic.sentiment]}`}>
                  {topic.sentiment}
                </span>
              </div>
              <p className="mt-6 text-[25px] font-semibold tracking-[-0.04em] text-[#172033]">
                {topic.mentionCount}
              </p>
              <p className="text-xs text-[#8a94a6]">mentions</p>
              <p className="mt-5 border-t border-[#eef0f4] pt-4 text-xs font-medium text-[#68748a]">
                {formatTrend(topic)}
              </p>
            </button>
          ))}
        </div>
      </section>

      {selectedTopic ? (
        <section className="mt-6" aria-labelledby="dataset-feedback-detail-title">
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <div>
              <h2 id="dataset-feedback-detail-title" className="text-sm font-semibold text-[#344056]">Topic detail</h2>
              <p className="mt-1 text-xs text-[#98a1b1]">Observed evidence for {selectedTopic.title}</p>
            </div>
            {href ? (
              <InvestigationLaunchLink href={href} className="inline-flex h-9 items-center rounded-lg bg-[#3559e8] px-3.5 text-xs font-semibold text-white hover:bg-[#2446cb]">
                Investigate <span aria-hidden="true" className="ml-1">→</span>
              </InvestigationLaunchLink>
            ) : (
              <span className="rounded-md bg-[#f1f3f6] px-2 py-1 text-[10px] font-bold text-[#687387]">
                INVESTIGATION EVIDENCE INSUFFICIENT
              </span>
            )}
          </div>
          <div className="rounded-xl border border-[#e7eaf0] bg-white p-5">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-[#edf1ff] px-2 py-1 text-[10px] font-bold uppercase text-[#3559e8]">Evidence</span>
              <h3 className="text-sm font-semibold text-[#344056]">Representative feedback quotes</h3>
            </div>
            {selectedTopic.quotes.length > 0 ? (
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {selectedTopic.quotes.map((quote, index) => (
                  <figure key={`${selectedTopic.id}-${index}`} className="rounded-lg border border-[#e9ecf1] bg-[#fafbfc] p-4">
                    <blockquote className="text-[13px] leading-5 text-[#526078]">“{quote}”</blockquote>
                    <figcaption className="mt-3 text-[11px] text-[#98a1b1]">Uploaded dataset</figcaption>
                  </figure>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-xs text-[#98a1b1]">Representative quote evidence is unavailable.</p>
            )}
          </div>
        </section>
      ) : null}
    </main>
  );
}
