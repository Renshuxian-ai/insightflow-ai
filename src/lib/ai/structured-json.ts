import "server-only";

import { routeStructuredJsonModel } from "./model-router";
import { ProviderUnavailableError } from "./provider";
import type { AIModelId } from "./types";

export type StructuredJsonGenerationRequest = {
  modelId: AIModelId;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
};

export async function generateStructuredJson({
  modelId,
  systemPrompt,
  userPrompt,
  temperature,
  maxTokens,
}: StructuredJsonGenerationRequest): Promise<unknown> {
  const { model, provider } = routeStructuredJsonModel(modelId);

  if (!provider.isAvailable()) {
    throw new ProviderUnavailableError(provider.id);
  }

  return provider.generateStructuredJson({
    model,
    systemPrompt,
    userPrompt,
    temperature,
    maxTokens,
  });
}
