import type { DiagnosticCase } from "@/lib/diagnostics/types";

import type { AgentMessage } from "../agent/types";
import type { ToolExecutionResult, ToolName } from "../tools/types";

export type LlmEvidenceEvaluation = {
  sufficient: boolean;
  reasoning: string;
  missingEvidence: string[];
};

export type LlmEvidenceEvaluatorInput = {
  diagnosticCase: DiagnosticCase;
  toolObservations: readonly ToolExecutionResult[];
  availableTools: readonly ToolName[];
};

export type LlmEvidenceEvaluator = (
  input: LlmEvidenceEvaluatorInput,
) => Promise<LlmEvidenceEvaluation>;

export class LlmEvidenceEvaluationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmEvidenceEvaluationError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readMissingEvidence(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 8) {
    throw new LlmEvidenceEvaluationError(
      "missingEvidence must be an array with at most 8 items.",
    );
  }

  return value.map((item) => {
    if (typeof item !== "string" || !item.trim() || item.length > 160) {
      throw new LlmEvidenceEvaluationError(
        "Each missingEvidence item must be a concise non-empty string.",
      );
    }

    return item.trim();
  });
}

export function parseLlmEvidenceEvaluation(
  value: unknown,
): LlmEvidenceEvaluation {
  if (!isRecord(value)) {
    throw new LlmEvidenceEvaluationError(
      "Evidence evaluation must be a JSON object.",
    );
  }

  if (typeof value.sufficient !== "boolean") {
    throw new LlmEvidenceEvaluationError("sufficient must be a boolean.");
  }

  if (
    typeof value.reasoning !== "string" ||
    !value.reasoning.trim() ||
    value.reasoning.length > 600
  ) {
    throw new LlmEvidenceEvaluationError(
      "reasoning must be a concise non-empty string.",
    );
  }

  return {
    sufficient: value.sufficient,
    reasoning: value.reasoning.trim(),
    missingEvidence: readMissingEvidence(value.missingEvidence),
  };
}

export function buildLlmEvidenceEvaluationMessages({
  diagnosticCase,
  toolObservations,
  availableTools,
}: LlmEvidenceEvaluatorInput): AgentMessage[] {
  const safeObservations = toolObservations.map((result) => ({
    toolName: result.toolName,
    status: result.status,
    summary: result.observation.summary,
    facts: result.observation.facts,
    limitations: result.observation.limitations,
  }));

  return [
    {
      role: "system",
      content: [
        "You evaluate whether aggregate product evidence is sufficient to draft a reliable investigation.",
        "Evidence does not establish causation. Do not invent facts or request unavailable tools.",
        "Return one JSON object and no Markdown.",
      ].join(" "),
    },
    {
      role: "user",
      content: [
        "Assess only the supplied primary signal and successful tool observations.",
        "Return this exact shape:",
        '{"sufficient":boolean,"reasoning":"concise string","missingEvidence":["concise evidence gap"]}',
        `Primary signal:\n${JSON.stringify(diagnosticCase.primarySignal ?? null)}`,
        `Available tools:\n${JSON.stringify(availableTools)}`,
        `Tool observations:\n${JSON.stringify(safeObservations)}`,
      ].join("\n\n"),
    },
  ];
}
