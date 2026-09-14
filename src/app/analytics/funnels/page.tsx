import { DemoAnalyticsRoute } from "@/components/analytics/demo-analytics-route";
import { AppShell } from "@/components/layout/app-shell";

export default function AnalyticsFunnelsRoute() {
  return (
    <AppShell activeNavigation="analytics-funnels">
      <DemoAnalyticsRoute page="funnels" />
    </AppShell>
  );
}
