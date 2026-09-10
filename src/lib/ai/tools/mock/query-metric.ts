import "server-only";

import type {
  ToolDefinition,
  ToolInput,
  ToolInputValidationResult,
} from "../types";

function validateMetricInput(
  input: unknown,
  metricId: string,
): ToolInputValidationResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { valid: false, message: "Metric input must be an object." };
  }

  const record = input as Record<string, unknown>;

  if (Object.keys(record).length !== 1 || typeof record.metricId !== "string") {
    return { valid: false, message: "Provide only the metricId for this case." };
  }

  if (record.metricId !== metricId) {
    return { valid: false, message: "The requested metric is outside this DiagnosticCase." };
  }

  return { valid: true, value: { metricId: record.metricId } };
}

export const queryMetricTool: ToolDefinition = {
  name: "query_metric",
  description: "Read the current case metric and its previous-period comparison.",
  inputSchema: {
    type: "object",
    properties: {
      metricId: {
        type: "string",
        description: "The metric ID from the current DiagnosticCase.",
      },
    },
    required: ["metricId"],
    additionalProperties: false,
  },
  validateInput(input, context) {
    return validateMetricInput(input, context.diagnosticCase.metric.id);
  },
  async execute(_input: ToolInput, context) {
    const { metric } = context.diagnosticCase;

    return {
      summary: `${metric.label} is ${metric.currentValue} ${metric.comparison}.`,
      facts: {
        metricId: metric.id,
        label: metric.label,
        currentValue: metric.currentValue,
        ...(metric.previousValue ? { previousValue: metric.previousValue } : {}),
        changeValue: metric.changeValue,
        ...(metric.changeType ? { changeType: metric.changeType } : {}),
        comparison: metric.comparison,
      },
      sourceReferences: [
        {
          sourceType: "metric",
          sourceId: metric.id,
        },
      ],
      limitations: [
        "This mock tool reads the metric already present in the DiagnosticCase.",
      ],
    };
  },
};
