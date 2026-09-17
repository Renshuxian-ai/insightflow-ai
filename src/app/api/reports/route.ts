import { cookies } from "next/headers";

import { lookupDatasetSession } from "@/lib/analytics/dataset-context/session-store";
import {
  DATASET_MODE_COOKIE,
  getDatasetModeRuntimeSessionId,
} from "@/lib/datasets/dataset-mode";
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
  saveDatasetReportAndValidateInvestigation,
  saveSessionReport,
} from "@/lib/reports/session-report-store";
import { getRuntimeSessionId } from "@/lib/runtime-session";
import type { ValidationPlan } from "@/lib/validations/types";
import { getDatasetInvestigation } from "@/lib/investigations/dataset-investigation-store";
import { DEMO_REPORT_TTL_SECONDS } from "@/lib/redis/lifecycle";

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
    const datasetSessionId = getDatasetModeRuntimeSessionId(
      cookieStore.get(DATASET_MODE_COOKIE)?.value,
    );
    const datasetMode = Boolean(datasetSessionId);
    const isUploadedDatasetCase = diagnosticCase.evidence.behaviorSignals.some(
      (signal) => signal.source.startsWith("Uploaded dataset"),
    );
    const datasetLookup = datasetSessionId === runtimeSessionId
      ? await lookupDatasetSession(datasetSessionId)
      : null;
    const datasetSession =
      datasetLookup?.status === "ready"
        ? datasetLookup.session.analyticsSession
        : null;

    if (datasetMode && datasetLookup?.status !== "ready") {
      return Response.json(
        {
          error:
            datasetLookup?.status !== "expired"
              ? "The Dataset session is temporarily unavailable."
              : "The Dataset session has expired.",
        },
        {
          status:
            datasetLookup?.status === "expired" ? 409 : 503,
        },
      );
    }

    if (datasetMode !== isUploadedDatasetCase) {
      return Response.json(
        { error: "The report source does not match the active workspace mode." },
        { status: 409 },
      );
    }
    let persistedInvestigation;

    try {
      persistedInvestigation =
        datasetSession &&
        datasetSessionId &&
        typeof body.investigationCaseId === "string"
          ? await getDatasetInvestigation(
              datasetSessionId,
              body.investigationCaseId,
              datasetSession.datasetIdentity,
            )
          : null;
    } catch {
      return Response.json(
        { error: "The Dataset report store is temporarily unavailable." },
        { status: 503 },
      );
    }

    if (
      isUploadedDatasetCase &&
      (!persistedInvestigation ||
        (persistedInvestigation.status !== "Validation ready" &&
          !(
            persistedInvestigation.status === "Validated" &&
            Boolean(persistedInvestigation.reportId)
          )) ||
        !persistedInvestigation.investigationResult)
    ) {
      return Response.json(
        {
          error:
            "The Dataset investigation must finish investigation generation before validation can create a report.",
        },
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

    if (datasetSession && datasetSessionId && persistedInvestigation) {
      let saved;

      try {
        saved = await saveDatasetReportAndValidateInvestigation({
          sessionId: datasetSessionId,
          investigationId: persistedInvestigation.id,
          datasetIdentity: datasetSession.datasetIdentity,
          report,
        });
      } catch {
        return Response.json(
          { error: "The Dataset report store is temporarily unavailable." },
          { status: 503 },
        );
      }

      if (saved.status === "temporarily-unavailable") {
        return Response.json(
          { error: "The Dataset report store is temporarily unavailable." },
          { status: 503 },
        );
      }

      if (saved.status !== "ok") {
        return Response.json(
          { error: "The Dataset investigation is no longer ready for validation." },
          { status: 409 },
        );
      }
    } else {
      const reportSessionId = await saveSessionReport(report, runtimeSessionId);

      cookieStore.set(REPORT_SESSION_COOKIE, reportSessionId, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: DEMO_REPORT_TTL_SECONDS,
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

  const cookieStore = await cookies();
  const datasetModeSessionId = getDatasetModeRuntimeSessionId(
    cookieStore.get(DATASET_MODE_COOKIE)?.value,
  );

  if (datasetModeSessionId !== runtimeSessionId) {
    return Response.json(
      { error: "A confirmed Dataset session is required." },
      { status: 409 },
    );
  }

  const datasetLookup = await lookupDatasetSession(runtimeSessionId);
  const datasetSession =
    datasetLookup.status === "ready"
      ? datasetLookup.session.analyticsSession
      : null;

  if (!datasetSession) {
    return Response.json(
      {
        error:
          datasetLookup.status !== "expired"
            ? "The Dataset report store is temporarily unavailable."
            : "The Dataset report session has expired.",
      },
      {
        status:
          datasetLookup.status === "expired" ? 409 : 503,
      },
    );
  }

  let deleted;

  try {
    deleted = await deleteSessionReport(
      runtimeSessionId,
      body.reportId,
      datasetSession.datasetIdentity,
    );
  } catch {
    return Response.json(
      { error: "The Dataset report store is temporarily unavailable." },
      { status: 503 },
    );
  }

  if (deleted.status === "temporarily-unavailable") {
    return Response.json(
      { error: "The Dataset report store is temporarily unavailable." },
      { status: 503 },
    );
  }

  if (deleted.status === "conflict" || deleted.status === "expired") {
    return Response.json(
      { error: "The Dataset report lifecycle changed before deletion." },
      { status: 409 },
    );
  }

  if (deleted.status === "not-found") {
    return Response.json({ error: "Report not found." }, { status: 404 });
  }

  return Response.json({ deleted: true });
}
