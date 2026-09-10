import { buildInvestigationPrompt } from "../prompts";
import type { InvestigationProvider } from "../provider";
import { ProviderUnavailableError } from "../provider";

const deepSeekEndpoint = "https://api.deepseek.com/chat/completions";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readMessageContent(value: unknown): string {
  if (!isRecord(value) || !Array.isArray(value.choices)) {
    throw new Error("DeepSeek returned an invalid response envelope.");
  }

  const firstChoice = value.choices[0];

  if (!isRecord(firstChoice) || !isRecord(firstChoice.message)) {
    throw new Error("DeepSeek returned no message.");
  }

  const content = firstChoice.message.content;

  if (typeof content !== "string" || content.trim().length === 0) {
    throw new Error("DeepSeek returned empty content.");
  }

  return content;
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
    const response = await fetch(deepSeekEndpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model.providerModel,
        messages: [
          { role: "system", content: prompt.system },
          { role: "user", content: prompt.user },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_tokens: 3_000,
        stream: false,
      }),
      signal: AbortSignal.timeout(45_000),
    });

    if (!response.ok) {
      throw new Error(`DeepSeek request failed with status ${response.status}.`);
    }

    const responseBody: unknown = await response.json();
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
};
