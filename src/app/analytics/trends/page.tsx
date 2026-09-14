import { DemoAnalyticsRoute } from "@/components/analytics/demo-analytics-route";
import { AppShell } from "@/components/layout/app-shell";

export default function AnalyticsTrendsRoute() {
  return (
    <AppShell activeNavigation="analytics-trends">
      <DemoAnalyticsRoute page="trends" />
    </AppShell>
  );
}
