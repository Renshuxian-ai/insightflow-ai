"use client";

import Link from "next/link";
import { useState } from "react";

import { useDatasetWorkspaceSession } from "@/components/datasets/dataset-workspace-session";
import { KpiCard } from "@/components/overview/kpi-card";
import {
  type ProductReport,
} from "@/lib/reports/mock-reports";
import { RUNTIME_SESSION_HEADER } from "@/lib/runtime-session";

const RECENT_WINDOW_MS = 30 * 24 * 60 * 60 * 1_000;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function ArrowIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <path
        d="M5 12h14m-5-5 5 5-5 5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ReportCard({
  report,
  canDelete,
  deleting,
  onDelete,
}: {
  report: ProductReport;
  canDelete: boolean;
  deleting: boolean;
  onDelete: (report: ProductReport) => void;
}) {
  return (
    <article className="group relative isolate min-h-[172px] overflow-hidden rounded-xl border border-[#e1e5ec] bg-white transition-colors duration-200 before:pointer-events-none before:absolute before:right-0 before:bottom-0 before:z-20 before:size-7 before:bg-white before:content-[''] before:[clip-path:polygon(0_100%,100%_0,100%_100%)] after:pointer-events-none after:absolute after:right-0 after:bottom-0 after:z-30 after:size-6 after:bg-[#f7f8fa] after:content-[''] after:[clip-path:polygon(0_100%,100%_0,100%_100%)] hover:border-[#c7d0df] focus-within:border-[#b9c6dc] lg:min-h-[104px]">
      <div className="relative z-10 flex min-h-[172px] flex-col p-5 pr-7 lg:min-h-[104px] lg:p-3 lg:pr-5">
        <div className="flex items-start justify-between gap-3 lg:gap-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.09em] text-[#7e8798]">
            {report.source}
          </p>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[#cdebdc] bg-[#e9f8f0] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.06em] text-[#168251] lg:gap-1 lg:px-1.5 lg:py-0.5 lg:text-[9px]">
            <span className="size-1.5 rounded-full bg-[#35a772] lg:size-1" />
            {report.status}
          </span>
        </div>

        <h2 className="mt-4 text-lg font-semibold tracking-[-0.03em] text-[#263247] lg:mt-1.5 lg:text-[13px] lg:leading-[18px]">
          {report.title}
        </h2>

        <dl className="mt-auto flex items-end justify-between gap-4 pt-5 lg:gap-3 lg:pt-1.5">
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#a0a8b5] lg:text-[9px]">
              Created
            </dt>
            <dd className="mt-1 text-xs font-medium text-[#68748a] lg:mt-0.5 lg:text-[10px]">
              {formatDate(report.createdAt)}
            </dd>
          </div>
          <div className="text-right">
            <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#a0a8b5] lg:text-[9px]">
              Evidence sources
            </dt>
            <dd className="mt-1 text-xs font-medium text-[#68748a] lg:mt-0.5 lg:text-[10px]">
              {report.supportingEvidence.length}
            </dd>
          </div>
        </dl>

        <div className="max-h-56 overflow-hidden pt-4 opacity-100 transition-[max-height,opacity,transform] duration-200 lg:max-h-0 lg:translate-y-2 lg:pt-0 lg:opacity-0 lg:group-hover:max-h-56 lg:group-hover:translate-y-0 lg:group-hover:pt-2.5 lg:group-hover:opacity-100 lg:group-focus-within:max-h-56 lg:group-focus-within:translate-y-0 lg:group-focus-within:pt-2.5 lg:group-focus-within:opacity-100">
          <div className="border-t border-[#eef0f4] pt-4 lg:pt-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#7e8798]">
              AI summary preview
            </p>
            <p className="mt-2 line-clamp-2 text-[13px] leading-5 text-[#526078] lg:text-xs lg:leading-[17px]">
              {report.aiSummary}
            </p>

            <div className="mt-4 flex flex-wrap justify-end gap-2 lg:mt-3">
              {canDelete ? (
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => onDelete(report)}
                  className="inline-flex h-9 cursor-pointer items-center rounded-lg border border-[#e4d7d7] bg-white px-3 text-xs font-semibold text-[#a24b4b] transition-colors hover:border-[#d8bebe] hover:bg-[#fff8f8] disabled:cursor-wait disabled:opacity-60 lg:h-7 lg:px-2.5 lg:text-[10px]"
                >
                  {deleting ? "Deleting..." : "Delete report"}
                </button>
              ) : null}
              <Link
                href={`/reports/${encodeURIComponent(report.id)}`}
                className="inline-flex h-9 w-fit items-center gap-1.5 rounded-lg border border-[#d9dee8] bg-white px-3.5 text-xs font-semibold text-[#526078] transition-colors hover:border-[#c4ccda] hover:bg-[#fafbfc] hover:text-[#263247] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3559e8]/25 lg:h-7 lg:px-2.5 lg:text-[10px]"
              >
                View report
                <ArrowIcon />
              </Link>
            </div>
          </div>
        </div>
      </div>

    </article>
  );
}

export function ReportsPage({
  reports: sourceReports,
  canDelete = false,
}: {
  reports: ProductReport[];
  canDelete?: boolean;
}) {
  const { runtimeSessionId } = useDatasetWorkspaceSession();
  const [storedReports, setStoredReports] = useState(sourceReports);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const reports = [...storedReports].sort(
    (left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt),
  );
  const newestReportTime = reports.length > 0
    ? Math.max(...reports.map((report) => Date.parse(report.updatedAt)))
    : null;
  const recentReports = reports.filter(
    (report) =>
      newestReportTime !== null &&
      newestReportTime - Date.parse(report.updatedAt) <= RECENT_WINDOW_MS,
  ).length;
  const validatedReports = reports.filter(
    (report) => report.status === "Validated",
  ).length;

  async function handleDelete(report: ProductReport) {
    if (!window.confirm("Delete this report?")) {
      return;
    }

    setDeletingId(report.id);

    try {
      const response = await fetch("/api/reports", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          [RUNTIME_SESSION_HEADER]: runtimeSessionId,
        },
        body: JSON.stringify({ reportId: report.id }),
      });

      if (!response.ok) {
        throw new Error("Report could not be deleted.");
      }

      setStoredReports((current) =>
        current.filter((item) => item.id !== report.id),
      );
    } catch {
      window.alert("Report could not be deleted. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="desktop-density-page mx-auto w-full px-5 py-7 sm:px-7 lg:px-6 lg:py-4">
      <header className="border-b border-[#e6e9ef] pb-6 lg:pb-3">
        <div className="flex items-center gap-2 text-xs font-medium text-[#7e8798] lg:gap-1.5 lg:text-[11px]">
          <span>Insights</span>
          <span aria-hidden="true" className="text-[#b3bac6]">
            /
          </span>
          <span className="text-[#4e5a70]">Reports</span>
        </div>
        <h1 className="mt-3 text-[28px] font-semibold tracking-[-0.04em] text-[#172033] lg:mt-1.5 lg:text-[21px] lg:leading-7">
          Reports
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-5 text-[#6f7a8e] lg:mt-1 lg:text-[13px] lg:leading-[18px]">
          Validated investigation reports and product insights.
        </p>
      </header>

      <section className="mt-6 lg:mt-4" aria-label="Report statistics">
        <div className="grid gap-3 sm:grid-cols-3">
          <KpiCard
            compactDesktop
            kpi={{
              status: "available",
              label: "Total reports",
              value: String(reports.length),
              change: null,
              changeDirection: "neutral",
              comparison: "Available in the report library",
            }}
          />
          <KpiCard
            compactDesktop
            kpi={{
              status: "available",
              label: "Validated reports",
              value: String(validatedReports),
              change: null,
              changeDirection: "positive",
              comparison: "Based on validated investigations",
            }}
          />
          <KpiCard
            compactDesktop
            kpi={{
              status: "available",
              label: "Recent reports",
              value: String(recentReports),
              change: null,
              changeDirection: "neutral",
              comparison: "Updated in the latest 30-day window",
            }}
          />
        </div>
      </section>

      <section className="mt-6 lg:mt-4" aria-labelledby="report-library-title">
        <div className="mb-3 flex items-end justify-between gap-3 lg:mb-2.5">
          <div>
            <h2
              id="report-library-title"
              className="text-sm font-semibold text-[#344056] lg:text-[13px]"
            >
              Report Library
            </h2>
            <p className="mt-1 text-xs text-[#98a1b1] lg:text-[11px]">
              Concise reports created from completed validation workflows.
            </p>
          </div>
          <p className="text-xs text-[#98a1b1] lg:text-[11px]">
            {reports.length} report{reports.length === 1 ? "" : "s"}
          </p>
        </div>

        {reports.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-2 lg:gap-3 2xl:grid-cols-3">
            {reports.map((report) => (
              <ReportCard
                key={report.id}
                report={report}
                canDelete={canDelete}
                deleting={deletingId === report.id}
                onDelete={handleDelete}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-[#dfe3eb] bg-white px-5 py-12 text-center">
            <p className="text-sm font-semibold text-[#526078]">
              No reports yet
            </p>
            <p className="mt-1 text-xs text-[#98a1b1]">
              Reports appear after a dataset-backed investigation completes validation.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
