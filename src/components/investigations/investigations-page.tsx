"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { useDatasetWorkspaceSession } from "@/components/datasets/dataset-workspace-session";
import { KpiCard } from "@/components/overview/kpi-card";
import { RUNTIME_SESSION_HEADER } from "@/lib/runtime-session";
import type {
  InvestigationSource,
  InvestigationStatus,
  MockInvestigation,
} from "@/lib/investigations/mock-investigations";

type SourceFilter = "All" | InvestigationSource;
type StatusFilter = "All" | InvestigationStatus;

const sourceFilters: SourceFilter[] = [
  "All",
  "Trends Analytics",
  "Retention Analytics",
  "Funnel Analytics",
  "Feedback Intelligence",
];

const statusFilters: StatusFilter[] = [
  "All",
  "Investigating",
  "Validation ready",
  "Validated",
];

const statusStyles: Record<
  InvestigationStatus,
  { badge: string; dot: string }
> = {
  Investigating: {
    badge: "border-[#d8e0ff] bg-[#edf1ff] text-[#3559e8]",
    dot: "bg-[#5270e8]",
  },
  "Validation ready": {
    badge: "border-[#f3dfb5] bg-[#fff6e4] text-[#986315]",
    dot: "bg-[#d79a3b]",
  },
  Validated: {
    badge: "border-[#cdebdc] bg-[#e9f8f0] text-[#168251]",
    dot: "bg-[#35a772]",
  },
};

const investigationPresentation: Record<
  string,
  { aiFinding: string; createdAt: string }
> = {
  "d1-retention-decline": {
    aiFinding:
      "New users show weaker retention after the selected onboarding period.",
    createdAt: "2026-09-12",
  },
  "complete-step3-dropoff": {
    aiFinding:
      "The largest measured funnel loss is concentrated at Complete Step3.",
    createdAt: "2026-09-14",
  },
  "search-relevance-issue": {
    aiFinding:
      "Search relevance complaints are increasing among search-heavy teams.",
    createdAt: "2026-09-15",
  },
};

const actionStyles: Record<InvestigationStatus, string> = {
  Investigating:
    "border-[#3559e8] bg-[#3559e8] text-white hover:border-[#2446cb] hover:bg-[#2446cb]",
  "Validation ready":
    "border-[#e4c984] bg-[#fffaf0] text-[#8a5b00] hover:border-[#d8b85e] hover:bg-[#fff6e4]",
  Validated:
    "border-[#d9dee8] bg-white text-[#526078] hover:border-[#c4ccda] hover:bg-[#fafbfc] hover:text-[#263247]",
};

function getActionLabel(status: InvestigationStatus) {
  if (status === "Investigating") {
    return "Continue investigation";
  }

  if (status === "Validation ready") {
    return "Review validation";
  }

  return "View report";
}

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

function FilterGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8a94a6] lg:text-[10px]">
        {label}
      </legend>
      <div className="mt-2 flex flex-wrap gap-1.5 lg:mt-1.5">
        {options.map((option) => {
          const active = option === value;

          return (
            <button
              key={option}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(option)}
              className={[
                "h-8 cursor-pointer rounded-lg border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3559e8]/25 lg:h-7 lg:px-2.5 lg:text-[11px]",
                active
                  ? "border-[#b9c5f6] bg-[#edf1ff] text-[#3559e8]"
                  : "border-[#e2e6ed] bg-white text-[#657084] hover:border-[#cfd5df] hover:bg-[#fafbfc] hover:text-[#344056]",
              ].join(" ")}
            >
              {option}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function InvestigationCard({
  investigation,
  canDelete,
  deleting,
  onDelete,
}: {
  investigation: MockInvestigation;
  canDelete: boolean;
  deleting: boolean;
  onDelete: (investigation: MockInvestigation) => void;
}) {
  const presentation = investigationPresentation[investigation.id] ?? {
    aiFinding:
      investigation.aiFinding ??
      "The available evidence identifies a product signal that requires further investigation.",
    createdAt: investigation.createdAt ?? investigation.updatedAt,
  };
  const statusStyle = statusStyles[investigation.status];
  const actionHref =
    investigation.status === "Validated"
      ? investigation.reportHref ?? `/reports/${investigation.id}`
      : investigation.href;

  return (
    <article className="flex min-h-[410px] flex-col rounded-xl border border-[#e7eaf0] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.02)] lg:min-h-[236px] lg:p-3">
      <div className="flex items-start justify-between gap-3 lg:gap-2">
        <p className="min-w-0 text-[10px] font-bold uppercase tracking-[0.09em] text-[#7e8798]">
          {investigation.source}
        </p>
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.06em] lg:gap-1 lg:px-1.5 lg:py-0.5 lg:text-[9px] ${statusStyle.badge}`}
        >
          <span className={`size-1.5 rounded-full lg:size-1 ${statusStyle.dot}`} />
          {investigation.status}
        </span>
      </div>

      <div className="mt-4 lg:mt-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#98a1b1] lg:text-[10px]">
          Problem
        </p>
        <h2 className="mt-1.5 text-base font-semibold tracking-[-0.02em] text-[#263247] lg:mt-0.5 lg:text-[13px] lg:leading-[18px]">
          {investigation.title}
        </h2>
      </div>

      <div className="mt-4 rounded-lg border border-[#e8ebf1] bg-[#fafbfc] p-3.5 lg:mt-1.5 lg:p-2.5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#7e8798] lg:text-[10px]">
            AI finding
          </p>
          <span className="rounded-md bg-[#edf1ff] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-[#5269c9] lg:px-1.5 lg:py-0.5">
            AI summary
          </span>
        </div>
        <p className="mt-2 text-[13px] leading-5 text-[#526078] lg:mt-1 lg:text-xs lg:leading-[17px]">
          {presentation.aiFinding}
        </p>
        <p className="mt-2 text-[11px] leading-4 text-[#98a1b1] lg:mt-1 lg:text-[10px] lg:leading-[14px]">
          Investigation direction, not a confirmed cause.
        </p>
      </div>

      <div className="mt-4 lg:mt-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#98a1b1] lg:text-[10px]">
          Evidence
        </p>
        <ul className="mt-2.5 space-y-2 lg:mt-1 lg:space-y-0.5">
          {investigation.evidenceSummary.map((evidence) => (
            <li
              key={evidence}
              className="flex items-start gap-2 text-[13px] leading-5 text-[#526078] lg:text-xs lg:leading-[17px]"
            >
              <span
                aria-hidden="true"
                className="mt-[7px] size-1.5 shrink-0 rounded-full bg-[#a8b1c1] lg:mt-[6px]"
              />
              {evidence}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-auto flex flex-col gap-4 border-t border-[#eef0f4] pt-4 sm:flex-row sm:items-end sm:justify-between lg:gap-2 lg:pt-2">
        <dl className="flex items-center gap-5 lg:gap-3">
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#a0a8b5] lg:text-[9px]">
              Created
            </dt>
            <dd className="mt-1 text-xs font-medium text-[#68748a] lg:mt-0.5 lg:text-[10px]">
              {formatDate(presentation.createdAt)}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#a0a8b5] lg:text-[9px]">
              Updated
            </dt>
            <dd className="mt-1 text-xs font-medium text-[#68748a] lg:mt-0.5 lg:text-[10px]">
              {formatDate(investigation.updatedAt)}
            </dd>
          </div>
        </dl>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {canDelete ? (
            <button
              type="button"
              disabled={deleting}
              onClick={() => onDelete(investigation)}
              className="inline-flex h-9 cursor-pointer items-center rounded-lg border border-[#e4d7d7] bg-white px-3 text-xs font-semibold text-[#a24b4b] transition-colors hover:border-[#d8bebe] hover:bg-[#fff8f8] disabled:cursor-wait disabled:opacity-60 lg:h-7 lg:px-2.5 lg:text-[10px]"
            >
              {deleting ? "Deleting..." : "Delete investigation"}
            </button>
          ) : null}
          <Link
            href={actionHref}
            className={`inline-flex h-9 w-fit items-center gap-1.5 rounded-lg border px-3.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3559e8]/25 lg:h-7 lg:px-2.5 lg:text-[10px] ${actionStyles[investigation.status]}`}
          >
            {getActionLabel(investigation.status)}
            <ArrowIcon />
          </Link>
        </div>
      </div>
    </article>
  );
}

export function InvestigationsPage({
  investigations: initialInvestigations,
  canDelete = false,
}: {
  investigations: MockInvestigation[];
  canDelete?: boolean;
}) {
  const { runtimeSessionId } = useDatasetWorkspaceSession();
  const [investigations, setInvestigations] = useState(initialInvestigations);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("All");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const filteredInvestigations = useMemo(
    () =>
      investigations
        .filter(
          (investigation) =>
            (sourceFilter === "All" ||
              investigation.source === sourceFilter) &&
            (statusFilter === "All" || investigation.status === statusFilter),
        )
        .sort(
          (left, right) =>
            Date.parse(right.updatedAt) - Date.parse(left.updatedAt),
        ),
    [investigations, sourceFilter, statusFilter],
  );
  const validatedCount = investigations.filter(
    (investigation) => investigation.status === "Validated",
  ).length;

  async function handleDelete(investigation: MockInvestigation) {
    const confirmed = window.confirm(
      "Delete this investigation?\n\nIf a report was generated from this investigation, the linked report will also be deleted.",
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(investigation.id);

    try {
      const response = await fetch("/api/investigations", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          [RUNTIME_SESSION_HEADER]: runtimeSessionId,
        },
        body: JSON.stringify({ investigationCaseId: investigation.id }),
      });

      if (!response.ok) {
        throw new Error("Investigation could not be deleted.");
      }

      setInvestigations((current) =>
        current.filter((item) => item.id !== investigation.id),
      );
    } catch {
      window.alert("Investigation could not be deleted. Please try again.");
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
          <span className="text-[#4e5a70]">Investigations</span>
        </div>
        <h1 className="mt-3 text-[28px] font-semibold tracking-[-0.04em] text-[#172033] lg:mt-1.5 lg:text-[21px] lg:leading-7">
          Investigations
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-5 text-[#6f7a8e] lg:mt-1 lg:text-[13px] lg:leading-[18px]">
          Track AI-driven product investigations and their validation progress.
        </p>
      </header>

      <section className="mt-6 lg:mt-4" aria-label="Investigation statistics">
        <div className="grid gap-3 sm:grid-cols-3">
          <KpiCard
            compactDesktop
            kpi={{
              status: "available",
              label: "Total investigations",
              value: String(investigations.length),
              change: null,
              changeDirection: "neutral",
              comparison: "Across Analytics and Feedback",
            }}
          />
          <KpiCard
            compactDesktop
            kpi={{
              status: "available",
              label: "Validated investigations",
              value: String(validatedCount),
              change: null,
              changeDirection: "positive",
              comparison: "Validation evidence reviewed",
            }}
          />
          <KpiCard
            compactDesktop
            kpi={{
              status: "available",
              label: "In progress",
              value: String(investigations.length - validatedCount),
              change: null,
              changeDirection: "neutral",
              comparison: "Investigation or validation underway",
            }}
          />
        </div>
      </section>

      <section
        className="mt-6 rounded-xl border border-[#e7eaf0] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.02)] sm:p-5 lg:mt-4 lg:p-3"
        aria-label="Investigation filters"
      >
        <div className="grid gap-5 lg:gap-3 xl:grid-cols-[1.2fr_1fr]">
          <FilterGroup
            label="Source"
            options={sourceFilters}
            value={sourceFilter}
            onChange={setSourceFilter}
          />
          <FilterGroup
            label="Status"
            options={statusFilters}
            value={statusFilter}
            onChange={setStatusFilter}
          />
        </div>
      </section>

      <section className="mt-6 lg:mt-4" aria-labelledby="investigation-cases-title">
        <div className="mb-3 flex items-center justify-between gap-3 lg:mb-2.5">
          <h2
            id="investigation-cases-title"
            className="text-sm font-semibold text-[#344056] lg:text-[13px]"
          >
            Investigation cases
          </h2>
          <p className="text-xs text-[#98a1b1] lg:text-[11px]">
            {filteredInvestigations.length} of {investigations.length}
          </p>
        </div>

        {filteredInvestigations.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-2 lg:gap-3 2xl:grid-cols-3">
            {filteredInvestigations.map((investigation) => (
              <InvestigationCard
                key={investigation.id}
                investigation={investigation}
                canDelete={canDelete}
                deleting={deletingId === investigation.id}
                onDelete={handleDelete}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-[#dfe3eb] bg-white px-5 py-12 text-center">
            <p className="text-sm font-semibold text-[#526078]">
              {investigations.length === 0
                ? "No investigations yet"
                : "No investigations match these filters"}
            </p>
            <p className="mt-1 text-xs text-[#98a1b1]">
              {investigations.length === 0
                ? "Start an investigation from a dataset-backed Analytics or Feedback signal."
                : "Choose another source or status to view investigation cases."}
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
