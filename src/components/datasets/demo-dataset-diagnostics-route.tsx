"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { DiagnosticsPage } from "@/components/diagnostics/diagnostics-page";
import { loadDemoDiagnosticDataset } from "@/lib/diagnostics/demo-dataset/demo-dataset-adapter";
import { createDemoDatasetDiagnosticCase } from "@/lib/diagnostics/demo-dataset/evidence-generator";
import type { DiagnosticCase } from "@/lib/diagnostics/types";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; diagnosticCase: DiagnosticCase }
  | { status: "error"; message: string };

let cachedDiagnosticCase: Promise<DiagnosticCase> | null = null;

function loadDiagnosticCase() {
  if (!cachedDiagnosticCase) {
    cachedDiagnosticCase = loadDemoDiagnosticDataset()
      .then(createDemoDatasetDiagnosticCase)
      .catch((error) => {
        cachedDiagnosticCase = null;
        throw error;
      });
  }

  return cachedDiagnosticCase;
}

export function DemoDatasetDiagnosticsRoute() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let isCurrent = true;

    void loadDiagnosticCase()
      .then((diagnosticCase) => {
        if (isCurrent) {
          setState({ status: "ready", diagnosticCase });
        }
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          setState({
            status: "error",
            message:
              error instanceof Error
                ? error.message
                : "The demo diagnostic datasets could not be processed.",
          });
        }
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  if (state.status === "ready") {
    return <DiagnosticsPage diagnosticCase={state.diagnosticCase} />;
  }

  return (
    <main className="mx-auto w-full max-w-[1280px] px-5 py-7 sm:px-7 lg:px-10 lg:py-9">
      <section className="rounded-xl border border-[#e3e7ee] bg-white px-5 py-8 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
        {state.status === "loading" ? (
          <>
            <h1 className="text-lg font-semibold text-[#263247]">
              Preparing dataset diagnostic
            </h1>
            <p className="mt-2 text-sm leading-6 text-[#6f7a8e]">
              Parsing the five demo datasets and generating linked evidence…
            </p>
          </>
        ) : (
          <>
            <h1 className="text-lg font-semibold text-[#263247]">
              Dataset diagnostic unavailable
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6f7a8e]">
              {state.message}
            </p>
            <Link
              href="/"
              className="mt-5 inline-flex text-sm font-semibold text-[#3559e8] hover:text-[#2446cb]"
            >
              Back to Overview
            </Link>
          </>
        )}
      </section>
    </main>
  );
}
