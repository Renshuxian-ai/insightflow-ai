import { AppShell } from "@/components/layout/app-shell";
import { OverviewPage } from "@/components/overview/overview-page";

export default function Home() {
  return (
    <AppShell>
      <OverviewPage />
    </AppShell>
  );
}
