"use client";

import type { ProductReport } from "@/lib/reports/mock-reports";
import { buildProductReportMarkdown } from "@/lib/reports/report-markdown";

function DownloadIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <path d="M12 3v12m0 0 4-4m-4 4-4-4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 20h14" strokeLinecap="round" />
    </svg>
  );
}

export function DownloadReportButton({ report }: { report: ProductReport }) {
  function downloadReport() {
    const blob = new Blob([buildProductReportMarkdown(report)], {
      type: "text/markdown;charset=utf-8",
    });
    const objectUrl = URL.createObjectURL(blob);
    const downloadLink = document.createElement("a");

    downloadLink.href = objectUrl;
    downloadLink.download = `${report.id}.md`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  }

  return (
    <button
      type="button"
      onClick={downloadReport}
      className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg bg-[#3559e8] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#2446cb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3559e8]/30"
    >
      <DownloadIcon />
      Download Report
    </button>
  );
}
