import { TrendsRuntimeRoute } from "@/components/analytics/trends-runtime-route";
import { AppShell } from "@/components/layout/app-shell";

export default function AnalyticsTrendsRoute() {
  return (
    <AppShell activeNavigation="analytics-trends">
      <TrendsRuntimeRoute />
    </AppShell>
  );
}
