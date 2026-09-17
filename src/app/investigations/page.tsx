import { cookies } from "next/headers";

import { InvestigationsPage } from "@/components/investigations/investigations-page";
import { AppShell } from "@/components/layout/app-shell";
import { lookupDatasetSession } from "@/lib/analytics/dataset-context/session-store";
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
  const datasetLookup = datasetSessionId
    ? await lookupDatasetSession(datasetSessionId)
    : null;
  let investigations = datasetMode ? [] : mockInvestigations;

  if (datasetSessionId && datasetLookup?.status === "ready") {
    try {
      investigations = await listDatasetInvestigations(
        datasetSessionId,
        datasetLookup.session.datasetIdentity,
      );
    } catch {
      investigations = [];
    }
  }

  return (
    <AppShell activeNavigation="investigations">
      <InvestigationsPage
        investigations={investigations}
        canDelete={datasetMode && datasetLookup?.status === "ready"}
      />
    </AppShell>
  );
}
