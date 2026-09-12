import type {
  AIModelDefinition,
  AIModelId,
  InvestigationModelDefinition,
  InvestigationModelId,
  InvestigationModelOption,
} from "./types";

export const defaultInvestigationModelId: InvestigationModelId =
  "mock-prototype";

export const aiModelRegistry: Record<AIModelId, AIModelDefinition> = {
  "mock-prototype": {
    id: "mock-prototype",
    label: "Mock Prototype",
    description: "Uses the existing evidence-linked prototype draft.",
    providerId: "mock",
    providerModel: "mock-investigation-v1",
    capabilities: ["agent-tool-calling"],
  },
  "deepseek-v3": {
    id: "deepseek-v3",
    label: "DeepSeek V3",
    description: "Generates a grounded draft from the selected DiagnosticCase.",
    providerId: "deepseek",
    providerModel: "deepseek-chat",
    capabilities: ["structured-json", "agent-tool-calling"],
  },
};

export const investigationModelRegistry: Record<
  InvestigationModelId,
  InvestigationModelDefinition
> = aiModelRegistry;

export const investigationModelOptions: InvestigationModelOption[] =
  Object.values(investigationModelRegistry).map(
    ({ id, label, description }) => ({ id, label, description }),
  );

export function isInvestigationModelId(
  value: unknown,
): value is InvestigationModelId {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(investigationModelRegistry, value)
  );
}

export function getInvestigationModel(
  modelId: InvestigationModelId,
): InvestigationModelDefinition {
  return investigationModelRegistry[modelId];
}

export function getAIModel(modelId: AIModelId): AIModelDefinition {
  return aiModelRegistry[modelId];
}
