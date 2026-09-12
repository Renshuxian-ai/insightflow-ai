import "server-only";

import type {
  AgentMessage,
  AgentModelTurn,
  AgentToolCall,
  ProviderToolDefinition,
} from "../agent/types";
import type {
  AgentModelProviderInput,
  AIModelProvider,
  StructuredJsonParseDiagnostic,
  StructuredJsonModelInput,
} from "../provider";
import {
  ProviderRequestError,
  ProviderUnavailableError,
} from "../provider";

const deepSeekEndpoint = "https://api.deepseek.com/chat/completions";
const defaultTemperature = 0.2;
const defaultMaxTokens = 3_000;

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readFirstChoice(value: unknown): JsonRecord | null {
  if (!isRecord(value) || !Array.isArray(value.choices)) {
    return null;
  }

  const firstChoice = value.choices[0];

  return isRecord(firstChoice) ? firstChoice : null;
}

function invalidResponse(message: string): ProviderRequestError {
  return new ProviderRequestError("deepseek", "invalid-response", message);
}

function readFirstMessage(value: unknown): JsonRecord {
  if (!isRecord(value) || !Array.isArray(value.choices)) {
    throw invalidResponse("DeepSeek returned an invalid response envelope.");
  }

  const firstChoice = value.choices[0];

  if (!isRecord(firstChoice) || !isRecord(firstChoice.message)) {
    throw invalidResponse("DeepSeek returned no message.");
  }

  return firstChoice.message;
}

function readMessageContent(value: unknown): string {
  const content = readFirstMessage(value).content;

  if (typeof content !== "string" || content.trim().length === 0) {
    throw invalidResponse("DeepSeek returned empty content.");
  }

  return content;
}

function readSafeFinishReason(value: unknown): StructuredJsonParseDiagnostic["finishReason"] {
  const finishReason = readFirstChoice(value)?.finish_reason;

  if (finishReason === "stop" || finishReason === "length") {
    return finishReason;
  }

  if (finishReason === "tool_calls" || finishReason === "content_filter") {
    return finishReason;
  }

  return typeof finishReason === "string" ? "other" : null;
}

function readSafeCompletionTokens(value: unknown): number | null {
  if (!isRecord(value) || !isRecord(value.usage)) {
    return null;
  }

  const completionTokens = value.usage.completion_tokens;

  return typeof completionTokens === "number" &&
    Number.isSafeInteger(completionTokens) &&
    completionTokens >= 0 &&
    completionTokens <= 1_000_000
    ? completionTokens
    : null;
}

function createStructuredJsonParseDiagnostic(
  response: unknown,
  content: string,
  requestedMaxTokens: number,
): StructuredJsonParseDiagnostic {
  const leadingContent = content.trimStart();
  const trailingContent = content.trimEnd();
  const finishReason = readSafeFinishReason(response);
  const completionTokens = readSafeCompletionTokens(response);

  return {
    contentLength: content.length,
    startsWithCodeFence: leadingContent.startsWith("```"),
    startsWithObject: leadingContent.startsWith("{"),
    endsWithObject: trailingContent.endsWith("}"),
    hasLeadingText:
      !leadingContent.startsWith("{") && !leadingContent.startsWith("```"),
    finishReason,
    usagePresent: isRecord(response) && isRecord(response.usage),
    completionTokens,
    requestedMaxTokens,
    possiblyTruncated:
      finishReason === "length" ||
      (finishReason === null &&
        completionTokens !== null &&
        completionTokens >= requestedMaxTokens),
  };
}

function parseStructuredJson(
  content: string,
  diagnostic?: StructuredJsonParseDiagnostic,
): unknown {
  try {
    return JSON.parse(content) as unknown;
  } catch {
    throw new ProviderRequestError(
      "deepseek",
      "invalid-json",
      "DeepSeek returned invalid JSON.",
      undefined,
      diagnostic,
    );
  }
}

function getDeepSeekApiKey(): string {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();

  if (!apiKey) {
    throw new ProviderUnavailableError("deepseek");
  }

  return apiKey;
}

function toDeepSeekMessages(messages: AgentMessage[]): unknown[] {
  return messages.map((message) => {
    if (message.role === "system" || message.role === "user") {
      return {
        role: message.role,
        content: message.content,
      };
    }

    if (message.role === "assistant") {
      return {
        role: "assistant",
        content: message.content,
        ...(message.toolCalls.length > 0
          ? {
              tool_calls: message.toolCalls.map((toolCall) => ({
                id: toolCall.id,
                type: "function",
                function: {
                  name: toolCall.name,
                  arguments: JSON.stringify(toolCall.input),
                },
              })),
            }
          : {}),
      };
    }

    if (message.role === "tool") {
      return {
        role: "tool",
        tool_call_id: message.toolCallId,
        content: message.content,
      };
    }

    throw new ProviderRequestError(
      "deepseek",
      "invalid-response",
      "Unsupported model message.",
    );
  });
}

function toDeepSeekTools(tools: readonly ProviderToolDefinition[]): unknown[] {
  return tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    },
  }));
}

function parseToolInput(value: unknown): unknown {
  if (typeof value !== "string") {
    return null;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function readAgentToolCalls(message: JsonRecord): AgentToolCall[] {
  if (!Array.isArray(message.tool_calls)) {
    return [];
  }

  return message.tool_calls.map((rawToolCall, index) => {
    const toolCall = isRecord(rawToolCall) ? rawToolCall : {};
    const toolFunction = isRecord(toolCall.function) ? toolCall.function : {};

    return {
      id:
        typeof toolCall.id === "string"
          ? toolCall.id
          : "invalid-tool-call-" + (index + 1),
      name:
        typeof toolFunction.name === "string"
          ? toolFunction.name
          : "invalid_tool_call",
      input: parseToolInput(toolFunction.arguments),
    };
  });
}

function readAssistantContent(message: JsonRecord): string | null {
  return typeof message.content === "string" ? message.content : null;
}

async function requestDeepSeek(
  apiKey: string,
  body: Record<string, unknown>,
): Promise<unknown> {
  let response: Response;

  try {
    response = await fetch(deepSeekEndpoint, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45_000),
    });
  } catch (error) {
    const errorName = error instanceof Error ? error.name : "";

    throw new ProviderRequestError(
      "deepseek",
      errorName === "AbortError" || errorName === "TimeoutError"
        ? "timeout"
        : "transport-error",
      errorName === "AbortError" || errorName === "TimeoutError"
        ? "DeepSeek request timed out."
        : "DeepSeek request could not be completed.",
    );
  }

  if (!response.ok) {
    throw new ProviderRequestError(
      "deepseek",
      "http-error",
      "DeepSeek request failed with status " + response.status + ".",
      response.status,
    );
  }

  try {
    return (await response.json()) as unknown;
  } catch {
    throw invalidResponse("DeepSeek returned a non-JSON response.");
  }
}

async function generateDeepSeekStructuredJson(
  input: StructuredJsonModelInput,
): Promise<unknown> {
  const maxTokens = input.maxTokens ?? defaultMaxTokens;
  const responseBody = await requestDeepSeek(getDeepSeekApiKey(), {
    model: input.model.providerModel,
    messages: [
      { role: "system", content: input.systemPrompt },
      { role: "user", content: input.userPrompt },
    ],
    response_format: { type: "json_object" },
    temperature: input.temperature ?? defaultTemperature,
    max_tokens: maxTokens,
    stream: false,
  });
  const content = readMessageContent(responseBody);
  const parseDiagnostic = createStructuredJsonParseDiagnostic(
    responseBody,
    content,
    maxTokens,
  );

  if (parseDiagnostic.possiblyTruncated) {
    throw new ProviderRequestError(
      "deepseek",
      "invalid-json",
      "DeepSeek structured output may be truncated.",
      undefined,
      parseDiagnostic,
    );
  }

  return parseStructuredJson(content, parseDiagnostic);
}

async function runDeepSeekAgentTurn(
  input: AgentModelProviderInput,
): Promise<AgentModelTurn> {
  const responseBody = await requestDeepSeek(getDeepSeekApiKey(), {
    model: input.model.providerModel,
    messages: toDeepSeekMessages(input.request.messages),
    ...(input.request.phase === "tool-selection" && input.request.tools.length > 0
      ? {
          tools: toDeepSeekTools(input.request.tools),
          tool_choice: "auto",
        }
      : {
          response_format: { type: "json_object" },
        }),
    temperature: defaultTemperature,
    max_tokens: defaultMaxTokens,
    stream: false,
  });
  const message = readFirstMessage(responseBody);
  const toolCalls = readAgentToolCalls(message);
  const assistantMessage = {
    role: "assistant" as const,
    content: readAssistantContent(message),
    toolCalls,
  };

  if (toolCalls.length > 0) {
    return {
      kind: "tool-calls",
      message: assistantMessage,
      toolCalls,
    };
  }

  const content = assistantMessage.content;

  if (!content) {
    throw invalidResponse(
      "DeepSeek returned no final structured model output.",
    );
  }

  const maxTokens = defaultMaxTokens;

  return {
    kind: "final",
    message: assistantMessage,
    output: parseStructuredJson(
      content,
      createStructuredJsonParseDiagnostic(responseBody, content, maxTokens),
    ),
  };
}

export const deepSeekModelProvider: AIModelProvider = {
  id: "deepseek",
  isAvailable() {
    return Boolean(process.env.DEEPSEEK_API_KEY?.trim());
  },
  generateStructuredJson: generateDeepSeekStructuredJson,
  runAgentTurn: runDeepSeekAgentTurn,
};
