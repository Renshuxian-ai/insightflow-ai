import type { FeedbackTopic } from "@/lib/overview-mock-data";

type FeedbackTopicsCardProps = {
  topics: FeedbackTopic[];
};

export function FeedbackTopicsCard({ topics }: FeedbackTopicsCardProps) {
  return (
    <section className="rounded-xl border border-[#e7eaf0] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.02)]" aria-labelledby="feedback-topics-title">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#98a1b1]">What users are saying</p>
          <h2 id="feedback-topics-title" className="mt-1 text-base font-semibold tracking-[-0.02em] text-[#172033]">Feedback topics</h2>
        </div>
        <span className="text-xs font-semibold text-[#3559e8]">View feedback →</span>
      </div>
      <div className="mt-4 space-y-3">
        {topics.map((topic) => {
          const negative = topic.sentiment === "Negative";

          return (
            <article key={topic.name} className="flex items-center gap-3 rounded-lg bg-[#fafbfc] px-3 py-3">
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
    </section>
  );
}
