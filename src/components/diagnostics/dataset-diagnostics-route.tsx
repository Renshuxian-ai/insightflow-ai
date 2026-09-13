"use client";

import Link from "next/link";

import { useDatasetWorkspaceSession } from "@/components/datasets/dataset-workspace-session";
import { createDatasetDiagnosticCase } from "@/lib/diagnostics/dataset-diagnostic-case";

import { DiagnosticsPage } from "./diagnostics-page";

export function DatasetDiagnosticsRoute() {
  const { dataset, datasetOverview, overviewStatus } =
    useDatasetWorkspaceSession();
  const diagnosticCase = datasetOverview
    ? createDatasetDiagnosticCase(
        datasetOverview,
        dataset?.file.originalFileName ?? null,
      )
    : null;

  if (overviewStatus === "ready" && diagnosticCase) {
    return <DiagnosticsPage diagnosticCase={diagnosticCase} />;
  }

  return (
    <main className="mx-auto w-full max-w-[1280px] px-5 py-7 sm:px-7 lg:px-10 lg:py-9">
      <section className="rounded-xl border border-[#e3e7ee] bg-white px-5 py-8 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
        <h1 className="text-lg font-semibold text-[#263247]">
          Dataset diagnostic unavailable
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6f7a8e]">
          The current session does not contain a ready dataset anomaly. Return
          to Overview and open the anomaly from the uploaded dataset.
        </p>
        <Link
          href="/"
          className="mt-5 inline-flex text-sm font-semibold text-[#3559e8] hover:text-[#2446cb]"
        >
          Back to Overview
        </Link>
      </section>
    </main>
  );
}
