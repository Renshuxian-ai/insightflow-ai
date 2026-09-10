import "server-only";

import { analyzeSegmentTool } from "./mock/analyze-segment";
import { queryMetricTool } from "./mock/query-metric";
import { searchFeedbackTool } from "./mock/search-feedback";
import type { ToolDefinition, ToolName } from "./types";

const toolRegistry: Record<ToolName, ToolDefinition> = {
  query_metric: queryMetricTool,
  analyze_segment: analyzeSegmentTool,
  search_feedback: searchFeedbackTool,
};

const allowedToolNames = Object.freeze(
  Object.keys(toolRegistry) as ToolName[],
);

export function getAllowedTools(): readonly ToolDefinition[] {
  return allowedToolNames.map((toolName) => toolRegistry[toolName]);
}

export function isAllowedToolName(value: string): value is ToolName {
  return allowedToolNames.includes(value as ToolName);
}

export function getToolDefinition(name: string): ToolDefinition | undefined {
  return isAllowedToolName(name) ? toolRegistry[name] : undefined;
}
