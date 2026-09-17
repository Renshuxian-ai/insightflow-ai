import { notFound } from "next/navigation";
import { cookies } from "next/headers";

import { AppShell } from "@/components/layout/app-shell";
import { ReportPage } from "@/components/reports/report-page";
import { lookupDatasetSession } from "@/lib/analytics/dataset-context/session-store";
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
  const datasetLookup = datasetSessionId
    ? await lookupDatasetSession(datasetSessionId)
    : null;
  let sessionReport = null;

  try {
    sessionReport = datasetMode
      ? datasetLookup?.status === "ready" && datasetSessionId
        ? await getSessionReportByRouteId(
            datasetSessionId,
            id,
            datasetLookup.session.datasetIdentity,
          )
        : null
      : await getSessionReportByRouteId(
          cookieStore.get(REPORT_SESSION_COOKIE)?.value,
          id,
        );
  } catch {
    sessionReport = null;
  }
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
