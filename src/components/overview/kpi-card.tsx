import type { Kpi } from "@/lib/overview-mock-data";

type KpiCardProps = {
  kpi: Kpi;
};

export function KpiCard({ kpi }: KpiCardProps) {
  const isPositive = kpi.changeDirection === "positive";

  return (
    <article className="rounded-xl border border-[#e7eaf0] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.02)]">
      <p className="text-[13px] font-medium text-[#657084]">{kpi.label}</p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="text-[27px] font-semibold tracking-[-0.04em] text-[#172033]">{kpi.value}</p>
        <span className={isPositive ? "rounded-md bg-[#e9f8f0] px-2 py-1 text-xs font-semibold text-[#168251]" : "rounded-md bg-[#fff0f0] px-2 py-1 text-xs font-semibold text-[#c44242]"}>
          {kpi.change}
        </span>
      </div>
      <p className="mt-2 text-xs text-[#98a1b1]">{kpi.comparison}</p>
    </article>
  );
}
