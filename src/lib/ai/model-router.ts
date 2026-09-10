import type { InvestigationProvider } from "./provider";
import { getInvestigationModel } from "./model-registry";
import { deepSeekInvestigationProvider } from "./providers/deepseek-provider";
import { mockInvestigationProvider } from "./providers/mock-provider";
import type { AIProviderId, InvestigationModelId } from "./types";

const providerRegistry: Record<AIProviderId, InvestigationProvider> = {
  mock: mockInvestigationProvider,
  deepseek: deepSeekInvestigationProvider,
};

export function routeInvestigationModel(modelId: InvestigationModelId) {
  const model = getInvestigationModel(modelId);

  return {
    model,
    provider: providerRegistry[model.providerId],
  };
}
