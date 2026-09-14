import type { DemoAnalyticsResult } from "@/lib/analytics/demo-analytics";

import { AnalyticsSectionHeader } from "./analytics-page-frame";

type RetentionBreakdowns =
  DemoAnalyticsResult["retention"]["breakdowns"];
type RetentionBreakdownSegment = RetentionBreakdowns["platform"][number];

function formatUsers(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatRate(value: number) {
  return `${value.toFixed(0)}%`;
}

function formatChange(value: number) {
  if (value === 0) {
    return "Baseline";
  }

  return `${value > 0 ? "+" : ""}${value.toFixed(0)} pp`;
}

function buildBreakdownRows(segments: RetentionBreakdownSegment[]) {
  const benchmarkD7 = Math.max(...segments.map((segment) => segment.D7));
  const rows = segments.map((segment) => ({
    ...segment,
    change: segment.D7 - benchmarkD7,
  }));
  const largestDecline = Math.min(...rows.map((segment) => segment.change));

  return rows.map((segment) => ({
    ...segment,
    isLargestDecline:
      segment.change < 0 && segment.change === largestDecline,
  }));
}

function BreakdownTable({
  label,
  segments,
}: {
  label: string;
  segments: RetentionBreakdownSegment[];
}) {
  const rows = buildBreakdownRows(segments);

  return (
    <article className="min-w-0 rounded-xl border border-[#e7eaf0] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.02)]">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#98a1b1]">
          {label}
        </p>
        <h3 className="mt-1 text-sm font-semibold text-[#344056]">
          Retention by {label.toLowerCase()}
        </h3>
        <p className="mt-1 text-[11px] leading-4 text-[#8a94a6]">
          Change shows the D7 gap from the strongest segment.
        </p>
      </div>

      <div className="mt-3 w-full min-w-0 overflow-x-auto overflow-y-hidden">
        <table className="w-full min-w-[620px] border-separate border-spacing-y-1 text-left">
          <thead>
            <tr className="text-[10px] font-semibold uppercase tracking-[0.07em] text-[#98a1b1]">
              <th className="px-3 py-2">Segment</th>
              <th className="px-3 py-2">Users</th>
              <th className="px-3 py-2 text-right">D1</th>
              <th className="px-3 py-2 text-right">D7</th>
              <th className="px-3 py-2 text-right">D30</th>
              <th className="px-3 py-2 text-right">Change</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((segment) => {
              const surfaceClass = segment.isLargestDecline
                ? "bg-[#fff3f3]"
                : "bg-[#f8f9fb]";

              return (
                <tr key={segment.name}>
                  <td
                    className={`rounded-l-lg px-3 py-3 ${surfaceClass}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold text-[#344056]">
                        {segment.name}
                      </span>
                      {segment.isLargestDecline ? (
                        <span className="rounded-md bg-[#ffe5e5] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.06em] text-[#bd3f3f]">
                          Largest gap
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className={`px-3 py-3 ${surfaceClass}`}>
                    <span className="whitespace-nowrap text-xs text-[#657084]">
                      {formatUsers(segment.users)} users
                    </span>
                  </td>
                  <td
                    className={`px-3 py-3 text-right text-[13px] font-semibold text-[#4e5a70] ${surfaceClass}`}
                  >
                    {formatRate(segment.D1)}
                  </td>
                  <td
                    className={`px-3 py-3 text-right text-[13px] font-semibold ${
                      segment.isLargestDecline
                        ? "text-[#bd3f3f]"
                        : "text-[#4e5a70]"
                    } ${surfaceClass}`}
                  >
                    {formatRate(segment.D7)}
                  </td>
                  <td
                    className={`px-3 py-3 text-right text-[13px] font-semibold text-[#4e5a70] ${surfaceClass}`}
                  >
                    {formatRate(segment.D30)}
                  </td>
                  <td
                    className={`rounded-r-lg px-3 py-3 text-right text-xs font-semibold ${
                      segment.change < 0
                        ? "text-[#bd3f3f]"
                        : "text-[#7e8798]"
                    } ${surfaceClass}`}
                  >
                    {formatChange(segment.change)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </article>
  );
}

export function RetentionBreakdown({
  breakdowns,
}: {
  breakdowns: RetentionBreakdowns;
}) {
  return (
    <section className="mt-6" aria-label="Retention breakdown">
      <AnalyticsSectionHeader
        title="Retention breakdown"
        meta="Segment evidence"
      />
      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        <BreakdownTable label="Platform" segments={breakdowns.platform} />
        <BreakdownTable label="User type" segments={breakdowns.userType} />
      </div>
    </section>
  );
}
