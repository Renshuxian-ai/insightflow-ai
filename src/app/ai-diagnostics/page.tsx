import Link from "next/link";
import { cookies } from "next/headers";

import { DemoDatasetDiagnosticsRoute } from "@/components/datasets/demo-dataset-diagnostics-route";
import { AppShell } from "@/components/layout/app-shell";
import { lookupDatasetSession } from "@/lib/analytics/dataset-context/session-store";
import {
  DATASET_MODE_COOKIE,
  getDatasetModeRuntimeSessionId,
} from "@/lib/datasets/dataset-mode";

const overviewReturnTarget = {
  href: "/" as const,
  label: "Overview" as const,
};

function DatasetDiagnosticsEmptyState({
  unavailable = false,
}: {
  unavailable?: boolean;
}) {
  return (
    <main className="mx-auto w-full max-w-[1280px] px-5 py-7 sm:px-7 lg:px-10 lg:py-9">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8a94a6]">
          Product investigation
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-[#172033]">
          AI Diagnostics
        </h1>
      </header>

      <section className="mt-6 rounded-xl border border-[#e3e7ee] bg-white px-6 py-10 text-center shadow-[0_1px_2px_rgba(16,24,40,0.03)] sm:px-10">
        <div className="mx-auto grid size-11 place-items-center rounded-xl bg-[#f0f3ff] text-[#3559e8]">
          <svg
            aria-hidden="true"
            className="size-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            viewBox="0 0 24 24"
          >
            <path
              d="m12 3 1.5 5.1L18.5 10l-5 1.9L12 17l-1.5-5.1-5-1.9 5-1.9L12 3Z"
              strokeLinejoin="round"
            />
            <path
              d="m19 16 .6 2.1L22 19l-2.4.9L19 22l-.6-2.1L16 19l2.4-.9L19 16Z"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h2 className="mt-4 text-lg font-semibold text-[#263247]">
          {unavailable ? "Dataset diagnostics unavailable" : "No diagnostics yet"}
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#6f7a8e]">
          {unavailable
            ? "The confirmed Dataset session could not be recovered. Dataset Mode remains active and no Demo diagnostics will be shown."
            : "Start an investigation from an Analytics or Feedback signal to review evidence and investigate possible causes."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/analytics/trends"
            className="inline-flex h-9 items-center rounded-lg bg-[#3559e8] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#294bd1]"
          >
            View Trends
          </Link>
          <Link
            href="/investigations"
            className="inline-flex h-9 items-center rounded-lg border border-[#d8dde7] bg-white px-4 text-sm font-semibold text-[#465268] transition-colors hover:border-[#c4cad6] hover:bg-[#f8f9fb]"
          >
            View Investigations
          </Link>
        </div>
      </section>
    </main>
  );
}

export default async function AiDiagnosticsRootRoute() {
  const cookieStore = await cookies();
  const datasetSessionId = getDatasetModeRuntimeSessionId(
    cookieStore.get(DATASET_MODE_COOKIE)?.value,
  );
  const datasetMode = Boolean(datasetSessionId);
  const datasetLookup = datasetSessionId
    ? await lookupDatasetSession(datasetSessionId)
    : null;

  return (
    <AppShell activeNavigation="ai-diagnostics">
      {datasetMode ? (
        <DatasetDiagnosticsEmptyState
          unavailable={datasetLookup?.status !== "ready"}
        />
      ) : (
        <DemoDatasetDiagnosticsRoute returnTarget={overviewReturnTarget} />
      )}
    </AppShell>
  );
}
