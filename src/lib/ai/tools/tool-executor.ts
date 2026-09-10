import "server-only";

import { getToolDefinition } from "./tool-registry";
import type {
  ToolExecutionContext,
  ToolExecutionResult,
  ToolRequest,
} from "./types";

function rejectedResult(toolName: string, message: string): ToolExecutionResult {
  return {
    toolName,
    status: "rejected",
    observation: {
      summary: `${toolName} was not executed.`,
      facts: {},
      sourceReferences: [],
      limitations: [message],
    },
    message,
  };
}

function errorResult(toolName: string): ToolExecutionResult {
  return {
    toolName,
    status: "error",
    observation: {
      summary: `${toolName} could not complete its read-only observation.`,
      facts: {},
      sourceReferences: [],
      limitations: ["The tool could not complete this request."],
    },
    message: "The tool could not complete this request.",
  };
}

function isContextAllowed(context: ToolExecutionContext): boolean {
  return (
    context.diagnosticCase.source === "mock" &&
    context.diagnosticCase.status === "ready"
  );
}

function isToolRequest(value: unknown): value is ToolRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.name === "string" &&
    Object.prototype.hasOwnProperty.call(record, "input")
  );
}

export async function executeToolRequest(
  request: unknown,
  context: ToolExecutionContext,
): Promise<ToolExecutionResult> {
  if (!isToolRequest(request)) {
    return rejectedResult("unknown", "The tool request is invalid.");
  }

  const tool = getToolDefinition(request.name);

  if (!tool) {
    return rejectedResult(request.name, "This tool is not available for investigation.");
  }

  if (!isContextAllowed(context)) {
    return rejectedResult(
      tool.name,
      "This tool can only read a ready mock DiagnosticCase.",
    );
  }

  const validation = tool.validateInput(request.input, context);

  if (!validation.valid) {
    return rejectedResult(tool.name, validation.message);
  }

  try {
    const observation = await tool.execute(validation.value, context);

    return {
      toolName: tool.name,
      status: "success",
      observation,
      message: null,
    };
  } catch {
    return errorResult(tool.name);
  }
}
