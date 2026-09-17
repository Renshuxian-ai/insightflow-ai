import type { AnalyticsInvestigationSurface } from "@/lib/analytics/investigation-context";

import type { InvestigationSource } from "./mock-investigations";

export function getInvestigationSourceLabel(
  surface: AnalyticsInvestigationSurface,
): InvestigationSource {
  if (surface === "activity") {
    return "Trends Analytics";
  }

  if (surface === "funnel") {
    return "Funnel Analytics";
  }

  if (surface === "feedback") {
    return "Feedback Intelligence";
  }

  return "Retention Analytics";
}
