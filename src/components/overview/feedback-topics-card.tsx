import Link from "next/link";

import type { FeedbackTopicViewModel } from "@/lib/overview/overview-view-model";
import { overviewScrollRegionClassName } from "./overview-scroll-region";

type FeedbackTopicsCardProps = {
  topics: FeedbackTopicViewModel[];
  unavailableReason?: string;
};

export function FeedbackTopicsCard({
  topics,
  unavailableReason,
}: FeedbackTopicsCardProps) {
  return (
    <section className="flex h-[360px] min-h-0 flex-col rounded-xl border border-[#e7eaf0] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.02)]" aria-labelledby="feedback-topics-title">
      <div className="flex shrink-0 items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#98a1b1]">What users are saying</p>
          <h2 id="feedback-topics-title" className="mt-1 text-base font-semibold tracking-[-0.02em] text-[#172033]">Feedback topics</h2>
        </div>
        <Link
          href="/feedback"
          aria-label="View Feedback Intelligence"
          className="cursor-pointer text-xs font-semibold text-[#3559e8] transition-colors hover:text-[#2446cb] focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3559e8]/30"
        >
          View feedback <span aria-hidden="true">→</span>
        </Link>
      </div>
      {unavailableReason ? (
        <div className="mt-4 rounded-lg border border-[#e9ecf1] bg-[#fafbfc] px-4 py-6 text-center">
          <p className="text-sm font-semibold text-[#526078]">Unavailable</p>
          <p className="mt-1 text-xs leading-5 text-[#8a94a6]">
            {unavailableReason}
          </p>
        </div>
      ) : (
        <div className={`mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-y-contain pr-1 ${overviewScrollRegionClassName}`}>
          {topics.map((topic) => {
          const negative = topic.sentiment === "Negative";

          return (
            <article key={topic.name} className="flex min-h-[54px] items-center gap-3 rounded-lg bg-[#fafbfc] px-3 py-2.5">
              <div className={negative ? "grid size-8 shrink-0 place-items-center rounded-lg bg-[#fff0f0] text-[10px] font-bold text-[#c44242]" : "grid size-8 shrink-0 place-items-center rounded-lg bg-[#fff6e4] text-[10px] font-bold text-[#a86713]"}>
                {topic.mentionCount}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-[13px] font-semibold text-[#344056]">{topic.name}</h3>
                <p className="mt-0.5 text-xs text-[#8a94a6]">{topic.sentiment} sentiment</p>
              </div>
              <span className="text-xs font-semibold text-[#c44242]">{topic.change}</span>
            </article>
          );
          })}
        </div>
      )}
    </section>
  );
}
