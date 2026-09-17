import { cookies } from "next/headers";

import { InvestigationsPage } from "@/components/investigations/investigations-page";
import { AppShell } from "@/components/layout/app-shell";
import { getDatasetAnalyticsSession } from "@/lib/analytics/dataset-context/session-store";
import {
  DATASET_MODE_COOKIE,
  getDatasetModeRuntimeSessionId,
} from "@/lib/datasets/dataset-mode";
import { listDatasetInvestigations } from "@/lib/investigations/dataset-investigation-store";
import { mockInvestigations } from "@/lib/investigations/mock-investigations";

export default async function InvestigationsRoute() {
  const cookieStore = await cookies();
  const datasetSessionId = getDatasetModeRuntimeSessionId(
    cookieStore.get(DATASET_MODE_COOKIE)?.value,
  );
  const datasetMode = Boolean(datasetSessionId);
  const datasetSession = datasetSessionId
    ? getDatasetAnalyticsSession(datasetSessionId)
    : null;

  const investigations =
    datasetMode
      ? datasetSessionId && datasetSession
        ? listDatasetInvestigations(
            datasetSessionId,
            datasetSession.datasetIdentity,
          )
        : []
      : mockInvestigations;

  return (
    <AppShell activeNavigation="investigations">
      <InvestigationsPage
        investigations={investigations}
        canDelete={datasetMode && Boolean(datasetSession)}
      />
    </AppShell>
  );
}
