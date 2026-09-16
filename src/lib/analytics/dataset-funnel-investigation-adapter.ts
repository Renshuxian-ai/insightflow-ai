import type { DatasetAnalyticsContext } from "./dataset-context";
import type { AnalyticsFunnelInvestigationContext } from "./investigation-context";

function toSignalPart(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function buildDatasetFunnelInvestigationContexts(
  analyticsContext: DatasetAnalyticsContext,
): AnalyticsFunnelInvestigationContext[] {
  const evidence = analyticsContext.funnelEvidence;

  if (!evidence) {
    return [];
  }

  const availableTransitions = evidence.transitions.flatMap((transition) =>
    transition.completionRate === null || transition.dropOffUsers === null
      ? []
      : [{
          funnelName: transition.funnelName,
          fromStep: transition.fromStep,
          toStep: transition.toStep,
          completionRate: transition.completionRate,
          dropOffUsers: transition.dropOffUsers,
        }],
  );

  return evidence.transitions.flatMap((transition) => {
    const comparableVersions = transition.versions.filter(
      (version) => version.completionRate !== null,
    );
    const current = comparableVersions.at(-1);
    const baseline = comparableVersions.at(-2);

    if (
      !current ||
      !baseline ||
      current.completionRate === null ||
      baseline.completionRate === null ||
      transition.dropOffUsers === null
    ) {
      return [];
    }

    return [{
      surface: "funnel" as const,
      signalId: [
        "dataset",
        analyticsContext.datasetId,
        "funnel",
        toSignalPart(transition.funnelName),
        toSignalPart(transition.fromStep),
        toSignalPart(transition.toStep),
      ].join(":"),
      funnelName: transition.funnelName,
      funnelStepTransition: {
        from: {
          eventName: transition.fromStep,
          label: transition.fromStep,
        },
        to: {
          eventName: transition.toStep,
          label: transition.toStep,
        },
      },
      currentVersion: current.version,
      previousVersion: baseline.version,
      currentCompletionRate: current.completionRate,
      baselineCompletionRate: baseline.completionRate,
      gap: Number(
        (current.completionRate - baseline.completionRate).toFixed(2),
      ),
      dropOffUsers: transition.dropOffUsers,
      availableTransitions,
      datasetEvidence: {
        datasetId: analyticsContext.datasetId,
        source: "uploaded-dataset" as const,
        quality: "mixed" as const,
        method: "latest-version-vs-previous-version",
        limitations: [
          "Completion rates are observed averages for each uploaded version.",
          "Drop-off users are estimated from unique users and the aggregate completion rate.",
        ],
      },
    }];
  });
}

export function buildDatasetFunnelInvestigationContext(
  analyticsContext: DatasetAnalyticsContext,
): AnalyticsFunnelInvestigationContext | null {
  return buildDatasetFunnelInvestigationContexts(analyticsContext)
    .sort((left, right) => right.dropOffUsers - left.dropOffUsers)[0] ?? null;
}
