import type { KpiCardViewModel } from "@/lib/overview/overview-view-model";

type KpiCardProps = {
  kpi: KpiCardViewModel;
};

export function KpiCard({ kpi }: KpiCardProps) {
  if (kpi.status === "unavailable") {
    return (
      <article className="rounded-xl border border-[#e7eaf0] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.02)]">
        <p className="text-[13px] font-medium text-[#657084]">{kpi.label}</p>
        <p className="mt-3 text-xl font-semibold tracking-[-0.03em] text-[#687387]">
          Unavailable
        </p>
        <p className="mt-2 text-xs leading-5 text-[#98a1b1]">{kpi.reason}</p>
      </article>
    );
  }

  const changeClassName =
    kpi.changeDirection === "positive"
      ? "bg-[#e9f8f0] text-[#168251]"
      : kpi.changeDirection === "negative"
        ? "bg-[#fff0f0] text-[#c44242]"
        : "bg-[#f1f3f6] text-[#687387]";

  return (
    <article className="rounded-xl border border-[#e7eaf0] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.02)]">
      <p className="text-[13px] font-medium text-[#657084]">{kpi.label}</p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="text-[27px] font-semibold tracking-[-0.04em] text-[#172033]">{kpi.value}</p>
        {kpi.change ? (
          <span
            className={`rounded-md px-2 py-1 text-xs font-semibold ${changeClassName}`}
          >
            {kpi.change}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-xs text-[#98a1b1]">{kpi.comparison}</p>
    </article>
  );
}
