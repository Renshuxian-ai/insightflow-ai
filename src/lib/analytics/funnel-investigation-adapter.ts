import type { DemoAnalyticsResult } from "./demo-analytics";
import type { AnalyticsFunnelInvestigationContext } from "./investigation-context";

type Funnel = DemoAnalyticsResult["funnel"];
type FunnelStage = Funnel["stages"][number];

type FunnelInvestigationAdapterInput = {
  funnel: Funnel;
  stage: FunnelStage;
};

function toSignalPart(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function buildFunnelInvestigationContext({
  funnel,
  stage,
}: FunnelInvestigationAdapterInput): AnalyticsFunnelInvestigationContext | null {
  const stageIndex = funnel.stages.findIndex(
    (candidate) => candidate.eventName === stage.eventName,
  );
  const previousStage =
    stageIndex > 0 ? funnel.stages[stageIndex - 1] ?? null : null;

  if (!previousStage) {
    return null;
  }

  return {
    surface: "funnel",
    signalId: [
      "funnel",
      toSignalPart(funnel.currentVersion),
      toSignalPart(previousStage.eventName),
      toSignalPart(stage.eventName),
    ].join(":"),
    funnelStepTransition: {
      from: {
        eventName: previousStage.eventName,
        label: previousStage.label,
      },
      to: {
        eventName: stage.eventName,
        label: stage.label,
      },
    },
    currentVersion: funnel.currentVersion,
    previousVersion: funnel.previousVersion,
    currentCompletionRate: stage.currentCompletionRate,
    baselineCompletionRate: stage.previousCompletionRate,
    gap: stage.currentCompletionRate - stage.previousCompletionRate,
    dropOffUsers: stage.dropOffUsers,
  };
}
