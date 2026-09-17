import { cookies } from "next/headers";

import { AppShell } from "@/components/layout/app-shell";
import { ReportsPage } from "@/components/reports/reports-page";
import { lookupDatasetSession } from "@/lib/analytics/dataset-context/session-store";
import {
  DATASET_MODE_COOKIE,
  getDatasetModeRuntimeSessionId,
} from "@/lib/datasets/dataset-mode";
import { mockReports } from "@/lib/reports/mock-reports";
import {
  getSessionReports,
  REPORT_SESSION_COOKIE,
} from "@/lib/reports/session-report-store";

export default async function ReportsRoute() {
  const cookieStore = await cookies();
  const datasetSessionId = getDatasetModeRuntimeSessionId(
    cookieStore.get(DATASET_MODE_COOKIE)?.value,
  );
  const datasetMode = Boolean(datasetSessionId);
  const datasetLookup = datasetSessionId
    ? await lookupDatasetSession(datasetSessionId)
    : null;
  let reports = datasetMode ? [] : mockReports;

  try {
    if (datasetMode && datasetSessionId && datasetLookup?.status === "ready") {
      reports = await getSessionReports(
        datasetSessionId,
        datasetLookup.session.datasetIdentity,
      );
    } else if (!datasetMode) {
      const demoSessionReports = await getSessionReports(
        cookieStore.get(REPORT_SESSION_COOKIE)?.value,
      );
      reports = demoSessionReports.length > 0 ? demoSessionReports : mockReports;
    }
  } catch {
    reports = datasetMode ? [] : mockReports;
  }

  return (
    <AppShell activeNavigation="reports">
      <ReportsPage
        reports={reports}
        canDelete={datasetMode && datasetLookup?.status === "ready"}
      />
    </AppShell>
  );
}
