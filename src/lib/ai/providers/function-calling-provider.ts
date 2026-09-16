import type {
  AgentMessage,
  AgentModelTurn,
  AgentToolCall,
  AgentTurnPhase,
} from "../agent/types";
import type { AgentModelProvider } from "../provider";
import type { ToolDefinition } from "../tools/types";
import type { InvestigationModelDefinition } from "../types";
import {
  adaptToolDefinitionsToFunctionSchemas,
  toProviderToolDefinition,
} from "./tool-schema-adapter";

export type LlmFunctionCall = {
  id: string;
  toolName: string;
  arguments: unknown;
};

export type FunctionCallingProviderResult =
  | {
      kind: "assistant";
      message: AgentMessage;
      output: unknown;
    }
  | {
      kind: "tool-calls";
      message: AgentMessage;
      toolCalls: LlmFunctionCall[];
    };

export type FunctionCallingProviderInput = {
  model: InvestigationModelDefinition;
  phase: AgentTurnPhase;
  messages: AgentMessage[];
  tools: readonly ToolDefinition[];
  prototypeTurn?: AgentModelTurn;
};

export type FunctionCallingProvider = {
  id: AgentModelProvider["id"];
  isAvailable(): boolean;
  run(
    input: FunctionCallingProviderInput,
  ): Promise<FunctionCallingProviderResult>;
};

function toFunctionCall(toolCall: AgentToolCall): LlmFunctionCall {
  return {
    id: toolCall.id,
    toolName: toolCall.name,
    arguments: toolCall.input,
  };
}

export function createFunctionCallingProvider(
  provider: AgentModelProvider,
): FunctionCallingProvider {
  return {
    id: provider.id,
    isAvailable: () => provider.isAvailable(),
    async run(input) {
      const functionSchemas = adaptToolDefinitionsToFunctionSchemas(input.tools);
      const turn = await provider.runAgentTurn({
        model: input.model,
        request: {
          phase: input.phase,
          messages: input.messages,
          tools: functionSchemas.map(toProviderToolDefinition),
          ...(input.prototypeTurn
            ? { prototypeTurn: input.prototypeTurn }
            : {}),
        },
      });

      if (turn.kind === "tool-calls") {
        return {
          kind: "tool-calls",
          message: turn.message,
          toolCalls: turn.toolCalls.map(toFunctionCall),
        };
      }

      return {
        kind: "assistant",
        message: turn.message,
        output: turn.output,
      };
    },
  };
}
