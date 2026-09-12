import type { InvestigationResult } from "@/lib/investigations/types";
import type { AgentTrace } from "./agent/types";

export type AIProviderId = "mock" | "deepseek";

export type AIModelId = "mock-prototype" | "deepseek-v3";

export type InvestigationModelId = AIModelId;

export type AIModelCapability = "structured-json" | "agent-tool-calling";

export type AIModelDefinition<TModelId extends string = AIModelId> = {
  id: TModelId;
  label: string;
  description: string;
  providerId: AIProviderId;
  providerModel: string;
  capabilities: readonly AIModelCapability[];
};

export type InvestigationModelDefinition =
  AIModelDefinition<InvestigationModelId>;

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
  trace: AgentTrace;
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
