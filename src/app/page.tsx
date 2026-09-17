import { cookies } from "next/headers";

import { AppShell } from "@/components/layout/app-shell";
import { OverviewPage } from "@/components/overview/overview-page";
import { getDatasetAnalyticsSession } from "@/lib/analytics/dataset-context/session-store";
import {
  DATASET_MODE_COOKIE,
  getDatasetModeRuntimeSessionId,
} from "@/lib/datasets/dataset-mode";
import { listDatasetInvestigations } from "@/lib/investigations/dataset-investigation-store";

export default async function Home() {
  const cookieStore = await cookies();
  const datasetSessionId = getDatasetModeRuntimeSessionId(
    cookieStore.get(DATASET_MODE_COOKIE)?.value,
  );
  const datasetSession = datasetSessionId
    ? getDatasetAnalyticsSession(datasetSessionId)
    : null;
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
