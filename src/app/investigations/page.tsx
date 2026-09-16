import { cookies } from "next/headers";

import { InvestigationsPage } from "@/components/investigations/investigations-page";
import { AppShell } from "@/components/layout/app-shell";
import {
  DATASET_ANALYTICS_SESSION_COOKIE,
  getDatasetAnalyticsSession,
} from "@/lib/analytics/dataset-context/session-store";
import {
  listDatasetInvestigations,
  reconcileDatasetInvestigationReports,
} from "@/lib/investigations/dataset-investigation-store";
import { mockInvestigations } from "@/lib/investigations/mock-investigations";
import {
  getSessionReports,
} from "@/lib/reports/session-report-store";

export default async function InvestigationsRoute() {
  const cookieStore = await cookies();
  const datasetSessionId = cookieStore.get(
    DATASET_ANALYTICS_SESSION_COOKIE,
  )?.value;
  const datasetSession = getDatasetAnalyticsSession(datasetSessionId);

  if (datasetSessionId && datasetSession) {
    reconcileDatasetInvestigationReports({
      sessionId: datasetSessionId,
      datasetIdentity: datasetSession.datasetIdentity,
      reports: getSessionReports(
        datasetSessionId,
        datasetSession.datasetIdentity,
      ),
    });
  }

  const investigations =
    datasetSessionId && datasetSession
      ? listDatasetInvestigations(
          datasetSessionId,
          datasetSession.datasetIdentity,
        )
      : mockInvestigations;

  return (
    <AppShell activeNavigation="investigations">
      <InvestigationsPage
        investigations={investigations}
        canDelete={Boolean(datasetSession)}
      />
    </AppShell>
  );
}
