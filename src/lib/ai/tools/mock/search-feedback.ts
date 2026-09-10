import "server-only";

import type {
  ToolDefinition,
  ToolInput,
  ToolInputValidationResult,
} from "../types";

function validateFeedbackInput(
  input: unknown,
  feedbackSignalIds: string[],
): ToolInputValidationResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { valid: false, message: "Feedback input must be an object." };
  }

  const record = input as Record<string, unknown>;

  if (
    Object.keys(record).length !== 1 ||
    typeof record.feedbackSignalId !== "string"
  ) {
    return {
      valid: false,
      message: "Provide only a feedbackSignalId for this case.",
    };
  }

  if (!feedbackSignalIds.includes(record.feedbackSignalId)) {
    return {
      valid: false,
      message: "The requested feedback signal is outside this DiagnosticCase.",
    };
  }

  return {
    valid: true,
    value: { feedbackSignalId: record.feedbackSignalId },
  };
}

export const searchFeedbackTool: ToolDefinition = {
  name: "search_feedback",
  description: "Read a feedback topic and its linked mock feedback signals for this case.",
  inputSchema: {
    type: "object",
    properties: {
      feedbackSignalId: {
        type: "string",
        description: "A feedback signal ID from the current DiagnosticCase.",
      },
    },
    required: ["feedbackSignalId"],
    additionalProperties: false,
  },
  validateInput(input, context) {
    return validateFeedbackInput(
      input,
      context.diagnosticCase.evidence.feedbackSignals.map((signal) => signal.id),
    );
  },
  async execute(input: ToolInput, context) {
    const feedbackSignal = context.diagnosticCase.evidence.feedbackSignals.find(
      (signal) => signal.id === input.feedbackSignalId,
    );

    if (!feedbackSignal) {
      throw new Error("Validated feedback signal was not found.");
    }

    return {
      summary: `${feedbackSignal.topic} has ${feedbackSignal.mentionCount} mock mentions with ${feedbackSignal.sentiment.toLowerCase()} sentiment.`,
      facts: {
        topic: feedbackSignal.topic,
        mentionCount: feedbackSignal.mentionCount,
        change: feedbackSignal.change,
        sentiment: feedbackSignal.sentiment,
        finding: feedbackSignal.finding,
        snippets: feedbackSignal.snippets,
      },
      sourceReferences: [
        {
          sourceType: "feedback-signal",
          sourceId: feedbackSignal.id,
        },
      ],
      limitations: [
        "This mock tool reads feedback already linked to the DiagnosticCase and does not search an external feedback store.",
      ],
    };
  },
};
