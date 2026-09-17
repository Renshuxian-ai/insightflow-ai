import { cookies } from "next/headers";

import { lookupDatasetSession } from "@/lib/analytics/dataset-context/session-store";
import {
  DATASET_MODE_COOKIE,
  getDatasetModeRuntimeSessionId,
} from "@/lib/datasets/dataset-mode";
import { getAnalyticsInvestigationToolNames } from "@/lib/ai/agent/investigation-agent";
import { generateInvestigation } from "@/lib/ai/investigation-generator";
import { generateDatasetInvestigation } from "@/lib/ai/dataset-investigation-generator";
import { isInvestigationModelId } from "@/lib/ai/model-registry";
import type { InvestigationGenerationRequest } from "@/lib/ai/types";
import { isDatasetDiagnosticCaseId } from "@/lib/diagnostics/dataset-diagnostic-case";
import {
  DatasetDiagnosticCaseValidationError,
  parseDatasetDiagnosticCase,
} from "@/lib/diagnostics/server/dataset-diagnostic-case-schema";
import { getDiagnosticCase } from "@/lib/diagnostics-mock-data";
import {
  getDatasetInvestigation,
  deleteDatasetInvestigation,
  listDatasetInvestigations,
  updateDatasetInvestigation,
} from "@/lib/investigations/dataset-investigation-store";
import { mockInvestigations } from "@/lib/investigations/mock-investigations";
import { getRuntimeSessionId } from "@/lib/runtime-session";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isUploadedDatasetCase(
  diagnosticCase: ReturnType<typeof parseDatasetDiagnosticCase>,
): boolean {
  return diagnosticCase.evidence.behaviorSignals.some((signal) =>
    signal.source.startsWith("Uploaded dataset"),
  );
}

function matchesPersistedDiagnosticCase(
  submittedCase: ReturnType<typeof parseDatasetDiagnosticCase>,
  persistedCase: ReturnType<typeof parseDatasetDiagnosticCase>,
) {
  return (
    submittedCase.id === persistedCase.id &&
    submittedCase.metric.id === persistedCase.metric.id &&
    submittedCase.title === persistedCase.title &&
    submittedCase.primarySignal?.metric === persistedCase.primarySignal?.metric &&
    submittedCase.primarySignal?.interval === persistedCase.primarySignal?.interval &&
    submittedCase.primarySignal?.segment === persistedCase.primarySignal?.segment &&
    submittedCase.primarySignal?.currentValue === persistedCase.primarySignal?.currentValue &&
    submittedCase.primarySignal?.baselineValue === persistedCase.primarySignal?.baselineValue
  );
}

export async function GET() {
  const cookieStore = await cookies();
  const datasetSessionId = getDatasetModeRuntimeSessionId(
    cookieStore.get(DATASET_MODE_COOKIE)?.value,
  );
  const datasetMode = Boolean(datasetSessionId);
  const datasetLookup = datasetSessionId
    ? await lookupDatasetSession(datasetSessionId)
    : null;
  const datasetSession =
    datasetLookup?.status === "ready"
      ? datasetLookup.session.analyticsSession
      : null;
  let investigations = datasetMode ? [] : mockInvestigations;

  if (datasetSession && datasetSessionId) {
    try {
      investigations = await listDatasetInvestigations(
        datasetSessionId,
        datasetSession.datasetIdentity,
      );
    } catch {
      investigations = [];
    }
  }

  return Response.json({
    investigations,
    mode: datasetMode ? "dataset" : "demo",
    datasetUnavailable: datasetMode && !datasetSession,
  });
}

export async function POST(request: Request) {
  let requestBody: unknown;

  try {
    requestBody = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  if (!isRecord(requestBody)) {
    return Response.json({ error: "Invalid investigation request." }, { status: 400 });
  }

  const diagnosticCaseId = requestBody.diagnosticCaseId;
  const modelId = requestBody.modelId;
  const investigationCaseId = requestBody.investigationCaseId;
  const cookieStore = await cookies();
  const datasetModeSessionId = getDatasetModeRuntimeSessionId(
    cookieStore.get(DATASET_MODE_COOKIE)?.value,
  );
  const datasetMode = Boolean(datasetModeSessionId);

  if (
    typeof diagnosticCaseId !== "string" ||
    !isInvestigationModelId(modelId) ||
    (investigationCaseId !== undefined &&
      (typeof investigationCaseId !== "string" ||
        investigationCaseId.length === 0 ||
        investigationCaseId.length > 240))
  ) {
    return Response.json({ error: "Invalid case or model selection." }, { status: 400 });
  }

  const generationRequest: InvestigationGenerationRequest = {
    diagnosticCaseId,
    modelId,
  };
  const hasDatasetPayload = requestBody.diagnosticCase !== undefined;
  const usesDatasetDiagnosticCaseId = isDatasetDiagnosticCaseId(diagnosticCaseId);

  if (datasetMode && !hasDatasetPayload) {
    return Response.json(
      { error: "Dataset Mode requires an exact persisted Dataset investigation." },
      { status: 409 },
    );
  }

  if (
    usesDatasetDiagnosticCaseId ||
    hasDatasetPayload
  ) {
    if (requestBody.diagnosticCase === undefined) {
      return Response.json(
        { error: "A Dataset DiagnosticCase payload is required." },
        { status: 400 },
      );
    }

    if (modelId !== "deepseek-v3") {
      return Response.json(
        { error: "Dataset investigations require the DeepSeek V3 model." },
        { status: 400 },
      );
    }

    let diagnosticCase;

    try {
      diagnosticCase = parseDatasetDiagnosticCase(requestBody.diagnosticCase);
    } catch (error) {
      if (error instanceof DatasetDiagnosticCaseValidationError) {
        return Response.json(
          { error: "Invalid Dataset DiagnosticCase payload." },
          { status: 400 },
        );
      }

      throw error;
    }

    if (diagnosticCase.id !== diagnosticCaseId) {
      return Response.json(
        { error: "The Dataset DiagnosticCase identity does not match the request." },
        { status: 400 },
      );
    }

    try {
      const datasetSessionId = getRuntimeSessionId(request);
      const uploadedDatasetCase = isUploadedDatasetCase(diagnosticCase);

      if (datasetMode !== uploadedDatasetCase) {
        return Response.json(
          { error: "The investigation source does not match the active workspace mode." },
          { status: 409 },
        );
      }

      if (datasetMode && datasetModeSessionId !== datasetSessionId) {
        return Response.json(
          { error: "A confirmed Dataset session is required." },
          { status: 409 },
        );
      }

      const datasetLookup = datasetMode && datasetModeSessionId
        ? await lookupDatasetSession(datasetModeSessionId)
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

      let persistedInvestigation;

      try {
        persistedInvestigation =
          datasetSession &&
          datasetSessionId &&
          typeof investigationCaseId === "string"
            ? await getDatasetInvestigation(
                datasetSessionId,
                investigationCaseId,
                datasetSession.datasetIdentity,
              )
            : null;
      } catch {
        return Response.json(
          { error: "The Dataset investigation store is temporarily unavailable." },
          { status: 503 },
        );
      }

      if (
        datasetMode &&
        (!persistedInvestigation ||
          !matchesPersistedDiagnosticCase(
            diagnosticCase,
            persistedInvestigation.diagnosticCase,
          ))
      ) {
        return Response.json(
          { error: "The Dataset investigation case is no longer available." },
          { status: 409 },
        );
      }
      const generation = await generateDatasetInvestigation(
        diagnosticCase,
        datasetMode && datasetSession && persistedInvestigation
          ? {
              datasetAnalyticsContext: datasetSession.analyticsContext,
              analyticsToolNames:
                getAnalyticsInvestigationToolNames(diagnosticCase) ??
                undefined,
              investigationCaseId: persistedInvestigation.id,
            }
          : {},
      );

      if (
        datasetMode &&
        datasetSession &&
        datasetSessionId &&
        persistedInvestigation
      ) {
        let persistenceResult;

        try {
          persistenceResult = await updateDatasetInvestigation({
            sessionId: datasetSessionId,
            investigationId: persistedInvestigation.id,
            datasetIdentity: datasetSession.datasetIdentity,
            generation: {
              result: generation.result,
              trace: generation.trace,
              usedModelId: generation.usedModelId,
              createdAt: new Date().toISOString(),
            },
          });
        } catch {
          return Response.json(
            { error: "The Dataset investigation store is temporarily unavailable." },
            { status: 503 },
          );
        }

        if (persistenceResult.status === "temporarily-unavailable") {
          return Response.json(
            { error: "The Dataset investigation store is temporarily unavailable." },
            { status: 503 },
          );
        }

        if (persistenceResult.status !== "ok") {
          return Response.json(
            { error: "The Dataset investigation lifecycle changed before the result could be saved." },
            { status: 409 },
          );
        }
      }

      return Response.json(generation);
    } catch {
      return Response.json(
        { error: "Unable to generate a validated investigation draft." },
        { status: 500 },
      );
    }
  }

  const diagnosticCase = getDiagnosticCase(generationRequest.diagnosticCaseId);

  if (!diagnosticCase) {
    return Response.json({ error: "Diagnostic case not found." }, { status: 404 });
  }

  try {
    const generation = await generateInvestigation(
      diagnosticCase,
      generationRequest.modelId,
    );

    return Response.json(generation);
  } catch {
    return Response.json(
      { error: "Unable to generate a validated investigation draft." },
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
    typeof body.investigationCaseId !== "string" ||
    body.investigationCaseId.length === 0 ||
    body.investigationCaseId.length > 240
  ) {
    return Response.json(
      { error: "A valid investigation case is required." },
      { status: 400 },
    );
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
            ? "The Dataset investigation store is temporarily unavailable."
            : "The Dataset investigation session has expired.",
      },
      {
        status:
          datasetLookup.status === "expired" ? 409 : 503,
      },
    );
  }

  let deleted;

  try {
    deleted = await deleteDatasetInvestigation({
      sessionId: runtimeSessionId,
      investigationId: body.investigationCaseId,
      datasetIdentity: datasetSession.datasetIdentity,
    });
  } catch {
    return Response.json(
      { error: "The Dataset investigation store is temporarily unavailable." },
      { status: 503 },
    );
  }

  if (deleted.status === "temporarily-unavailable") {
    return Response.json(
      { error: "The Dataset investigation store is temporarily unavailable." },
      { status: 503 },
    );
  }

  if (deleted.status === "conflict" || deleted.status === "expired") {
    return Response.json(
      { error: "The Dataset investigation lifecycle changed before deletion." },
      { status: 409 },
    );
  }

  if (deleted.status === "not-found") {
    return Response.json(
      { error: "Investigation not found." },
      { status: 404 },
    );
  }

  return Response.json({ deleted: true });
}
