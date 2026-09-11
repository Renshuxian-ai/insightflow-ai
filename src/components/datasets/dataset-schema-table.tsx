import type { DatasetSchema } from "@/lib/datasets/types";

type DatasetSchemaTableProps = {
  schema: DatasetSchema;
};

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatType(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function DatasetSchemaTable({ schema }: DatasetSchemaTableProps) {
  return (
    <details className="overflow-hidden rounded-2xl border border-[#e3e7ee] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
      <summary className="cursor-pointer list-none px-5 py-4 marker:hidden sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-[#172033]">
              Data structure
            </h2>
            <p className="mt-1 text-xs leading-5 text-[#7e8798]">
              Detected field types
            </p>
          </div>
          <span className="shrink-0 text-xs font-medium text-[#7e8798]">
            {schema.fields.length} fields · View structure
          </span>
        </div>
      </summary>

      <div className="max-h-[34rem] overflow-auto border-t border-[#edf0f4]">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10 bg-[#f8f9fb] text-[11px] font-semibold uppercase tracking-[0.08em] text-[#7b8597]">
            <tr>
              <th className="border-b border-[#e7eaf0] px-5 py-3 sm:px-6">Field name</th>
              <th className="border-b border-[#e7eaf0] px-4 py-3">Physical type</th>
              <th className="border-b border-[#e7eaf0] px-4 py-3">Type confidence</th>
              <th className="border-b border-[#e7eaf0] px-4 py-3 text-right">Null rate</th>
              <th className="border-b border-[#e7eaf0] px-5 py-3 text-right sm:px-6">Distinct count</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#edf0f4]">
            {schema.fields.map((field) => (
              <tr key={field.id} className="text-[#4f5b70] hover:bg-[#fafbfc]">
                <td className="px-5 py-3.5 font-medium text-[#263247] sm:px-6">
                  {field.displayName}
                </td>
                <td className="px-4 py-3.5">
                  <span className="rounded-md bg-[#f1f3f7] px-2 py-1 text-xs font-medium text-[#526078]">
                    {formatType(field.detectedType)}
                  </span>
                </td>
                <td className="px-4 py-3.5 tabular-nums">
                  {formatPercent(field.typeConfidence)}
                </td>
                <td className="px-4 py-3.5 text-right tabular-nums">
                  {formatPercent(field.nullRate)}
                </td>
                <td className="px-5 py-3.5 text-right tabular-nums sm:px-6">
                  {field.isDistinctCountExact ? "" : "≥"}
                  {field.distinctCount.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
