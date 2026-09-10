import { generateInvestigation } from "@/lib/ai/investigation-generator";
import { isInvestigationModelId } from "@/lib/ai/model-registry";
import type { InvestigationGenerationRequest } from "@/lib/ai/types";
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
