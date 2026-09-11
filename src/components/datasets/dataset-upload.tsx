"use client";

import { useRef, useState, type DragEvent, type KeyboardEvent } from "react";

import { DATASET_LIMITS } from "@/lib/datasets/constants";

type DatasetUploadProps = {
  isUploading: boolean;
  fileName?: string;
  error?: string;
  onFileSelected: (file: File) => void;
};

const MAX_FILE_SIZE_MB = Math.floor(
  DATASET_LIMITS.maxFileSizeBytes / (1024 * 1024),
);

export function DatasetUpload({
  isUploading,
  fileName,
  error,
  onFileSelected,
}: DatasetUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  function selectFirstFile(files: FileList | null) {
    const file = files?.item(0);

    if (file) {
      onFileSelected(file);
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);

    if (!isUploading) {
      selectFirstFile(event.dataTransfer.files);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if ((event.key === "Enter" || event.key === " ") && !isUploading) {
      event.preventDefault();
      inputRef.current?.click();
    }
  }

  return (
    <section className="rounded-2xl border border-[#e3e7ee] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.03)] sm:p-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
        <div>
          <p className="text-sm font-semibold text-[#172033]">Upload Dataset</p>
          <p className="mt-1 text-sm text-[#6f798b]">
            Start with one structured file. Parsing and profiling run on the server.
          </p>
        </div>
        <span className="mt-2 w-fit rounded-full bg-[#f1f3f7] px-2.5 py-1 text-[11px] font-semibold text-[#667085] sm:mt-0">
          Session only
        </span>
      </div>

      <div
        role="button"
        tabIndex={isUploading ? -1 : 0}
        aria-disabled={isUploading}
        onClick={() => !isUploading && inputRef.current?.click()}
        onKeyDown={handleKeyDown}
        onDragEnter={(event) => {
          event.preventDefault();
          if (!isUploading) setIsDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          const nextTarget = event.relatedTarget;

          if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
            setIsDragging(false);
          }
        }}
        onDrop={handleDrop}
        className={[
          "mt-5 flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-5 py-8 text-center outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#3559e8]/30",
          isDragging
            ? "border-[#3559e8] bg-[#f5f7ff]"
            : "border-[#cfd5df] bg-[#fafbfc] hover:border-[#9ca9c0] hover:bg-[#f8f9fc]",
          isUploading ? "cursor-wait opacity-75" : "",
        ].join(" ")}
      >
        <input
          ref={inputRef}
          className="sr-only"
          type="file"
          accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          disabled={isUploading}
          onChange={(event) => {
            selectFirstFile(event.target.files);
            event.target.value = "";
          }}
        />
        <div className="grid size-11 place-items-center rounded-xl border border-[#dfe4ec] bg-white text-[#526078] shadow-sm">
          <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14v4.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V14" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p className="mt-4 text-sm font-semibold text-[#263247]">
          {isUploading ? "Processing dataset..." : "Drop a file here or click to browse"}
        </p>
        <p className="mt-1 text-xs text-[#8490a3]">
          CSV / XLSX · Max file size {MAX_FILE_SIZE_MB} MB · Session only
        </p>
        {fileName ? (
          <p className="mt-3 max-w-full truncate rounded-md bg-white px-2.5 py-1 text-xs font-medium text-[#526078]">
            {fileName}
          </p>
        ) : null}
      </div>

      {error ? (
        <div role="alert" className="mt-4 rounded-lg border border-[#f3d6d6] bg-[#fff7f7] px-3.5 py-3 text-sm text-[#a53d3d]">
          {error}
        </div>
      ) : null}
    </section>
  );
}
