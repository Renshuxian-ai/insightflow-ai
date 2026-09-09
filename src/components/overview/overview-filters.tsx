const filters = ["Last 30 days", "All platforms", "All users"];

export function OverviewFilters() {
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Global filters">
      {filters.map((filter) => (
        <div key={filter} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#e1e5ec] bg-white px-3 text-[13px] font-medium text-[#4e5a70] shadow-[0_1px_2px_rgba(16,24,40,0.02)]">
          {filter}
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-3.5 text-[#8993a4]" aria-hidden="true">
            <path d="m4 6 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      ))}
    </div>
  );
}
