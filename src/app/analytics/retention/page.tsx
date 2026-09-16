import { RetentionRuntimeRoute } from "@/components/analytics/analytics-runtime-routes";
import { AppShell } from "@/components/layout/app-shell";

export default function AnalyticsRetentionRoute() {
  return (
    <AppShell activeNavigation="analytics-retention">
      <RetentionRuntimeRoute />
    </AppShell>
  );
}
