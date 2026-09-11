import type { DatasetCellValue, DatasetPreview as DatasetPreviewData } from "@/lib/datasets/types";

type DatasetPreviewProps = {
  preview: DatasetPreviewData;
};

function PreviewValue({ value }: { value: DatasetCellValue }) {
  if (value === null) {
    return <span className="italic text-[#a0a8b6]">null</span>;
  }

  if (typeof value === "boolean") {
    return (
      <span className="rounded bg-[#eef1f6] px-1.5 py-0.5 font-mono text-xs text-[#526078]">
        {String(value)}
      </span>
    );
  }

  return <span title={String(value)}>{String(value)}</span>;
}

export function DatasetPreview({ preview }: DatasetPreviewProps) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[#e3e7ee] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
      <div className="flex items-start justify-between gap-4 border-b border-[#edf0f4] px-5 py-4 sm:px-6">
        <div>
          <h2 className="text-sm font-semibold text-[#172033]">Preview</h2>
          <p className="mt-1 text-xs text-[#7e8798]">
            A limited preview in the original column order.
          </p>
        </div>
        <span className="shrink-0 text-xs font-medium text-[#7e8798]">
          First {preview.rows.length.toLocaleString()} rows
        </span>
      </div>

      <div className="max-h-[34rem] overflow-auto">
        <table className="w-full min-w-max border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10 bg-[#f8f9fb] text-[11px] font-semibold uppercase tracking-[0.08em] text-[#7b8597]">
            <tr>
              {preview.columns.map((column, columnIndex) => (
                <th key={`${column}-${columnIndex}`} className="min-w-40 border-b border-[#e7eaf0] px-4 py-3 first:pl-6 last:pr-6">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#edf0f4]">
            {preview.rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="text-[#4f5b70] hover:bg-[#fafbfc]">
                {preview.columns.map((column, columnIndex) => (
                  <td key={`${column}-${columnIndex}`} className="max-w-72 px-4 py-3 first:pl-6 last:pr-6">
                    <div className="truncate">
                      <PreviewValue value={row[columnIndex] ?? null} />
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {preview.rows.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-[#7e8798]">
            This dataset contains headers but no data rows.
          </p>
        ) : null}
      </div>
    </section>
  );
}
