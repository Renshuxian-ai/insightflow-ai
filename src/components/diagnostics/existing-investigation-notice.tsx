import Link from "next/link";

import type { InvestigationStatus } from "@/lib/investigations/mock-investigations";

import { InvestigationLaunchLink } from "./investigation-launch-link";

export type ExistingInvestigationLifecycle = {
  status: InvestigationStatus;
  createdAt: string;
  investigationHref: string;
  reportHref?: string;
  newRunHref: string;
};

export function ExistingInvestigationNotice({
  investigation,
}: {
  investigation: ExistingInvestigationLifecycle;
}) {
  const createdAt = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(investigation.createdAt));

  return (
    <section className="rounded-xl border border-[#d8e0ff] bg-[#f7f9ff] px-5 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#5269c9]">
        Existing investigation found
      </p>
      <p className="mt-1 text-sm leading-6 text-[#526078]">
        This Dataset signal already has an investigation created on {createdAt}.
        Its current status is {investigation.status}.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={investigation.investigationHref}
          className="inline-flex h-8 items-center rounded-lg border border-[#c6d1fb] bg-white px-3 text-xs font-semibold text-[#3559e8] transition-colors hover:bg-[#edf1ff]"
        >
          View existing investigation
        </Link>
        {investigation.reportHref ? (
          <Link
            href={investigation.reportHref}
            className="inline-flex h-8 items-center rounded-lg border border-[#c6d1fb] bg-white px-3 text-xs font-semibold text-[#3559e8] transition-colors hover:bg-[#edf1ff]"
          >
            View report
          </Link>
        ) : null}
        <InvestigationLaunchLink
          href={investigation.newRunHref}
          className="inline-flex h-8 items-center rounded-lg px-3 text-xs font-semibold text-[#526078] transition-colors hover:bg-white hover:text-[#263247]"
        >
          Run new investigation
        </InvestigationLaunchLink>
      </div>
    </section>
  );
}
