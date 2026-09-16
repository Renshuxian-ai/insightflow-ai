import { cookies } from "next/headers";

import {
  DATASET_ANALYTICS_SESSION_COOKIE,
  getDatasetAnalyticsSession,
} from "@/lib/analytics/dataset-context/session-store";
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
  reconcileDatasetInvestigationReports,
  updateDatasetInvestigation,
} from "@/lib/investigations/dataset-investigation-store";
import { mockInvestigations } from "@/lib/investigations/mock-investigations";
import {
  deleteSessionReport,
  getSessionReports,
} from "@/lib/reports/session-report-store";
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
  const datasetSessionId = cookieStore.get(
    DATASET_ANALYTICS_SESSION_COOKIE,
  )?.value;
  const datasetSession = getDatasetAnalyticsSession(datasetSessionId);

  if (datasetSession && datasetSessionId) {
    reconcileDatasetInvestigationReports({
      sessionId: datasetSessionId,
      datasetIdentity: datasetSession.datasetIdentity,
      reports: getSessionReports(
        datasetSessionId,
        datasetSession.datasetIdentity,
      ),
    });
  }

  return Response.json({
    investigations:
      datasetSession && datasetSessionId
        ? listDatasetInvestigations(
            datasetSessionId,
            datasetSession.datasetIdentity,
          )
        : mockInvestigations,
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

  if (
    isDatasetDiagnosticCaseId(diagnosticCaseId) ||
    requestBody.diagnosticCase !== undefined
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
      const datasetSession = isUploadedDatasetCase(diagnosticCase)
        ? getDatasetAnalyticsSession(datasetSessionId ?? undefined)
        : null;
      const persistedInvestigation =
        datasetSession &&
        datasetSessionId &&
        typeof investigationCaseId === "string"
          ? getDatasetInvestigation(
              datasetSessionId,
              investigationCaseId,
              datasetSession.datasetIdentity,
            )
          : null;

      if (
        isUploadedDatasetCase(diagnosticCase) &&
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
        datasetSession && persistedInvestigation
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
        datasetSession &&
        datasetSessionId &&
        persistedInvestigation
      ) {
        updateDatasetInvestigation({
          sessionId: datasetSessionId,
          investigationId: persistedInvestigation.id,
          datasetIdentity: datasetSession.datasetIdentity,
          status: "Validation ready",
          generation: {
            result: generation.result,
            trace: generation.trace,
            usedModelId: generation.usedModelId,
            createdAt: new Date().toISOString(),
          },
        });
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

  const datasetSession = getDatasetAnalyticsSession(runtimeSessionId);

  if (!datasetSession) {
    return Response.json(
      { error: "The Dataset investigation session is no longer available." },
      { status: 409 },
    );
  }

  const deleted = deleteDatasetInvestigation({
    sessionId: runtimeSessionId,
    investigationId: body.investigationCaseId,
    datasetIdentity: datasetSession.datasetIdentity,
  });

  if (!deleted) {
    return Response.json(
      { error: "Investigation not found." },
      { status: 404 },
    );
  }

  if (deleted.reportId) {
    deleteSessionReport(
      runtimeSessionId,
      deleted.reportId,
      datasetSession.datasetIdentity,
    );
  }

  return Response.json({ deleted: true });
}
