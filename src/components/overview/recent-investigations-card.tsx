import Link from "next/link";

import type {
  InvestigationSource,
  InvestigationStatus,
} from "@/lib/investigations/mock-investigations";

import { overviewScrollRegionClassName } from "./overview-scroll-region";

export type RecentInvestigationItem = {
  id: string;
  title: string;
  source: InvestigationSource;
  status: InvestigationStatus;
  href: string;
};

const statusStyles: Record<InvestigationStatus, string> = {
  Investigating: "bg-[#edf1ff] text-[#3559e8]",
  "Validation ready": "bg-[#fff6e4] text-[#986315]",
  Validated: "bg-[#e9f8f0] text-[#168251]",
};

export function RecentInvestigationsCard({
  investigations,
}: {
  investigations: RecentInvestigationItem[];
}) {
  return (
    <section
      className="flex h-[360px] min-h-0 flex-col rounded-xl border border-[#e7eaf0] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.02)]"
      aria-labelledby="recent-investigations-title"
    >
      <div className="flex shrink-0 items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#98a1b1]">
            Analysis activity
          </p>
          <h2
            id="recent-investigations-title"
            className="mt-1 text-base font-semibold tracking-[-0.02em] text-[#172033]"
          >
            Recent investigations
          </h2>
        </div>
        <Link
          href="/investigations"
          className="shrink-0 text-xs font-semibold text-[#3559e8] transition-colors hover:text-[#2446cb]"
        >
          View investigations <span aria-hidden="true">→</span>
        </Link>
      </div>

      {investigations.length === 0 ? (
        <div className="mt-4 grid min-h-0 flex-1 place-items-center rounded-lg border border-[#e9ecf1] bg-[#fafbfc] px-5 text-center">
          <div>
            <p className="text-sm font-semibold text-[#526078]">
              No investigations yet
            </p>
            <p className="mt-1 text-xs leading-5 text-[#8a94a6]">
              Investigate a detected signal to start AI analysis.
            </p>
          </div>
        </div>
      ) : (
        <div
          className={`mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-y-contain pr-1 ${overviewScrollRegionClassName}`}
        >
          {investigations.map((investigation) => (
            <Link
              key={investigation.id}
              href={investigation.href}
              className="block rounded-lg border border-[#e9ecf1] bg-[#fafbfc] px-3.5 py-3 transition-colors hover:border-[#d7ddea] hover:bg-white"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-[10px] font-bold uppercase tracking-[0.08em] text-[#8a94a6]">
                  {investigation.source}
                </p>
                <span
                  className={`shrink-0 rounded-md px-2 py-1 text-[9px] font-bold uppercase tracking-[0.06em] ${statusStyles[investigation.status]}`}
                >
                  {investigation.status}
                </span>
              </div>
              <h3 className="mt-2 line-clamp-2 text-[13px] font-semibold leading-5 text-[#344056]">
                {investigation.title}
              </h3>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
