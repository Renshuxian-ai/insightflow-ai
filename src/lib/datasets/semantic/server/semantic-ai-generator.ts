import "server-only";

import {
  generateStructuredJson,
  type StructuredJsonGenerationRequest,
} from "@/lib/ai/structured-json";
import type { AIModelId } from "@/lib/ai/types";

import {
  stampSemanticAiSuggestions,
  unwrapSemanticAiSuggestionResponse,
  validateSemanticAiSuggestionOutput,
} from "./ai-output-schema";
import { buildSemanticAiPrompt } from "./semantic-ai-prompt";
import type {
  SemanticInferenceContext,
  SemanticSuggestion,
} from "../types";

export type SemanticAiSuggestionGenerationInput = {
  context: SemanticInferenceContext;
  modelId: AIModelId;
  datasetContext?: string | null;
};

type StructuredJsonGenerator = (
  request: StructuredJsonGenerationRequest,
) => Promise<unknown>;

export function createSemanticAiSuggestionGenerator(
  structuredJsonGenerator: StructuredJsonGenerator = generateStructuredJson,
) {
  return async function generateSemanticAiSuggestions({
    context,
    modelId,
    datasetContext,
  }: SemanticAiSuggestionGenerationInput): Promise<SemanticSuggestion[]> {
    const { systemPrompt, userPrompt } = buildSemanticAiPrompt({
      context,
      datasetContext,
    });
    const rawResponse = await structuredJsonGenerator({
      modelId,
      systemPrompt,
      userPrompt,
    });
    const rawSuggestions = unwrapSemanticAiSuggestionResponse(rawResponse);
    const validatedOutputs = validateSemanticAiSuggestionOutput(
      rawSuggestions,
      context,
    );

    return stampSemanticAiSuggestions(validatedOutputs);
  };
}

export const generateSemanticAiSuggestions =
  createSemanticAiSuggestionGenerator();
