import type { InvestigationModelId } from "../types";
import type { ToolExecutionResult } from "../tools/types";
import type { AgentTrace, AgentTraceEventType } from "./types";

type TraceLimits = AgentTrace["limits"];

export function createAgentTrace(
  diagnosticCaseId: string,
  modelId: InvestigationModelId,
  limits: TraceLimits,
): AgentTrace {
  return {
    id: `agent-trace-${diagnosticCaseId}-${modelId}`,
    diagnosticCaseId,
    modelId,
    persistence: "session-only",
    limits,
    events: [],
  };
}

export function appendTraceEvent(
  trace: AgentTrace,
  type: AgentTraceEventType,
  detail: string,
  options?: {
    toolName?: string;
    toolResult?: Pick<ToolExecutionResult, "status" | "message">;
  },
): void {
  trace.events.push({
    id: `${trace.id}-event-${trace.events.length + 1}`,
    type,
    detail,
    ...(options?.toolName ? { toolName: options.toolName } : {}),
    ...(options?.toolResult ? { toolResult: options.toolResult } : {}),
  });
}
