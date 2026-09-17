import { notFound } from "next/navigation";
import { cookies } from "next/headers";

import { AppShell } from "@/components/layout/app-shell";
import { ReportPage } from "@/components/reports/report-page";
import { getDatasetAnalyticsSession } from "@/lib/analytics/dataset-context/session-store";
import {
  DATASET_MODE_COOKIE,
  getDatasetModeRuntimeSessionId,
} from "@/lib/datasets/dataset-mode";
import { getMockReport, mockReports } from "@/lib/reports/mock-reports";
import {
  getSessionReportByRouteId,
  REPORT_SESSION_COOKIE,
} from "@/lib/reports/session-report-store";

type ReportRouteProps = {
  params: Promise<{ id: string }>;
};

export function generateStaticParams() {
  return mockReports.map((report) => ({ id: report.id }));
}

export default async function ReportRoute({ params }: ReportRouteProps) {
  const { id } = await params;
  const cookieStore = await cookies();
  const datasetSessionId = getDatasetModeRuntimeSessionId(
    cookieStore.get(DATASET_MODE_COOKIE)?.value,
  );
  const datasetMode = Boolean(datasetSessionId);
  const datasetSession = datasetSessionId
    ? getDatasetAnalyticsSession(datasetSessionId)
    : null;
  const sessionReport = datasetMode
    ? datasetSession && datasetSessionId
      ? getSessionReportByRouteId(
          datasetSessionId,
          id,
          datasetSession.datasetIdentity,
        )
      : null
    : getSessionReportByRouteId(
        cookieStore.get(REPORT_SESSION_COOKIE)?.value,
        id,
      );
  const report = sessionReport ?? (datasetMode ? null : getMockReport(id));

  if (!report) {
    notFound();
  }

  return (
    <AppShell activeNavigation="reports">
      <ReportPage report={report} />
    </AppShell>
  );
}
