import { cookies } from "next/headers";

import { AppShell } from "@/components/layout/app-shell";
import { ReportsPage } from "@/components/reports/reports-page";
import {
  DATASET_ANALYTICS_SESSION_COOKIE,
  getDatasetAnalyticsSession,
} from "@/lib/analytics/dataset-context/session-store";
import { mockReports } from "@/lib/reports/mock-reports";
import {
  getSessionReports,
  REPORT_SESSION_COOKIE,
} from "@/lib/reports/session-report-store";

export default async function ReportsRoute() {
  const cookieStore = await cookies();
  const datasetSessionId = cookieStore.get(
    DATASET_ANALYTICS_SESSION_COOKIE,
  )?.value;
  const datasetSession = getDatasetAnalyticsSession(
    datasetSessionId,
  );
  const sessionReports = getSessionReports(
    datasetSession
      ? datasetSessionId
      : cookieStore.get(REPORT_SESSION_COOKIE)?.value,
    datasetSession?.datasetIdentity,
  );
  const hasDatasetSession = Boolean(datasetSession);
  const reports =
    sessionReports.length > 0
      ? sessionReports
      : hasDatasetSession
        ? []
        : mockReports;

  return (
    <AppShell activeNavigation="reports">
      <ReportsPage
        reports={reports}
        canDelete={hasDatasetSession}
      />
    </AppShell>
  );
}
