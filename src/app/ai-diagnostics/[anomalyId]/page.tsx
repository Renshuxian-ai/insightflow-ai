import { notFound } from "next/navigation";
import { cookies } from "next/headers";

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
import {
  DATASET_ANALYTICS_SESSION_COOKIE,
  getDatasetAnalyticsSession,
} from "@/lib/analytics/dataset-context/session-store";
import {
  getLatestDatasetInvestigationByFingerprint,
  getDatasetInvestigationByRouteId,
  getDatasetInvestigationByDiagnosticCaseId,
  saveDatasetInvestigationCase,
} from "@/lib/investigations/dataset-investigation-store";
import type { InvestigationSource } from "@/lib/investigations/mock-investigations";
import { buildAnalyticsSignalFingerprint } from "@/lib/investigations/signal-fingerprint";
import { randomUUID } from "node:crypto";
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

function getSourceLabel(
  surface: "activity" | "retention" | "funnel" | "feedback",
): InvestigationSource {
  if (surface === "activity") {
    return "Trends Analytics";
  }
  if (surface === "funnel") {
    return "Funnel Analytics";
  }

  if (surface === "feedback") {
    return "Feedback Intelligence";
  }

  return "Retention Analytics";
}

export default async function AiDiagnosticsRoute({
  params,
  searchParams,
}: AiDiagnosticsPageProps) {
  const [{ anomalyId }, query] = await Promise.all([params, searchParams]);
  const cookieStore = await cookies();
  const datasetSessionId = cookieStore.get(
    DATASET_ANALYTICS_SESSION_COOKIE,
  )?.value;
  const datasetSession = getDatasetAnalyticsSession(datasetSessionId);
  const analyticsContext = parseAnalyticsInvestigationContext(
    query[ANALYTICS_INVESTIGATION_CONTEXT_QUERY_PARAM],
  );
  const returnTarget = getDiagnosticReturnTarget(
    query[DIAGNOSTIC_RETURN_TO_QUERY_PARAM],
  );
  const startNewRun = query.investigationRun === "new";
  const isCurrentDatasetContext = Boolean(
    analyticsContext &&
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

  if (analyticsDiagnosticCase && analyticsContext) {
    const existingInvestigation =
      signalFingerprint && datasetSessionId && datasetSession
        ? getLatestDatasetInvestigationByFingerprint(
            datasetSessionId,
            datasetSession.datasetIdentity,
            signalFingerprint,
          )
        : null;
    const investigationId = signalFingerprint && startNewRun
      ? `${signalFingerprint}:run:${randomUUID().slice(0, 8)}`
      : signalFingerprint;
    const persistedInvestigation =
      isCurrentDatasetContext &&
      datasetSessionId &&
      datasetSession &&
      investigationId &&
      (!existingInvestigation || startNewRun)
        ? saveDatasetInvestigationCase({
            sessionId: datasetSessionId,
            investigationId,
            signalFingerprint: signalFingerprint!,
            datasetId: datasetSession.datasetId,
            datasetIdentity: datasetSession.datasetIdentity,
            sourceLabel: getSourceLabel(analyticsContext.surface),
            signalType: analyticsContext.surface,
            diagnosticCase: analyticsDiagnosticCase,
          })
        : existingInvestigation;
    const existingLifecycle =
      existingInvestigation && !startNewRun
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
            sourceLabel={getSourceLabel(analyticsContext.surface)}
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
    const persistedInvestigation =
      getDatasetInvestigationByRouteId(
        datasetSessionId,
        anomalyId,
        datasetSession.datasetIdentity,
      ) ??
      getDatasetInvestigationByDiagnosticCaseId(
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
