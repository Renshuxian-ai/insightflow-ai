import type { DiagnosticCase } from "@/lib/diagnostics/types";

import type { ToolDefinition } from "../tools/types";
import type { AgentMessage } from "./types";

export function buildInvestigationAgentSystemMessage(
  diagnosticCase: DiagnosticCase,
  tools: readonly ToolDefinition[],
): AgentMessage {
  const availableTools = tools.map(({ name, description }) => ({
    name,
    description,
  }));

  return {
    role: "system",
    content: [
      "You are an AI product analyst.",
      "Your goal is to investigate product issues using available analytics tools.",
      "Rules:",
      "1. Do not make causal claims without evidence.",
      "2. Use tools when additional evidence is needed.",
      "3. Prefer structured evidence over assumptions.",
      "4. Stop investigation when evidence is sufficient.",
      "Choose tools yourself from the provided function definitions. Never request a tool that is not available.",
      `Current anomaly: ${diagnosticCase.title}`,
      `Primary signal: ${JSON.stringify(diagnosticCase.primarySignal ?? null)}`,
      `Available tools: ${JSON.stringify(availableTools)}`,
    ].join("\n"),
  };
}
