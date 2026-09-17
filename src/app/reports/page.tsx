import { cookies } from "next/headers";

import { AppShell } from "@/components/layout/app-shell";
import { ReportsPage } from "@/components/reports/reports-page";
import { getDatasetAnalyticsSession } from "@/lib/analytics/dataset-context/session-store";
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
  const datasetSession = datasetSessionId
    ? getDatasetAnalyticsSession(datasetSessionId)
    : null;
  const demoSessionReports = datasetMode
    ? []
    : getSessionReports(cookieStore.get(REPORT_SESSION_COOKIE)?.value);
  const reports = datasetMode
    ? datasetSession && datasetSessionId
      ? getSessionReports(datasetSessionId, datasetSession.datasetIdentity)
      : []
    : demoSessionReports.length > 0
      ? demoSessionReports
      : mockReports;

  return (
    <AppShell activeNavigation="reports">
      <ReportsPage
        reports={reports}
        canDelete={datasetMode && Boolean(datasetSession)}
      />
    </AppShell>
  );
}
