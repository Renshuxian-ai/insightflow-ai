import { getInvestigationResult } from "@/lib/investigations/mock-data";

import type { InvestigationProvider } from "../provider";

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
};
