import { getInvestigationResult } from "@/lib/investigations/mock-data";
import type { DiagnosticCase } from "@/lib/diagnostics/types";

import type { AgentModelTurn, AgentToolCall } from "../agent/types";
import type { InvestigationProvider } from "../provider";

function getDeterministicToolCalls(
  diagnosticCase: DiagnosticCase,
  completedToolCalls: number,
): AgentToolCall[] {
  const feedbackSignal = diagnosticCase.evidence.feedbackSignals[0];

  if (completedToolCalls > 0) {
    return [
      {
        id: `tool-call-${diagnosticCase.id}-feedback`,
        name: "search_feedback",
        input: { feedbackSignalId: feedbackSignal.id },
      },
    ];
  }

  return [
    {
      id: `tool-call-${diagnosticCase.id}-metric`,
      name: "query_metric",
      input: { metricId: diagnosticCase.metric.id },
    },
    {
      id: `tool-call-${diagnosticCase.id}-segment`,
      name: "analyze_segment",
      input: { segmentId: diagnosticCase.context.segment.id },
    },
  ];
}

export const mockInvestigationProvider: InvestigationProvider = {
  id: "mock",
  isAvailable() {
    return true;
  },
  async generate({ diagnosticCase }) {
    const result = getInvestigationResult(diagnosticCase.id);

    if (!result) {
      throw new Error("No mock investigation is available for this DiagnosticCase.");
    }

    return result;
  },
  async runAgentTurn({ diagnosticCase, request }): Promise<AgentModelTurn> {
    if (request.phase === "tool-selection") {
      const completedToolCalls = request.messages.filter(
        (message) => message.role === "tool",
      ).length;
      const toolCalls = getDeterministicToolCalls(
        diagnosticCase,
        completedToolCalls,
      );

      return {
        kind: "tool-calls",
        message: {
          role: "assistant",
          content: null,
          toolCalls,
        },
        toolCalls,
      };
    }

    const result = getInvestigationResult(diagnosticCase.id);

    if (!result) {
      throw new Error("No mock investigation is available for this DiagnosticCase.");
    }

    return {
      kind: "final",
      message: {
        role: "assistant",
        content: "Mock investigation result generated from deterministic tool observations.",
        toolCalls: [],
      },
      output: result,
    };
  },
};
