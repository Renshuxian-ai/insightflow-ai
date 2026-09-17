import { randomUUID } from "node:crypto";

import { cookies } from "next/headers";

import { parseAnalyticsInvestigationContext } from "@/lib/analytics/analytics-context-parser";
import { createAnalyticsDiagnosticCase } from "@/lib/analytics/analytics-diagnostic-adapter";
import { ANALYTICS_INVESTIGATION_CONTEXT_QUERY_PARAM } from "@/lib/analytics/investigation-context";
import { getDatasetAnalyticsSession } from "@/lib/analytics/dataset-context/session-store";
import {
  buildDatasetSignalDiagnosticCaseId,
} from "@/lib/diagnostics/dataset-diagnostic-case";
import {
  DIAGNOSTIC_RETURN_TO_QUERY_PARAM,
  getDiagnosticReturnTarget,
  withDiagnosticReturnTo,
} from "@/lib/diagnostics/diagnostic-navigation";
import {
  DATASET_MODE_COOKIE,
  getDatasetModeRuntimeSessionId,
} from "@/lib/datasets/dataset-mode";
import {
  getLatestDatasetInvestigationByFingerprint,
  saveDatasetInvestigationCase,
} from "@/lib/investigations/dataset-investigation-store";
import { buildAnalyticsSignalFingerprint } from "@/lib/investigations/signal-fingerprint";
import { getInvestigationSourceLabel } from "@/lib/investigations/source-label";
import { getRuntimeSessionId } from "@/lib/runtime-session";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export async function POST(request: Request) {
  const runtimeSessionId = getRuntimeSessionId(request);

  if (!runtimeSessionId) {
    return Response.json(
      { error: "A valid runtime session is required." },
      { status: 400 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  if (
    !isRecord(body) ||
    typeof body.href !== "string" ||
    body.href.length === 0 ||
    body.href.length > 24_000
  ) {
    return Response.json(
      { error: "A valid investigation destination is required." },
      { status: 400 },
    );
  }

  const cookieStore = await cookies();
  const datasetSessionId = getDatasetModeRuntimeSessionId(
    cookieStore.get(DATASET_MODE_COOKIE)?.value,
  );

  if (datasetSessionId !== runtimeSessionId) {
    return Response.json(
      { error: "A confirmed Dataset session is required." },
      { status: 409 },
    );
  }

  const datasetSession = getDatasetAnalyticsSession(datasetSessionId);

  if (!datasetSession) {
    return Response.json(
      { error: "The Dataset session is temporarily unavailable." },
      { status: 409 },
    );
  }

  const destination = new URL(body.href, "http://insightflow.local");

  if (
    destination.origin !== "http://insightflow.local" ||
    !destination.pathname.startsWith("/ai-diagnostics/") ||
    destination.pathname.slice("/ai-diagnostics/".length).includes("/")
  ) {
    return Response.json(
      { error: "The investigation destination is not allowed." },
      { status: 400 },
    );
  }

  const analyticsContext = parseAnalyticsInvestigationContext(
    destination.searchParams.get(ANALYTICS_INVESTIGATION_CONTEXT_QUERY_PARAM) ??
      undefined,
  );

  if (
    !analyticsContext ||
    analyticsContext.datasetEvidence?.source !== "uploaded-dataset" ||
    analyticsContext.datasetEvidence.datasetId !== datasetSession.datasetId
  ) {
    return Response.json(
      { error: "The Dataset signal is no longer available." },
      { status: 409 },
    );
  }

  const signalFingerprint = buildAnalyticsSignalFingerprint(
    datasetSession.datasetIdentity,
    analyticsContext,
  );
  const diagnosticCase = createAnalyticsDiagnosticCase(analyticsContext, {
    diagnosticCaseId: buildDatasetSignalDiagnosticCaseId(signalFingerprint),
  });

  if (!diagnosticCase) {
    return Response.json(
      { error: "The Dataset signal cannot start an investigation." },
      { status: 409 },
    );
  }

  const startNewRun = destination.searchParams.get("investigationRun") === "new";
  const existingInvestigation = startNewRun
    ? null
    : getLatestDatasetInvestigationByFingerprint(
        datasetSessionId,
        datasetSession.datasetIdentity,
        signalFingerprint,
      );
  const investigationId = startNewRun
    ? `${signalFingerprint}:run:${randomUUID().slice(0, 8)}`
    : signalFingerprint;
  const investigation =
    existingInvestigation ??
    saveDatasetInvestigationCase({
      sessionId: datasetSessionId,
      investigationId,
      signalFingerprint,
      datasetId: datasetSession.datasetId,
      datasetIdentity: datasetSession.datasetIdentity,
      sourceLabel: getInvestigationSourceLabel(analyticsContext.surface),
      signalType: analyticsContext.surface,
      diagnosticCase,
    });
  const returnTarget = getDiagnosticReturnTarget(
    destination.searchParams.get(DIAGNOSTIC_RETURN_TO_QUERY_PARAM) ?? undefined,
  );

  return Response.json({
    investigationId: investigation.id,
    investigationHref: withDiagnosticReturnTo(
      `/ai-diagnostics/${encodeURIComponent(investigation.id)}`,
      returnTarget.href,
    ),
    created: !existingInvestigation,
  });
}
