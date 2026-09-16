import type { ProviderToolDefinition } from "../agent/types";
import type { ToolDefinition } from "../tools/types";

export type LlmFunctionToolSchema = {
  type: "function";
  function: {
    name: ToolDefinition["name"];
    description: string;
    parameters: ToolDefinition["inputSchema"];
  };
};

export function adaptToolDefinitionToFunctionSchema(
  tool: ToolDefinition,
): LlmFunctionToolSchema {
  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    },
  };
}

export function adaptToolDefinitionsToFunctionSchemas(
  tools: readonly ToolDefinition[],
): LlmFunctionToolSchema[] {
  return tools.map(adaptToolDefinitionToFunctionSchema);
}

export function toProviderToolDefinition(
  schema: LlmFunctionToolSchema,
): ProviderToolDefinition {
  return {
    name: schema.function.name,
    description: schema.function.description,
    inputSchema: schema.function.parameters,
  };
}
