import type {
  AgentModelProvider,
  AIModelProvider,
  StructuredJsonModelProvider,
} from "./provider";
import { ProviderCapabilityError } from "./provider";
import { getAIModel, getInvestigationModel } from "./model-registry";
import { deepSeekModelProvider } from "./providers/deepseek-provider";
import { mockModelProvider } from "./providers/mock-provider";
import type {
  AIModelId,
  AIProviderId,
  InvestigationModelId,
} from "./types";

const providerRegistry: Record<AIProviderId, AIModelProvider> = {
  mock: mockModelProvider,
  deepseek: deepSeekModelProvider,
};

export function routeInvestigationModel(modelId: InvestigationModelId) {
  const model = getInvestigationModel(modelId);
  const provider = providerRegistry[model.providerId];

  if (
    !model.capabilities.includes("agent-tool-calling") ||
    !provider.runAgentTurn
  ) {
    throw new ProviderCapabilityError(
      provider.id,
      "agent-tool-calling",
    );
  }

  return {
    model,
    provider: provider as AgentModelProvider,
  };
}

export function routeStructuredJsonModel(modelId: AIModelId) {
  const model = getAIModel(modelId);
  const provider = providerRegistry[model.providerId];

  if (
    !model.capabilities.includes("structured-json") ||
    !provider.generateStructuredJson
  ) {
    throw new ProviderCapabilityError(provider.id, "structured-json");
  }

  return {
    model,
    provider: provider as StructuredJsonModelProvider,
  };
}
