import "server-only";

import { randomUUID } from "node:crypto";

import { createAnalyticsDiagnosticCase } from "@/lib/analytics/analytics-diagnostic-adapter";
import { buildDatasetFeedbackInvestigationContext } from "@/lib/analytics/dataset-feedback-investigation-adapter";
import { buildDatasetFunnelInvestigationContext } from "@/lib/analytics/dataset-funnel-investigation-adapter";
import { buildDatasetRetentionInvestigationContext } from "@/lib/analytics/dataset-retention-investigation-adapter";
import type { AnalyticsInvestigationContext } from "@/lib/analytics/investigation-context";
import type { DiagnosticCase } from "@/lib/diagnostics/types";
import { buildDatasetSignalDiagnosticCaseId } from "@/lib/diagnostics/dataset-diagnostic-case";
import { buildAnalyticsSignalFingerprint } from "@/lib/investigations/signal-fingerprint";

import type {
  DatasetAnalyticsContext,
  DatasetAnalyticsSurface,
} from "./types";

export const DATASET_ANALYTICS_SESSION_COOKIE =
  "insightflow_dataset_analytics_session";

const SESSION_TTL_MS = 30 * 60 * 1_000;
const MAX_SESSION_ENTRIES = 20;

export type DatasetAnalyticsSession = {
  sessionId: string;
  datasetId: string;
  datasetIdentity: string;
  analyticsContext: DatasetAnalyticsContext;
  availableSurfaces: DatasetAnalyticsSurface[];
  availableAnalysis: DatasetAnalyticsSurface[];
  missingEvidence: string[];
  limitations: string[];
  investigationContexts: Partial<
    Record<DatasetAnalyticsSurface, AnalyticsInvestigationContext>
  >;
  diagnosticCases: Partial<Record<DatasetAnalyticsSurface, DiagnosticCase>>;
  createdAt: number;
};

declare global {
  var __insightflowDatasetAnalyticsSessions:
    | Map<string, DatasetAnalyticsSession>
    | undefined;
}

const sessions =
  globalThis.__insightflowDatasetAnalyticsSessions ??
  new Map<string, DatasetAnalyticsSession>();

globalThis.__insightflowDatasetAnalyticsSessions = sessions;

function unique(values: readonly string[]) {
  return [...new Set(values)];
}

function removeExpiredSessions(now: number) {
  for (const [sessionId, session] of sessions) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      sessions.delete(sessionId);
    }
  }

  while (sessions.size >= MAX_SESSION_ENTRIES) {
    const oldestSessionId = sessions.keys().next().value;

    if (typeof oldestSessionId !== "string") {
      break;
    }

    sessions.delete(oldestSessionId);
  }
}

export function registerDatasetAnalyticsSession(
  analyticsContext: DatasetAnalyticsContext,
  options: {
    requestedSessionId?: string;
    datasetIdentity?: string;
  } = {},
): DatasetAnalyticsSession {
  const datasetIdentity = options.datasetIdentity ?? analyticsContext.datasetId;
  const retention = buildDatasetRetentionInvestigationContext(analyticsContext);
  const funnel = buildDatasetFunnelInvestigationContext(analyticsContext);
  const feedback = buildDatasetFeedbackInvestigationContext(analyticsContext);
  const investigationContexts: DatasetAnalyticsSession["investigationContexts"] = {
    ...(retention ? { retention } : {}),
    ...(funnel ? { funnel } : {}),
    ...(feedback ? { feedback } : {}),
  };
  const diagnosticCases: DatasetAnalyticsSession["diagnosticCases"] = {};

  for (const [surface, context] of Object.entries(investigationContexts)) {
    const diagnosticCase = context
      ? createAnalyticsDiagnosticCase(context, {
          diagnosticCaseId: buildDatasetSignalDiagnosticCaseId(
            buildAnalyticsSignalFingerprint(datasetIdentity, context),
          ),
        })
      : null;

    if (diagnosticCase) {
      diagnosticCases[surface as DatasetAnalyticsSurface] = diagnosticCase;
    }
  }

  const availableAnalysis = Object.keys(
    diagnosticCases,
  ) as DatasetAnalyticsSurface[];
  const missingEvidence = [
    ...(analyticsContext.retentionEvidence?.comparison
      ? retention
        ? []
        : ["Retention evidence does not contain a declining primary signal."]
      : ["Retention current/baseline comparison is unavailable."]),
    ...(analyticsContext.funnelEvidence
      ? funnel
        ? []
        : ["Funnel version baseline is unavailable."]
      : ["Funnel transition evidence is unavailable."]),
    ...(analyticsContext.feedbackEvidence
      ? feedback?.topic.change !== null
        ? []
        : ["Feedback topic trend is unavailable."]
      : ["Feedback topic and quote evidence is unavailable."]),
  ];
  const limitations = unique([
    ...Object.values(investigationContexts).flatMap(
      (context) => context?.datasetEvidence?.limitations ?? [],
    ),
    ...(availableAnalysis.length === 0
      ? ["No supported primary signal can be generated from this dataset."]
      : []),
  ]);
  const now = Date.now();
  const sessionId = options.requestedSessionId ?? randomUUID();
  const session: DatasetAnalyticsSession = {
    sessionId,
    datasetId: analyticsContext.datasetId,
    datasetIdentity,
    analyticsContext,
    availableSurfaces: [...analyticsContext.availableSurfaces],
    availableAnalysis,
    missingEvidence,
    limitations,
    investigationContexts,
    diagnosticCases,
    createdAt: now,
  };

  removeExpiredSessions(now);
  sessions.set(sessionId, session);

  return session;
}

export function getDatasetAnalyticsSession(
  sessionId: string | undefined,
): DatasetAnalyticsSession | null {
  if (!sessionId) {
    return null;
  }

  const session = sessions.get(sessionId);

  if (!session || Date.now() - session.createdAt > SESSION_TTL_MS) {
    sessions.delete(sessionId);
    return null;
  }

  return session;
}

export function selectDatasetDiagnosticCase(
  session: DatasetAnalyticsSession,
  requestedCase: DiagnosticCase,
): DiagnosticCase | null {
  const metricId = requestedCase.metric.id;

  if (metricId.includes("retention")) {
    return session.diagnosticCases.retention ?? null;
  }

  if (metricId.includes("funnel") || metricId.includes("conversion")) {
    return session.diagnosticCases.funnel ?? null;
  }

  if (metricId.includes("feedback")) {
    return session.diagnosticCases.feedback ?? null;
  }

  return (
    session.diagnosticCases.retention ??
    session.diagnosticCases.funnel ??
    session.diagnosticCases.feedback ??
    null
  );
}
