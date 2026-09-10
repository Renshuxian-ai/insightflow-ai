import type { DiagnosticCase } from "@/lib/diagnostics/types";

import type {
  AgentModelTurn,
  AgentProviderRequest,
} from "./agent/types";
import type {
  AIProviderId,
  InvestigationModelDefinition,
} from "./types";

export type InvestigationProviderInput = {
  diagnosticCase: DiagnosticCase;
  model: InvestigationModelDefinition;
};

export type InvestigationProviderAgentInput = InvestigationProviderInput & {
  request: AgentProviderRequest;
};

export interface InvestigationProvider {
  id: AIProviderId;
  isAvailable(): boolean;
  generate(input: InvestigationProviderInput): Promise<unknown>;
  runAgentTurn(
    input: InvestigationProviderAgentInput,
  ): Promise<AgentModelTurn>;
}

export class ProviderUnavailableError extends Error {
  constructor(providerId: AIProviderId) {
    super(`${providerId} provider is unavailable.`);
    this.name = "ProviderUnavailableError";
  }
}
