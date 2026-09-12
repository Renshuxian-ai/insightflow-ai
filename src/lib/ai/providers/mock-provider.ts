import "server-only";

import type { AgentModelTurn } from "../agent/types";
import type { AIModelProvider } from "../provider";

export const mockModelProvider: AIModelProvider = {
  id: "mock",
  isAvailable() {
    return true;
  },
  async runAgentTurn({ request }): Promise<AgentModelTurn> {
    if (!request.prototypeTurn) {
      throw new Error("The Mock Provider requires a prototype model turn.");
    }

    return request.prototypeTurn;
  },
};
