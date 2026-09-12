import type { DiagnosticCase } from "@/lib/diagnostics/types";

import { runBoundedInvestigationAgent } from "./agent/investigation-agent";
import {
  InvestigationOutputValidationError,
  parseInvestigationResult,
} from "./output-schema";
import { defaultInvestigationModelId } from "./model-registry";
import { routeInvestigationModel } from "./model-router";
import {
  ProviderRequestError,
  ProviderUnavailableError,
} from "./provider";
import type {
  InvestigationFallbackReason,
  InvestigationGenerationResult,
  InvestigationModelDefinition,
  InvestigationModelId,
} from "./types";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function attachGeneratedInvestigationMetadata(
  value: unknown,
  diagnosticCase: DiagnosticCase,
  model: InvestigationModelDefinition,
): unknown {
  if (model.providerId === "mock" || !isRecord(value)) {
    return value;
  }

  const workingHypothesis = value.workingHypothesis;

  return {
    ...value,
    id: `investigation-${diagnosticCase.id}-${model.id}`,
    diagnosticCaseId: diagnosticCase.id,
    source: model.providerId,
    status: "generated-draft",
    workingHypothesis: isRecord(workingHypothesis)
      ? {
          ...workingHypothesis,
          id: `hypothesis-${diagnosticCase.id}-${model.id}`,
          status: "unvalidated",
        }
      : workingHypothesis,
  };
}

function validateGeneratedInvestigation(
  value: unknown,
  diagnosticCase: DiagnosticCase,
) {
  try {
    return parseInvestigationResult(value, diagnosticCase);
  } catch (error) {
    if (
      process.env.NODE_ENV === "development" &&
      error instanceof InvestigationOutputValidationError
    ) {
      const { path, issue, expected, receivedType, received } =
        error.diagnostic;

      console.error(
        [
          "Investigation validation failed:",
          `path=${path}`,
          `reason=${issue}`,
          `expected=${expected}`,
          `receivedType=${receivedType}`,
          `receivedSummary=${received}`,
        ].join("\n"),
      );
    }

    throw error;
  }
}

async function generateWithModel(
  diagnosticCase: DiagnosticCase,
  modelId: InvestigationModelId,
) {
  const { model, provider } = routeInvestigationModel(modelId);

  if (!provider.isAvailable()) {
    throw new ProviderUnavailableError(provider.id);
  }

  const agentResult = await runBoundedInvestigationAgent({
    diagnosticCase,
    model,
    provider,
  });

  const outputWithMetadata = attachGeneratedInvestigationMetadata(
    agentResult.output,
    diagnosticCase,
    model,
  );

  return {
    result: validateGeneratedInvestigation(outputWithMetadata, diagnosticCase),
    trace: agentResult.trace,
  };
}

function getFallbackReason(error: unknown): InvestigationFallbackReason {
  if (error instanceof ProviderUnavailableError) {
    return "provider-unavailable";
  }

  if (
    error instanceof InvestigationOutputValidationError ||
    error instanceof SyntaxError ||
    (error instanceof ProviderRequestError && error.code === "invalid-json")
  ) {
    return "invalid-output";
  }

  return "provider-error";
}

const fallbackMessages: Record<InvestigationFallbackReason, string> = {
  "provider-unavailable":
    "DeepSeek is not configured. Mock Prototype was used instead.",
  "provider-error":
    "DeepSeek could not complete this request. Mock Prototype was used instead.",
  "invalid-output":
    "DeepSeek returned an invalid draft. Mock Prototype was used instead.",
};

export async function generateInvestigation(
  diagnosticCase: DiagnosticCase,
  requestedModelId: InvestigationModelId,
): Promise<InvestigationGenerationResult> {
  try {
    const generation = await generateWithModel(
      diagnosticCase,
      requestedModelId,
    );

    return {
      result: generation.result,
      trace: generation.trace,
      requestedModelId,
      usedModelId: requestedModelId,
      fallback: null,
    };
  } catch (error) {
    if (requestedModelId === defaultInvestigationModelId) {
      throw error;
    }

    const fallbackReason = getFallbackReason(error);
    const generation = await generateWithModel(
      diagnosticCase,
      defaultInvestigationModelId,
    );

    return {
      result: generation.result,
      trace: generation.trace,
      requestedModelId,
      usedModelId: defaultInvestigationModelId,
      fallback: {
        reason: fallbackReason,
        message: fallbackMessages[fallbackReason],
      },
    };
  }
}
