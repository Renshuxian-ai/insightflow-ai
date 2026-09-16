import { FunnelsRuntimeRoute } from "@/components/analytics/analytics-runtime-routes";
import { AppShell } from "@/components/layout/app-shell";

export default function AnalyticsFunnelsRoute() {
  return (
    <AppShell activeNavigation="analytics-funnels">
      <FunnelsRuntimeRoute />
    </AppShell>
  );
}
