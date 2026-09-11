"use client";

import { useEffect, useRef, useState } from "react";

import { DATASET_LIMITS } from "@/lib/datasets/constants";
import type { Dataset } from "@/lib/datasets/types";

import { DatasetPreview } from "./dataset-preview";
import { DatasetSchemaTable } from "./dataset-schema-table";
import { DatasetUpload } from "./dataset-upload";

type WorkspaceStatus = "idle" | "uploading" | "ready" | "error";

type ApiErrorPayload = {
  error?: {
    message?: string;
  };
};

const SUPPORTED_EXTENSIONS = ["csv", "xlsx"];

function validateClientFile(file: File): string | null {
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (!extension || !SUPPORTED_EXTENSIONS.includes(extension)) {
    return "Choose a CSV or XLSX file.";
  }

  if (file.size <= 0) {
    return "The selected file is empty.";
  }

  if (file.size > DATASET_LIMITS.maxFileSizeBytes) {
    return `Choose a file smaller than ${Math.floor(
      DATASET_LIMITS.maxFileSizeBytes / (1024 * 1024),
    )} MB.`;
  }

  return null;
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as ApiErrorPayload;
    return payload.error?.message ?? "The dataset could not be processed.";
  } catch {
    return "The dataset could not be processed. Please try again.";
  }
}

export function DatasetWorkspace() {
  const [status, setStatus] = useState<WorkspaceStatus>("idle");
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const activeRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => activeRequest.current?.abort();
  }, []);

  async function parseFile(file: File, sheetName?: string) {
    const currentRequestId = requestId.current + 1;
    requestId.current = currentRequestId;
    activeRequest.current?.abort();

    const controller = new AbortController();
    activeRequest.current = controller;
    setStatus("uploading");
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    if (sheetName) {
      formData.append("sheetName", sheetName);
    }

    try {
      const response = await fetch("/api/datasets/parse", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const nextDataset = (await response.json()) as Dataset;

      if (requestId.current !== currentRequestId) {
        return;
      }

      setDataset(nextDataset);
      setStatus("ready");
    } catch (caughtError) {
      if (controller.signal.aborted || requestId.current !== currentRequestId) {
        return;
      }

      setStatus("error");
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "The dataset could not be processed. Please try again.",
      );
    }
  }

  function handleFileSelected(file: File) {
    const validationError = validateClientFile(file);

    if (validationError) {
      setSourceFile(null);
      setDataset(null);
      setStatus("error");
      setError(validationError);
      return;
    }

    setSourceFile(file);
    setDataset(null);
    void parseFile(file);
  }

  function handleSheetChange(sheetName: string) {
    if (!sourceFile || sheetName === dataset?.schema.selectedSheetName) {
      return;
    }

    void parseFile(sourceFile, sheetName);
  }

  const warnings = dataset
    ? Array.from(new Set(dataset.schema.warnings.map((warning) => warning.message)))
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[#7e8798]">
        {[
          "Upload Dataset",
          "Processing",
          "Dataset Summary",
          "Schema",
          "Preview",
        ].map((step, index, steps) => (
          <div key={step} className="flex items-center gap-2">
            <span className={index === 0 || status !== "idle" ? "text-[#526078]" : ""}>
              {step}
            </span>
            {index < steps.length - 1 ? <span aria-hidden="true">→</span> : null}
          </div>
        ))}
      </div>

      <DatasetUpload
        isUploading={status === "uploading"}
        fileName={sourceFile?.name}
        error={error ?? undefined}
        onFileSelected={handleFileSelected}
      />

      {status === "uploading" ? (
        <div aria-live="polite" className="flex items-center gap-3 rounded-xl border border-[#dfe4ec] bg-white px-4 py-3 text-sm text-[#526078]">
          <span className="size-4 animate-spin rounded-full border-2 border-[#d7ddeb] border-t-[#3559e8]" aria-hidden="true" />
          Processing the selected dataset on the server...
        </div>
      ) : null}

      {dataset ? (
        <>
          <section className="rounded-2xl border border-[#e3e7ee] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.03)] sm:p-6">
            <div className="flex flex-col gap-4 border-b border-[#edf0f4] pb-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#7e8798]">
                  Dataset Summary
                </p>
                <h2 className="mt-2 text-lg font-semibold tracking-[-0.02em] text-[#172033]">
                  {dataset.name}
                </h2>
                <p className="mt-1 text-xs text-[#7e8798]">
                  Session only · No persistence
                </p>
              </div>

              {dataset.schema.availableSheetNames.length > 1 ? (
                <label className="w-full text-xs font-medium text-[#657084] sm:w-60">
                  Worksheet
                  <select
                    value={dataset.schema.selectedSheetName ?? ""}
                    disabled={status === "uploading"}
                    onChange={(event) => handleSheetChange(event.target.value)}
                    className="mt-1.5 h-9 w-full rounded-lg border border-[#dfe4ec] bg-white px-3 text-sm text-[#263247] outline-none transition focus:border-[#8298ef] focus:ring-2 focus:ring-[#3559e8]/10 disabled:cursor-wait disabled:bg-[#f7f8fa]"
                  >
                    {dataset.schema.availableSheetNames.map((sheetName) => (
                      <option key={sheetName} value={sheetName}>
                        {sheetName}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>

            <dl className="grid grid-cols-2 gap-4 pt-5 sm:grid-cols-4">
              {[
                ["Dataset name", dataset.name],
                ["Rows", dataset.rowCount.toLocaleString()],
                ["Columns", dataset.columnCount.toLocaleString()],
                ["Format", dataset.format.toUpperCase()],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-[#7e8798]">{label}</dt>
                  <dd className="mt-1 truncate text-sm font-semibold text-[#263247]" title={value}>
                    {value}
                  </dd>
                </div>
              ))}
            </dl>

            {!dataset.schema.profileScope.isComplete ? (
              <p className="mt-5 rounded-lg bg-[#f7f8fa] px-3 py-2 text-xs text-[#657084]">
                Profile based on {dataset.schema.profileScope.profiledRows.toLocaleString()} of{" "}
                {dataset.schema.profileScope.totalRows.toLocaleString()} rows
              </p>
            ) : null}

            {warnings.length > 0 ? (
              <div className="mt-4 text-xs leading-5 text-[#8490a3]">
                {warnings.map((warning) => (
                  <p key={warning}>Note: {warning}</p>
                ))}
              </div>
            ) : null}
          </section>

          <DatasetSchemaTable schema={dataset.schema} />
          <DatasetPreview preview={dataset.preview} />
        </>
      ) : null}
    </div>
  );
}
