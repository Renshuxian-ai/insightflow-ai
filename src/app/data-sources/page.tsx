import { DatasetWorkspace } from "@/components/datasets/dataset-workspace";
import { AppShell } from "@/components/layout/app-shell";

export default function DataSourcesPage() {
  return (
    <AppShell activeNavigation="data-sources">
      <main className="mx-auto w-full max-w-[1280px] px-5 py-7 sm:px-7 lg:px-10 lg:py-9">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#7e8798]">
            Data workspace
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[#172033] sm:text-[28px]">
            Data Sources
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#657084]">
            Upload a dataset, inspect its physical structure, and review the field
            meanings that future analysis will rely on.
          </p>
        </header>

        <div className="mt-7">
          <DatasetWorkspace />
        </div>
      </main>
    </AppShell>
  );
}
