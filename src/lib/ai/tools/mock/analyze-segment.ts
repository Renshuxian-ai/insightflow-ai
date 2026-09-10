import "server-only";

import type {
  ToolDefinition,
  ToolInput,
  ToolInputValidationResult,
} from "../types";

function validateSegmentInput(
  input: unknown,
  segmentId: string,
): ToolInputValidationResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { valid: false, message: "Segment input must be an object." };
  }

  const record = input as Record<string, unknown>;

  if (Object.keys(record).length !== 1 || typeof record.segmentId !== "string") {
    return { valid: false, message: "Provide only the segmentId for this case." };
  }

  if (record.segmentId !== segmentId) {
    return { valid: false, message: "The requested segment is outside this DiagnosticCase." };
  }

  return { valid: true, value: { segmentId: record.segmentId } };
}

export const analyzeSegmentTool: ToolDefinition = {
  name: "analyze_segment",
  description: "Read the affected segment context and linked behavior signals for this case.",
  inputSchema: {
    type: "object",
    properties: {
      segmentId: {
        type: "string",
        description: "The segment ID from the current DiagnosticCase.",
      },
    },
    required: ["segmentId"],
    additionalProperties: false,
  },
  validateInput(input, context) {
    return validateSegmentInput(input, context.diagnosticCase.context.segment.id);
  },
  async execute(_input: ToolInput, context) {
    const { context: caseContext, evidence } = context.diagnosticCase;

    return {
      summary: `The affected segment is ${caseContext.segment.label} on ${caseContext.platform.label} for ${caseContext.version.label}.`,
      facts: {
        segment: caseContext.segment.label,
        platform: caseContext.platform.label,
        version: caseContext.version.label,
        behaviorSignalIds: evidence.behaviorSignals.map((signal) => signal.id),
        behaviorFindings: evidence.behaviorSignals.map((signal) => signal.finding),
      },
      sourceReferences: [
        {
          sourceType: "context",
          sourceId: caseContext.segment.id,
        },
        {
          sourceType: "context",
          sourceId: caseContext.platform.id,
        },
        {
          sourceType: "context",
          sourceId: caseContext.version.id,
        },
        ...evidence.behaviorSignals.map((signal) => ({
          sourceType: "behavior-signal" as const,
          sourceId: signal.id,
        })),
      ],
      limitations: [
        "This mock tool only returns segment context and behavior signals already linked to the DiagnosticCase.",
      ],
    };
  },
};
