import "server-only";

import type {
  AgentModelTurn,
  AgentProviderRequest,
} from "./agent/types";
import type {
  AIModelDefinition,
  AIModelCapability,
  AIProviderId,
} from "./types";

export type StructuredJsonModelInput = {
  model: AIModelDefinition;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
};

export type AgentModelProviderInput = {
  model: AIModelDefinition;
  request: AgentProviderRequest;
};

export interface AIModelProvider {
  id: AIProviderId;
  isAvailable(): boolean;
  generateStructuredJson?(
    input: StructuredJsonModelInput,
  ): Promise<unknown>;
  runAgentTurn?(input: AgentModelProviderInput): Promise<AgentModelTurn>;
}

export type StructuredJsonModelProvider = AIModelProvider & {
  generateStructuredJson(input: StructuredJsonModelInput): Promise<unknown>;
};

export type AgentModelProvider = AIModelProvider & {
  runAgentTurn(input: AgentModelProviderInput): Promise<AgentModelTurn>;
};

export type ProviderRequestErrorCode =
  | "timeout"
  | "transport-error"
  | "http-error"
  | "invalid-response"
  | "invalid-json";

export class ProviderUnavailableError extends Error {
  constructor(providerId: AIProviderId) {
    super(providerId + " provider is unavailable.");
    this.name = "ProviderUnavailableError";
  }
}

export class ProviderCapabilityError extends Error {
  constructor(
    providerId: AIProviderId,
    capability: AIModelCapability,
  ) {
    super(providerId + " provider does not support " + capability + ".");
    this.name = "ProviderCapabilityError";
  }
}

export class ProviderRequestError extends Error {
  constructor(
    readonly providerId: AIProviderId,
    readonly code: ProviderRequestErrorCode,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ProviderRequestError";
  }
}
