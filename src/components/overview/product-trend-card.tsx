import type { TrendPoint } from "@/lib/overview-mock-data";

type ProductTrendCardProps = {
  data: TrendPoint[];
};

function createLinePoints(data: TrendPoint[]) {
  const chartWidth = 600;
  const chartHeight = 178;
  const padding = 14;
  const values = data.map((point) => point.value);
  const minimum = Math.min(...values) - 5;
  const maximum = Math.max(...values) + 5;

  return data
    .map((point, index) => {
      const x = padding + (index / (data.length - 1)) * (chartWidth - padding * 2);
      const y =
        chartHeight -
        padding -
        ((point.value - minimum) / (maximum - minimum)) *
          (chartHeight - padding * 2);
      return x + "," + y;
    })
    .join(" ");
}

export function ProductTrendCard({ data }: ProductTrendCardProps) {
  const linePoints = createLinePoints(data);
  const fillPoints = "14,164 " + linePoints + " 586,164";

  return (
    <section className="rounded-xl border border-[#e7eaf0] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.02)]" aria-labelledby="product-trend-title">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#98a1b1]">Product health</p>
          <h2 id="product-trend-title" className="mt-1 text-base font-semibold tracking-[-0.02em] text-[#172033]">Product trend</h2>
          <p className="mt-1 text-[13px] text-[#778196]">Daily active users over the last 30 days</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold tracking-[-0.03em] text-[#172033]">12.5k</p>
          <p className="text-xs font-medium text-[#168251]">+8.2% vs. previous period</p>
        </div>
      </div>

      <div className="mt-5 overflow-hidden">
        <svg viewBox="0 0 600 178" className="h-[190px] w-full" preserveAspectRatio="none" role="img" aria-label="Daily active users trend rising over the last 30 days">
          <defs>
            <linearGradient id="trend-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#3559e8" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#3559e8" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[35, 78, 121, 164].map((y) => (
            <line key={y} x1="0" x2="600" y1={y} y2={y} stroke="#edf0f5" strokeWidth="1" />
          ))}
          <polygon points={fillPoints} fill="url(#trend-fill)" />
          <polyline points={linePoints} fill="none" stroke="#3559e8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div className="flex justify-between px-1 text-[11px] text-[#98a1b1]">
          {data.map((point) => <span key={point.label}>{point.label}</span>)}
        </div>
      </div>
    </section>
  );
}
