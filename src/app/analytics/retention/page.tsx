import { DemoAnalyticsRoute } from "@/components/analytics/demo-analytics-route";
import { AppShell } from "@/components/layout/app-shell";

export default function AnalyticsRetentionRoute() {
  return (
    <AppShell activeNavigation="analytics-retention">
      <DemoAnalyticsRoute page="retention" />
    </AppShell>
  );
}
