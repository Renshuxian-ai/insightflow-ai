import { generateInvestigation } from "@/lib/ai/investigation-generator";
import { generateDatasetInvestigation } from "@/lib/ai/dataset-investigation-generator";
import { isInvestigationModelId } from "@/lib/ai/model-registry";
import type { InvestigationGenerationRequest } from "@/lib/ai/types";
import { DATASET_PRIMARY_ANOMALY_ID } from "@/lib/diagnostics/dataset-diagnostic-case";
import {
  DatasetDiagnosticCaseValidationError,
  parseDatasetDiagnosticCase,
} from "@/lib/diagnostics/server/dataset-diagnostic-case-schema";
import { getDiagnosticCase } from "@/lib/diagnostics-mock-data";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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

  if (typeof diagnosticCaseId !== "string" || !isInvestigationModelId(modelId)) {
    return Response.json({ error: "Invalid case or model selection." }, { status: 400 });
  }

  const generationRequest: InvestigationGenerationRequest = {
    diagnosticCaseId,
    modelId,
  };

  if (
    diagnosticCaseId === DATASET_PRIMARY_ANOMALY_ID ||
    requestBody.diagnosticCase !== undefined
  ) {
    if (diagnosticCaseId !== DATASET_PRIMARY_ANOMALY_ID) {
      return Response.json(
        { error: "A Dataset DiagnosticCase cannot replace a mock case." },
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

    try {
      const generation = await generateDatasetInvestigation(diagnosticCase);

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
