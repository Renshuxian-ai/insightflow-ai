import { notFound } from "next/navigation";
import { cookies } from "next/headers";

import { AppShell } from "@/components/layout/app-shell";
import { ReportPage } from "@/components/reports/report-page";
import {
  DATASET_ANALYTICS_SESSION_COOKIE,
  getDatasetAnalyticsSession,
} from "@/lib/analytics/dataset-context/session-store";
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
  const datasetSessionId = cookieStore.get(
    DATASET_ANALYTICS_SESSION_COOKIE,
  )?.value;
  const datasetSession = getDatasetAnalyticsSession(
    datasetSessionId,
  );
  const sessionReport = getSessionReportByRouteId(
    datasetSession
      ? datasetSessionId
      : cookieStore.get(REPORT_SESSION_COOKIE)?.value,
    id,
    datasetSession?.datasetIdentity,
  );
  const hasDatasetSession = Boolean(datasetSession);
  const report = sessionReport ?? (hasDatasetSession ? null : getMockReport(id));

  if (!report) {
    notFound();
  }

  return (
    <AppShell activeNavigation="reports">
      <ReportPage report={report} />
    </AppShell>
  );
}
