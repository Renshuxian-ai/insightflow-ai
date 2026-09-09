import type { UserSegment } from "@/lib/overview-mock-data";

type UserSegmentCardProps = {
  segments: UserSegment[];
};

export function UserSegmentCard({ segments }: UserSegmentCardProps) {
  return (
    <section className="rounded-xl border border-[#e7eaf0] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.02)]" aria-labelledby="user-segments-title">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#98a1b1]">Who is changing</p>
          <h2 id="user-segments-title" className="mt-1 text-base font-semibold tracking-[-0.02em] text-[#172033]">User segments</h2>
        </div>
        <span className="text-xs font-semibold text-[#3559e8]">View users →</span>
      </div>
      <div className="mt-4 divide-y divide-[#eef0f4]">
        {segments.map((segment) => (
          <article key={segment.name} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <h3 className="truncate text-[13px] font-semibold text-[#344056]">{segment.name}</h3>
              <p className="mt-0.5 text-xs text-[#8a94a6]">{segment.description} · {segment.users}</p>
            </div>
            <span className={segment.changeDirection === "positive" ? "shrink-0 text-xs font-semibold text-[#168251]" : "shrink-0 text-xs font-semibold text-[#c44242]"}>
              {segment.change}
            </span>
          </article>
        ))}
      </div>
    </section>
  );
}
