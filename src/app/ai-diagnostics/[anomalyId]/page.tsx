import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { DemoDatasetDiagnosticsRoute } from "@/components/datasets/demo-dataset-diagnostics-route";
import { DiagnosticsPage } from "@/components/diagnostics/diagnostics-page";
import { AppShell } from "@/components/layout/app-shell";
import { parseAnalyticsInvestigationContext } from "@/lib/analytics/analytics-context-parser";
import { createAnalyticsDiagnosticCase } from "@/lib/analytics/analytics-diagnostic-adapter";
import {
  ANALYTICS_INVESTIGATION_CONTEXT_QUERY_PARAM,
  buildAnalyticsInvestigationHref,
} from "@/lib/analytics/investigation-context";
import {
  buildDatasetSignalDiagnosticCaseId,
  DATASET_PRIMARY_ANOMALY_ID,
} from "@/lib/diagnostics/dataset-diagnostic-case";
import {
  DIAGNOSTIC_RETURN_TO_QUERY_PARAM,
  getDiagnosticReturnTarget,
  withDiagnosticReturnTo,
} from "@/lib/diagnostics/diagnostic-navigation";
import { getDatasetAnalyticsSession } from "@/lib/analytics/dataset-context/session-store";
import {
  DATASET_MODE_COOKIE,
  getDatasetModeRuntimeSessionId,
} from "@/lib/datasets/dataset-mode";
import {
  getDatasetInvestigationByRouteId,
} from "@/lib/investigations/dataset-investigation-store";
import { buildAnalyticsSignalFingerprint } from "@/lib/investigations/signal-fingerprint";
import { getInvestigationSourceLabel } from "@/lib/investigations/source-label";
import {
  diagnosticCases,
  getDiagnosticCase,
  primaryDiagnosticCase,
} from "@/lib/diagnostics-mock-data";

type AiDiagnosticsPageProps = {
  params: Promise<{ anomalyId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export function generateStaticParams() {
  return Object.keys(diagnosticCases).map((anomalyId) => ({ anomalyId }));
}

function DatasetInvestigationUnavailable() {
  return (
    <main className="mx-auto w-full max-w-[1280px] px-5 py-7 sm:px-7 lg:px-10 lg:py-9">
      <section className="rounded-xl border border-[#e3e7ee] bg-white px-6 py-10 text-center shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
        <h1 className="text-lg font-semibold text-[#263247]">
          Dataset investigation unavailable
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#6f7a8e]">
          The confirmed Dataset session or investigation could not be recovered.
          Dataset Mode remains active and no Demo diagnostic will be shown.
        </p>
      </section>
    </main>
  );
}

export default async function AiDiagnosticsRoute({
  params,
  searchParams,
}: AiDiagnosticsPageProps) {
  const [{ anomalyId }, query] = await Promise.all([params, searchParams]);
  const cookieStore = await cookies();
  const datasetSessionId = getDatasetModeRuntimeSessionId(
    cookieStore.get(DATASET_MODE_COOKIE)?.value,
  );
  const datasetMode = Boolean(datasetSessionId);
  const datasetSession = datasetSessionId
    ? getDatasetAnalyticsSession(datasetSessionId)
    : null;
  const analyticsContext = parseAnalyticsInvestigationContext(
    query[ANALYTICS_INVESTIGATION_CONTEXT_QUERY_PARAM],
  );
  const returnTarget = getDiagnosticReturnTarget(
    query[DIAGNOSTIC_RETURN_TO_QUERY_PARAM],
  );
  const isUploadedDatasetContext =
    analyticsContext?.datasetEvidence?.source === "uploaded-dataset";

  if (datasetMode && !datasetSession) {
    return (
      <AppShell activeNavigation="ai-diagnostics">
        <DatasetInvestigationUnavailable />
      </AppShell>
    );
  }

  const isCurrentDatasetContext = Boolean(
    analyticsContext &&
      datasetMode &&
      datasetSessionId &&
      datasetSession &&
      analyticsContext.datasetEvidence?.source === "uploaded-dataset" &&
      analyticsContext.datasetEvidence.datasetId === datasetSession.datasetId,
  );
  const signalFingerprint =
    analyticsContext && isCurrentDatasetContext && datasetSession
      ? buildAnalyticsSignalFingerprint(
          datasetSession.datasetIdentity,
          analyticsContext,
        )
      : null;
  const analyticsDiagnosticCase = analyticsContext
    ? createAnalyticsDiagnosticCase(
        analyticsContext,
        signalFingerprint
          ? {
              diagnosticCaseId:
                buildDatasetSignalDiagnosticCaseId(signalFingerprint),
            }
          : {},
      )
    : null;

  if (datasetMode && analyticsContext && !isCurrentDatasetContext) {
    notFound();
  }

  if (analyticsDiagnosticCase && analyticsContext) {
    if (isUploadedDatasetContext && !isCurrentDatasetContext) {
      notFound();
    }

    const existingInvestigation =
      datasetMode && datasetSessionId && datasetSession
        ? getDatasetInvestigationByRouteId(
            datasetSessionId,
            anomalyId,
            datasetSession.datasetIdentity,
          )
        : null;
    const persistedInvestigation = existingInvestigation;

    if (datasetMode && !persistedInvestigation) {
      return (
        <AppShell activeNavigation="ai-diagnostics">
          <DatasetInvestigationUnavailable />
        </AppShell>
      );
    }

    const existingLifecycle =
      existingInvestigation
        ? {
            status: existingInvestigation.status,
            createdAt: existingInvestigation.createdAt,
            investigationHref: withDiagnosticReturnTo(
              `/ai-diagnostics/${encodeURIComponent(existingInvestigation.id)}`,
              returnTarget.href,
            ),
            ...(existingInvestigation.reportId
              ? {
                  reportHref: `/reports/${encodeURIComponent(existingInvestigation.reportId)}`,
                }
              : {}),
            newRunHref: `${buildAnalyticsInvestigationHref(
              `/ai-diagnostics/${DATASET_PRIMARY_ANOMALY_ID}`,
              analyticsContext,
              { returnTo: returnTarget.href },
            )}&investigationRun=new`,
          }
        : null;

    return (
      <AppShell activeNavigation="ai-diagnostics">
          <DiagnosticsPage
            diagnosticCase={persistedInvestigation?.diagnosticCase ?? analyticsDiagnosticCase}
            sourceLabel={getInvestigationSourceLabel(analyticsContext.surface)}
            investigationCaseId={persistedInvestigation?.id}
            existingInvestigation={existingLifecycle}
            initialInvestigation={
              persistedInvestigation?.investigationResult &&
              persistedInvestigation.investigationTrace &&
              persistedInvestigation.investigationCreatedAt
                ? {
                    result: persistedInvestigation.investigationResult,
                    trace: persistedInvestigation.investigationTrace,
                    createdAt: persistedInvestigation.investigationCreatedAt,
                  }
                : null
            }
            returnTarget={returnTarget}
          />
      </AppShell>
    );
  }

  if (datasetSessionId && datasetSession) {
    const persistedInvestigation = getDatasetInvestigationByRouteId(
      datasetSessionId,
      anomalyId,
      datasetSession.datasetIdentity,
    );

    if (persistedInvestigation) {
      return (
        <AppShell activeNavigation="ai-diagnostics">
          <DiagnosticsPage
            diagnosticCase={persistedInvestigation.diagnosticCase}
            sourceLabel={persistedInvestigation.sourceLabel}
            investigationCaseId={persistedInvestigation.id}
            initialInvestigation={
              persistedInvestigation.investigationResult &&
              persistedInvestigation.investigationTrace &&
              persistedInvestigation.investigationCreatedAt
                ? {
                    result: persistedInvestigation.investigationResult,
                    trace: persistedInvestigation.investigationTrace,
                    createdAt: persistedInvestigation.investigationCreatedAt,
                  }
                : null
            }
            returnTarget={returnTarget}
          />
        </AppShell>
      );
    }

    // Dataset Mode never falls through to Demo DiagnosticCases. A concrete
    // route must resolve to this Dataset's persisted investigation or case.
    notFound();
  }

  if (anomalyId === DATASET_PRIMARY_ANOMALY_ID) {
    notFound();
  }

  if (anomalyId === primaryDiagnosticCase.id) {
    return (
      <AppShell activeNavigation="ai-diagnostics">
        <DemoDatasetDiagnosticsRoute returnTarget={returnTarget} />
      </AppShell>
    );
  }

  const diagnosticCase = getDiagnosticCase(anomalyId);

  if (!diagnosticCase) {
    notFound();
  }

  return (
    <AppShell activeNavigation="ai-diagnostics">
      <DiagnosticsPage
        diagnosticCase={diagnosticCase}
        returnTarget={returnTarget}
      />
    </AppShell>
  );
}
