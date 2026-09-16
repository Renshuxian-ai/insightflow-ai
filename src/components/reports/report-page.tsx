import Link from "next/link";

import type { ProductReport } from "@/lib/reports/mock-reports";

import { DownloadReportButton } from "./download-report-button";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function BackIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <path d="m15 5-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4 transition-transform group-open:rotate-180"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const nextStepDescriptions: Record<string, string> = {
  "Review onboarding Step2 completion flow":
    "Validate whether onboarding Step2 is contributing to the observed retention gap.",
  "Analyze Android user experience differences":
    "Compare Android user behavior to identify possible experience differences.",
  "Collect additional onboarding feedback":
    "Gather additional user evidence before drawing conclusions.",
};

export function ReportPage({ report }: { report: ProductReport }) {
  return (
    <main className="mx-auto w-full max-w-[1180px] px-5 py-7 sm:px-7 lg:px-10 lg:py-9">
      <header className="border-b border-[#e6e9ef] pb-6">
        <Link
          href="/reports"
          className="inline-flex items-center gap-1 text-xs font-medium text-[#7e8798] transition-colors hover:text-[#3559e8]"
        >
          <BackIcon />
          Reports
        </Link>

        <div className="mt-4 flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-[28px] font-semibold tracking-[-0.04em] text-[#172033]">
                {report.title}
              </h1>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-[#cdebdc] bg-[#e9f8f0] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.06em] text-[#168251]">
                <span className="size-1.5 rounded-full bg-[#35a772]" />
                {report.status}
              </span>
            </div>
            <p className="mt-1.5 text-sm text-[#6f7a8e]">
              A concise product report from validated investigation evidence.
            </p>
          </div>

          <dl className="grid grid-cols-3 gap-x-6 gap-y-3 rounded-lg border border-[#e7eaf0] bg-white px-4 py-3">
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#a0a8b5]">
                Source
              </dt>
              <dd className="mt-1 text-xs font-semibold text-[#526078]">
                {report.source}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#a0a8b5]">
                Created
              </dt>
              <dd className="mt-1 text-xs font-semibold text-[#526078]">
                {formatDate(report.createdAt)}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#a0a8b5]">
                Updated
              </dt>
              <dd className="mt-1 text-xs font-semibold text-[#526078]">
                {formatDate(report.updatedAt)}
              </dd>
            </div>
          </dl>
        </div>
      </header>

      <section
        className="mt-6 overflow-hidden rounded-xl border border-[#dce3fb] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.02)]"
        aria-labelledby="report-ai-summary-title"
      >
        <div className="border-l-4 border-[#6c84e8] p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <h2
              id="report-ai-summary-title"
              className="text-sm font-semibold text-[#344056]"
            >
              AI Summary
            </h2>
            <span className="rounded-md bg-[#edf1ff] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-[#5269c9]">
              AI generated
            </span>
          </div>
          <p className="mt-3 max-w-4xl text-base leading-7 text-[#3e4b62]">
            {report.aiSummary}
          </p>
          <p className="mt-3 text-xs leading-5 text-[#8a94a6]">
            AI-generated summary based on validated investigation evidence. It is not a causal conclusion.
          </p>
        </div>
      </section>

      <section
        className="mt-6 rounded-xl border border-[#e7eaf0] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.02)] sm:p-6"
        aria-labelledby="report-key-findings-title"
      >
        <h2
          id="report-key-findings-title"
          className="text-sm font-semibold text-[#344056]"
        >
          Key Findings
        </h2>
        <ul className="mt-4 divide-y divide-[#eef0f4]">
          {report.keyFindings.map((finding) => (
            <li
              key={finding}
              className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
            >
              <span
                aria-hidden="true"
                className="mt-[7px] size-1.5 shrink-0 rounded-full bg-[#5270e8]"
              />
              <p className="text-sm leading-6 text-[#526078]">{finding}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6" aria-labelledby="report-next-steps-title">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2
              id="report-next-steps-title"
              className="text-sm font-semibold text-[#344056]"
            >
              Next Steps
            </h2>
            <p className="mt-1 text-xs text-[#98a1b1]">
              Suggested follow-up actions based on validated evidence, not confirmed solutions.
            </p>
          </div>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {report.recommendedActions.map((action) => (
            <article
              key={action.priority}
              className="rounded-xl border border-[#e7eaf0] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.02)]"
            >
              <span className="inline-flex rounded-md bg-[#f1f3f6] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.07em] text-[#687387]">
                Priority {action.priority}
              </span>
              <h3 className="mt-3 text-sm font-semibold leading-5 text-[#344056]">
                {action.title}
              </h3>
              <p className="mt-2 text-xs leading-5 text-[#7e8798]">
                {nextStepDescriptions[action.title] ?? action.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-6" aria-label="Supporting Evidence">
        <details className="group overflow-hidden rounded-xl border border-[#e7eaf0] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.02)]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-semibold text-[#344056] marker:content-none sm:px-6">
            <span>
              Supporting Evidence
              <span className="ml-2 text-xs font-normal text-[#98a1b1]">
                {report.supportingEvidence.length} evidence sources
              </span>
            </span>
            <ChevronIcon />
          </summary>
          <div className="grid gap-3 border-t border-[#eef0f4] p-5 sm:p-6 lg:grid-cols-3">
            {report.supportingEvidence.map((evidence) => (
              <article
                key={evidence.id}
                className="rounded-lg border border-[#e9ecf1] bg-[#fafbfc] p-4"
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#7e8798]">
                  {evidence.type}
                </p>
                <p className="mt-2 text-[13px] leading-5 text-[#526078]">
                  {evidence.statement}
                </p>
              </article>
            ))}
          </div>
        </details>
      </section>

      <section className="mt-6 flex flex-col justify-between gap-4 rounded-xl border border-[#e7eaf0] bg-white p-5 sm:flex-row sm:items-center sm:p-6">
        <div>
          <h2 className="text-sm font-semibold text-[#344056]">
            Download Report
          </h2>
          <p className="mt-1 text-xs text-[#98a1b1]">
            Export this concise report as a Markdown file.
          </p>
        </div>
        <DownloadReportButton report={report} />
      </section>
    </main>
  );
}
