import type { UserSegmentViewModel } from "@/lib/overview/overview-view-model";

type UserSegmentCardProps = {
  segments: UserSegmentViewModel[];
  unavailableReason?: string;
};

export function UserSegmentCard({
  segments,
  unavailableReason,
}: UserSegmentCardProps) {
  return (
    <section className="rounded-xl border border-[#e7eaf0] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.02)] lg:p-[var(--card-padding-lg)]" aria-labelledby="user-segments-title">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#98a1b1] lg:text-[10px]">Who is changing</p>
          <h2 id="user-segments-title" className="mt-1 text-base font-semibold tracking-[-0.02em] text-[#172033] lg:mt-0.5 lg:text-[13px]">User segments</h2>
        </div>
        <span className="text-xs font-semibold text-[#3559e8]">View users →</span>
      </div>
      {unavailableReason ? (
        <div className="mt-4 rounded-lg border border-[#e9ecf1] bg-[#fafbfc] px-4 py-6 text-center lg:mt-2 lg:px-3 lg:py-4">
          <p className="text-sm font-semibold text-[#526078] lg:text-xs">Unavailable</p>
          <p className="mt-1 text-xs leading-5 text-[#8a94a6] lg:text-[11px] lg:leading-4">
            {unavailableReason}
          </p>
        </div>
      ) : (
        <div className="mt-4 divide-y divide-[#eef0f4] lg:mt-1.5">
          {segments.map((segment) => (
          <article key={segment.name} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0 lg:py-1.5">
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
      )}
    </section>
  );
}
