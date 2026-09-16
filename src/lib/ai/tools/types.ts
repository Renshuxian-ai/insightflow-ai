import type { DiagnosticCase } from "@/lib/diagnostics/types";
import type { DatasetAnalyticsContext } from "@/lib/analytics/dataset-context";

export type ToolName =
  | "query_metric"
  | "analyze_segment"
  | "search_feedback"
  | "retention_analysis"
  | "funnel_analysis"
  | "feedback_analysis"
  | "segment_analysis";

export type ToolInput = Record<string, string>;

export type ToolInputSchema = {
  type: "object";
  properties: Record<string, { type: "string"; description: string }>;
  required: string[];
  additionalProperties: false;
};

export type ToolExecutionContext = Readonly<{
  diagnosticCase: DiagnosticCase;
  executionScope?: "mock" | "retention-dataset" | "analytics-dataset";
  allowedToolNames?: readonly ToolName[];
  datasetAnalyticsContext?: DatasetAnalyticsContext;
}>;

export type ToolSourceReference = {
  sourceType: "metric" | "context" | "behavior-signal" | "feedback-signal";
  sourceId: string;
};

export type ToolObservation = {
  summary: string;
  facts: Record<string, string | number | string[]>;
  sourceReferences: ToolSourceReference[];
  limitations: string[];
};

export type ToolExecutionResult = {
  toolName: string;
  status: "success" | "rejected" | "error";
  observation: ToolObservation;
  message: string | null;
};

export type ToolInputValidationResult =
  | { valid: true; value: ToolInput }
  | { valid: false; message: string };

export type ToolDefinition = {
  name: ToolName;
  description: string;
  inputSchema: ToolInputSchema;
  validateInput: (
    input: unknown,
    context: ToolExecutionContext,
  ) => ToolInputValidationResult;
  execute: (
    input: ToolInput,
    context: ToolExecutionContext,
  ) => Promise<ToolObservation>;
};

export type AnalyticsTool = ToolDefinition;

export type ToolRequest = {
  name: string;
  input: unknown;
};
