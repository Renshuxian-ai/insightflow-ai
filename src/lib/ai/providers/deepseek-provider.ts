import { buildInvestigationPrompt } from "../prompts";
import type {
  AgentMessage,
  AgentModelTurn,
  AgentToolCall,
  ProviderToolDefinition,
} from "../agent/types";
import type {
  InvestigationProvider,
  InvestigationProviderAgentInput,
} from "../provider";
import { ProviderUnavailableError } from "../provider";

const deepSeekEndpoint = "https://api.deepseek.com/chat/completions";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readFirstMessage(value: unknown): JsonRecord {
  if (!isRecord(value) || !Array.isArray(value.choices)) {
    throw new Error("DeepSeek returned an invalid response envelope.");
  }

  const firstChoice = value.choices[0];

  if (!isRecord(firstChoice) || !isRecord(firstChoice.message)) {
    throw new Error("DeepSeek returned no message.");
  }

  return firstChoice.message;
}

function readMessageContent(value: unknown): string {
  const content = readFirstMessage(value).content;

  if (typeof content !== "string" || content.trim().length === 0) {
    throw new Error("DeepSeek returned empty content.");
  }

  return content;
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

    throw new Error("Unsupported agent message.");
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
          : `invalid-tool-call-${index + 1}`,
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
  const response = await fetch(deepSeekEndpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(45_000),
  });

  if (!response.ok) {
    throw new Error(`DeepSeek request failed with status ${response.status}.`);
  }

  return response.json() as Promise<unknown>;
}

async function runDeepSeekAgentTurn(
  apiKey: string,
  input: InvestigationProviderAgentInput,
): Promise<AgentModelTurn> {
  const responseBody = await requestDeepSeek(apiKey, {
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
    temperature: 0.2,
    max_tokens: 3_000,
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
    throw new Error("DeepSeek returned no final investigation output.");
  }

  return {
    kind: "final",
    message: assistantMessage,
    output: JSON.parse(content) as unknown,
  };
}

export const deepSeekInvestigationProvider: InvestigationProvider = {
  id: "deepseek",
  isAvailable() {
    return Boolean(process.env.DEEPSEEK_API_KEY?.trim());
  },
  async generate({ diagnosticCase, model }) {
    const apiKey = process.env.DEEPSEEK_API_KEY?.trim();

    if (!apiKey) {
      throw new ProviderUnavailableError("deepseek");
    }

    const prompt = buildInvestigationPrompt(diagnosticCase);
    const responseBody = await requestDeepSeek(apiKey, {
      model: model.providerModel,
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 3_000,
      stream: false,
    });
    const content = readMessageContent(responseBody);
    const generatedValue: unknown = JSON.parse(content);

    if (!isRecord(generatedValue)) {
      throw new Error("DeepSeek output must be a JSON object.");
    }

    const generatedHypothesis = isRecord(generatedValue.workingHypothesis)
      ? generatedValue.workingHypothesis
      : {};

    return {
      ...generatedValue,
      id: `investigation-${diagnosticCase.id}-${model.id}`,
      diagnosticCaseId: diagnosticCase.id,
      source: "deepseek",
      status: "generated-draft",
      workingHypothesis: {
        ...generatedHypothesis,
        id: `hypothesis-${diagnosticCase.id}-${model.id}`,
        status: "unvalidated",
      },
    };
  },
  async runAgentTurn(input) {
    const apiKey = process.env.DEEPSEEK_API_KEY?.trim();

    if (!apiKey) {
      throw new ProviderUnavailableError("deepseek");
    }

    return runDeepSeekAgentTurn(apiKey, input);
  },
};
