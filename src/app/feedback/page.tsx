import { FeedbackRuntimeRoute } from "@/components/analytics/analytics-runtime-routes";
import { AppShell } from "@/components/layout/app-shell";

export default function FeedbackRoute() {
  return (
    <AppShell activeNavigation="feedback">
      <FeedbackRuntimeRoute />
    </AppShell>
  );
}
