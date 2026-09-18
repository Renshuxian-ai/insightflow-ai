import type { KpiCardViewModel } from "@/lib/overview/overview-view-model";

type KpiCardProps = {
  kpi: KpiCardViewModel;
  compactDesktop?: boolean;
};

export function KpiCard({ kpi, compactDesktop = false }: KpiCardProps) {
  if (kpi.status === "unavailable") {
    return (
      <article className={`rounded-xl border border-[#e7eaf0] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.02)] ${compactDesktop ? "lg:min-h-[88px] lg:p-3" : "lg:min-h-[112px] lg:p-[var(--card-padding)]"}`}>
        <p className={`text-[13px] font-medium text-[#657084] ${compactDesktop ? "lg:text-[11px] lg:leading-4" : "lg:text-[11px]"}`}>{kpi.label}</p>
        <p className={`mt-3 text-xl font-semibold tracking-[-0.03em] text-[#687387] ${compactDesktop ? "lg:mt-1.5 lg:text-[17px]" : "lg:mt-2 lg:text-[17px]"}`}>
          Unavailable
        </p>
        <p className={`mt-2 text-xs leading-5 text-[#98a1b1] ${compactDesktop ? "lg:mt-1.5 lg:text-[11px] lg:leading-4" : "lg:text-[11px] lg:leading-4"}`}>{kpi.reason}</p>
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
    <article className={`rounded-xl border border-[#e7eaf0] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.02)] ${compactDesktop ? "lg:min-h-[88px] lg:p-3" : "lg:min-h-[112px] lg:p-[var(--card-padding)]"}`}>
      <p className={`text-[13px] font-medium text-[#657084] ${compactDesktop ? "lg:text-[11px] lg:leading-4" : "lg:text-[11px]"}`}>{kpi.label}</p>
      <div className={`mt-3 flex items-end justify-between gap-3 ${compactDesktop ? "lg:mt-1.5 lg:gap-2" : "lg:mt-2 lg:gap-2"}`}>
        <p className={`text-[27px] font-semibold tracking-[-0.04em] text-[#172033] ${compactDesktop ? "lg:text-xl lg:leading-6" : "lg:text-[21px]"}`}>{kpi.value}</p>
        {kpi.change ? (
          <span
            className={`rounded-md px-2 py-1 text-xs font-semibold lg:px-1.5 lg:py-0.5 lg:text-[10px] ${changeClassName}`}
          >
            {kpi.change}
          </span>
        ) : null}
      </div>
      <p className={`mt-2 text-xs text-[#98a1b1] ${compactDesktop ? "lg:mt-1.5 lg:text-[11px] lg:leading-4" : "lg:text-[11px]"}`}>{kpi.comparison}</p>
    </article>
  );
}
