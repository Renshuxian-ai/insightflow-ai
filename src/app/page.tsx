import { cookies } from "next/headers";

import { AppShell } from "@/components/layout/app-shell";
import { OverviewPage } from "@/components/overview/overview-page";
import { lookupDatasetSession } from "@/lib/analytics/dataset-context/session-store";
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
  const datasetLookup = datasetSessionId
    ? await lookupDatasetSession(datasetSessionId)
    : null;
  let recentInvestigations: Awaited<
    ReturnType<typeof listDatasetInvestigations>
  > = [];

  if (datasetSessionId && datasetLookup?.status === "ready") {
    try {
      recentInvestigations = (
        await listDatasetInvestigations(
          datasetSessionId,
          datasetLookup.session.datasetIdentity,
        )
      ).slice(0, 3);
    } catch {
      recentInvestigations = [];
    }
  }

  return (
    <AppShell>
      <OverviewPage recentInvestigations={recentInvestigations} />
    </AppShell>
  );
}
