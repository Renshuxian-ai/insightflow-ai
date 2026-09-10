import type { InvestigationResult } from "@/lib/investigations/types";

export type AIProviderId = "mock" | "deepseek";

export type InvestigationModelId = "mock-prototype" | "deepseek-v3";

export type InvestigationModelDefinition = {
  id: InvestigationModelId;
  label: string;
  description: string;
  providerId: AIProviderId;
  providerModel: string;
};

export type InvestigationModelOption = Pick<
  InvestigationModelDefinition,
  "id" | "label" | "description"
>;

export type InvestigationFallbackReason =
  | "provider-unavailable"
  | "provider-error"
  | "invalid-output";

export type InvestigationGenerationResult = {
  result: InvestigationResult;
  requestedModelId: InvestigationModelId;
  usedModelId: InvestigationModelId;
  fallback: {
    reason: InvestigationFallbackReason;
    message: string;
  } | null;
};

export type InvestigationGenerationRequest = {
  diagnosticCaseId: string;
  modelId: InvestigationModelId;
};
