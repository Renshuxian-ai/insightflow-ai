import { cookies } from "next/headers";

import {
  getDatasetAnalyticsSession,
} from "@/lib/analytics/dataset-context/session-store";
import {
  InvestigationOutputValidationError,
  parseInvestigationResult,
} from "@/lib/ai/output-schema";
import {
  DatasetDiagnosticCaseValidationError,
  parseDatasetDiagnosticCase,
} from "@/lib/diagnostics/server/dataset-diagnostic-case-schema";
import { buildInvestigationReport } from "@/lib/reports/investigation-report-builder";
import {
  deleteSessionReport,
  REPORT_SESSION_COOKIE,
  saveSessionReport,
} from "@/lib/reports/session-report-store";
import { getRuntimeSessionId } from "@/lib/runtime-session";
import type { ValidationPlan } from "@/lib/validations/types";
import {
  clearDatasetInvestigationReport,
  getDatasetInvestigation,
  updateDatasetInvestigation,
} from "@/lib/investigations/dataset-investigation-store";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isValidationPlan(value: unknown): value is ValidationPlan {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.diagnosticCaseId === "string" &&
    typeof value.investigationResultId === "string" &&
    typeof value.sourceValidationId === "string" &&
    value.persistence === "session-only" &&
    value.status === "draft" &&
    value.executionStatus === "not-run" &&
    isRecord(value.hypothesisSnapshot) &&
    Array.isArray(value.requiredEvidence) &&
    Array.isArray(value.checks)
  );
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
    body.validationStatus !== "completed" ||
    typeof body.investigationCreatedAt !== "string" ||
    typeof body.validationCompletedAt !== "string" ||
    !isValidationPlan(body.validationPlan) ||
    (body.investigationCaseId !== undefined &&
      (typeof body.investigationCaseId !== "string" ||
        body.investigationCaseId.length === 0 ||
        body.investigationCaseId.length > 240))
  ) {
    return Response.json(
      { error: "A completed validation is required to create a report." },
      { status: 400 },
    );
  }

  try {
    const diagnosticCase = parseDatasetDiagnosticCase(body.diagnosticCase);
    const investigationResult = parseInvestigationResult(
      body.investigationResult,
      diagnosticCase,
    );
    const cookieStore = await cookies();
    const datasetSessionId = runtimeSessionId;
    const datasetSession = getDatasetAnalyticsSession(
      datasetSessionId,
    );
    const isUploadedDatasetCase = diagnosticCase.evidence.behaviorSignals.some(
      (signal) => signal.source.startsWith("Uploaded dataset"),
    );
    const persistedInvestigation =
      datasetSession &&
      datasetSessionId &&
      typeof body.investigationCaseId === "string"
        ? getDatasetInvestigation(
            datasetSessionId,
            body.investigationCaseId,
            datasetSession.datasetIdentity,
          )
        : null;

    if (isUploadedDatasetCase && !persistedInvestigation) {
      return Response.json(
        { error: "The Dataset investigation case is no longer available." },
        { status: 409 },
      );
    }

    if (
      persistedInvestigation?.investigationResult &&
      persistedInvestigation.investigationResult.id !== investigationResult.id
    ) {
      return Response.json(
        { error: "The report must be created from the saved investigation draft." },
        { status: 409 },
      );
    }
    const report = buildInvestigationReport({
      diagnosticCase,
      ...(persistedInvestigation
        ? {
            investigationCaseId: persistedInvestigation.id,
            datasetIdentity: datasetSession?.datasetIdentity,
          }
        : {}),
      investigationResult,
      validationPlan: body.validationPlan,
      validationStatus: "completed",
      investigationCreatedAt: body.investigationCreatedAt,
      validationCompletedAt: body.validationCompletedAt,
      ...(datasetSession && isUploadedDatasetCase
        ? { datasetAnalyticsContext: datasetSession.analyticsContext }
        : {}),
    });

    if (!report) {
      return Response.json(
        { error: "Validation is not completed." },
        { status: 409 },
      );
    }

    const reportSessionId = saveSessionReport(
      report,
      runtimeSessionId,
    );

    cookieStore.set(REPORT_SESSION_COOKIE, reportSessionId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 12 * 60 * 60,
    });

    if (
      datasetSession && datasetSessionId && persistedInvestigation
    ) {
      updateDatasetInvestigation({
        sessionId: datasetSessionId,
        investigationId: persistedInvestigation.id,
        datasetIdentity: datasetSession.datasetIdentity,
        status: "Validated",
        reportId: report.id,
      });
    }

    return Response.json({ reportId: report.id });
  } catch (error) {
    if (
      error instanceof DatasetDiagnosticCaseValidationError ||
      error instanceof InvestigationOutputValidationError
    ) {
      return Response.json(
        { error: "Invalid validated investigation payload." },
        { status: 400 },
      );
    }

    return Response.json(
      { error: "Unable to create the session report." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
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
    typeof body.reportId !== "string" ||
    body.reportId.length === 0 ||
    body.reportId.length > 280
  ) {
    return Response.json({ error: "A valid report is required." }, { status: 400 });
  }

  const datasetSession = getDatasetAnalyticsSession(runtimeSessionId);

  if (!datasetSession) {
    return Response.json(
      { error: "The Dataset report session is no longer available." },
      { status: 409 },
    );
  }

  const deleted = deleteSessionReport(
    runtimeSessionId,
    body.reportId,
    datasetSession.datasetIdentity,
  );

  if (!deleted) {
    return Response.json({ error: "Report not found." }, { status: 404 });
  }

  clearDatasetInvestigationReport({
    sessionId: runtimeSessionId,
    datasetIdentity: datasetSession.datasetIdentity,
    reportId: body.reportId,
    ...(deleted.investigationCaseId
      ? { investigationId: deleted.investigationCaseId }
      : {}),
  });

  return Response.json({ deleted: true });
}
