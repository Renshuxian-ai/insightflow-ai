import { cookies } from "next/headers";

import { AppShell } from "@/components/layout/app-shell";
import { OverviewPage } from "@/components/overview/overview-page";
import {
  DATASET_ANALYTICS_SESSION_COOKIE,
  getDatasetAnalyticsSession,
} from "@/lib/analytics/dataset-context/session-store";
import { listDatasetInvestigations } from "@/lib/investigations/dataset-investigation-store";

export default async function Home() {
  const cookieStore = await cookies();
  const datasetSessionId = cookieStore.get(
    DATASET_ANALYTICS_SESSION_COOKIE,
  )?.value;
  const datasetSession = getDatasetAnalyticsSession(datasetSessionId);
  const recentInvestigations =
    datasetSessionId && datasetSession
      ? listDatasetInvestigations(
          datasetSessionId,
          datasetSession.datasetIdentity,
        ).slice(0, 3)
      : [];

  return (
    <AppShell>
      <OverviewPage recentInvestigations={recentInvestigations} />
    </AppShell>
  );
}
