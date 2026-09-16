import "server-only";

import { feedbackAnalysisTool } from "./feedback-analysis-tool";
import { funnelAnalysisTool } from "./funnel-analysis-tool";
import { analyzeSegmentTool } from "./mock/analyze-segment";
import { queryMetricTool } from "./mock/query-metric";
import { searchFeedbackTool } from "./mock/search-feedback";
import { retentionAnalysisTool } from "./retention-analysis-tool";
import { segmentAnalysisTool } from "./segment-analysis-tool";
import type { ToolDefinition, ToolName } from "./types";

const toolRegistry: Record<ToolName, ToolDefinition> = {
  query_metric: queryMetricTool,
  analyze_segment: analyzeSegmentTool,
  search_feedback: searchFeedbackTool,
  retention_analysis: retentionAnalysisTool,
  funnel_analysis: funnelAnalysisTool,
  feedback_analysis: feedbackAnalysisTool,
  segment_analysis: segmentAnalysisTool,
};

const allowedToolNames = Object.freeze(
  Object.keys(toolRegistry) as ToolName[],
);
const defaultToolNames = Object.freeze([
  "query_metric",
  "analyze_segment",
  "search_feedback",
] as const satisfies readonly ToolName[]);

export function getAllowedTools(
  requestedToolNames: readonly ToolName[] = defaultToolNames,
): readonly ToolDefinition[] {
  return requestedToolNames.map((toolName) => toolRegistry[toolName]);
}

export function isAllowedToolName(value: string): value is ToolName {
  return allowedToolNames.includes(value as ToolName);
}

export function getToolDefinition(name: string): ToolDefinition | undefined {
  return isAllowedToolName(name) ? toolRegistry[name] : undefined;
}
