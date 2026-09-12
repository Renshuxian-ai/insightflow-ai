import type {
  ToolExecutionResult,
  ToolInputSchema,
  ToolName,
} from "../tools/types";

export type AgentMessage =
  | {
      role: "system" | "user";
      content: string;
    }
  | {
      role: "assistant";
      content: string | null;
      toolCalls: AgentToolCall[];
    }
  | {
      role: "tool";
      toolCallId: string;
      name: string;
      content: string;
    };

export type AgentToolCall = {
  id: string;
  name: string;
  input: unknown;
};

export type AgentTurnPhase = "tool-selection" | "final-generation";

export type ProviderToolDefinition = {
  name: ToolName;
  description: string;
  inputSchema: ToolInputSchema;
};

export type AgentProviderRequest = {
  phase: AgentTurnPhase;
  messages: AgentMessage[];
  tools: readonly ProviderToolDefinition[];
  prototypeTurn?: AgentModelTurn;
};

export type AgentModelTurn =
  | {
      kind: "tool-calls";
      message: Extract<AgentMessage, { role: "assistant" }>;
      toolCalls: AgentToolCall[];
    }
  | {
      kind: "final";
      message: Extract<AgentMessage, { role: "assistant" }>;
      output: unknown;
    };

export type AgentTraceEventType =
  | "model-request"
  | "tool-call"
  | "observation"
  | "final-generation";

export type AgentTraceEvent = {
  id: string;
  type: AgentTraceEventType;
  detail: string;
  toolName?: string;
  toolResult?: Pick<ToolExecutionResult, "status" | "message">;
};

export type AgentTrace = {
  id: string;
  diagnosticCaseId: string;
  modelId: string;
  persistence: "session-only";
  limits: {
    maxToolRounds: number;
    maxToolCalls: number;
  };
  events: AgentTraceEvent[];
};

export type BoundedInvestigationAgentResult = {
  output: unknown;
  trace: AgentTrace;
};
