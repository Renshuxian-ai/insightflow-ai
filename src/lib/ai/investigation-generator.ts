import type { DiagnosticCase } from "@/lib/diagnostics/types";

import {
  InvestigationOutputValidationError,
  parseInvestigationResult,
} from "./output-schema";
import { defaultInvestigationModelId } from "./model-registry";
import { routeInvestigationModel } from "./model-router";
import { ProviderUnavailableError } from "./provider";
import type {
  InvestigationFallbackReason,
  InvestigationGenerationResult,
  InvestigationModelId,
} from "./types";

async function generateWithModel(
  diagnosticCase: DiagnosticCase,
  modelId: InvestigationModelId,
) {
  const { model, provider } = routeInvestigationModel(modelId);

  if (!provider.isAvailable()) {
    throw new ProviderUnavailableError(provider.id);
  }

  const output = await provider.generate({ diagnosticCase, model });
  return parseInvestigationResult(output, diagnosticCase);
}

function getFallbackReason(error: unknown): InvestigationFallbackReason {
  if (error instanceof ProviderUnavailableError) {
    return "provider-unavailable";
  }

  if (
    error instanceof InvestigationOutputValidationError ||
    error instanceof SyntaxError
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
    const result = await generateWithModel(diagnosticCase, requestedModelId);

    return {
      result,
      requestedModelId,
      usedModelId: requestedModelId,
      fallback: null,
    };
  } catch (error) {
    if (requestedModelId === defaultInvestigationModelId) {
      throw error;
    }

    const fallbackReason = getFallbackReason(error);
    const result = await generateWithModel(
      diagnosticCase,
      defaultInvestigationModelId,
    );

    return {
      result,
      requestedModelId,
      usedModelId: defaultInvestigationModelId,
      fallback: {
        reason: fallbackReason,
        message: fallbackMessages[fallbackReason],
      },
    };
  }
}
