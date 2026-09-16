import type { AnalyticsInvestigationContext } from "@/lib/analytics/investigation-context";

function toPart(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "unknown";
}

/**
 * Identifies one analytical problem inside a stable dataset content identity.
 * It deliberately excludes session IDs and generated DiagnosticCase IDs.
 */
export function buildAnalyticsSignalFingerprint(
  datasetIdentity: string,
  context: AnalyticsInvestigationContext,
) {
  const problemKey =
    context.surface === "retention"
      ? [
          context.selectedInterval ?? "unknown-interval",
          context.metricEvidence.window,
        ]
      : context.surface === "funnel"
        ? [
            context.funnelName ?? "unnamed-funnel",
            context.funnelStepTransition.from.eventName,
            context.funnelStepTransition.to.eventName,
            context.currentVersion,
            context.previousVersion,
          ]
        : context.surface === "feedback"
          ? [
              context.topic.name,
              String(context.topic.mentions),
              String(context.topic.change ?? "unavailable"),
            ]
          : [
              context.activity.currentPeriod,
              context.activity.previousPeriod,
              String(context.activity.currentValue),
              String(context.activity.baselineValue),
            ];

  const canonicalIdentity = [
    datasetIdentity,
    context.surface,
    ...problemKey.map(toPart),
  ].join("|");
  const digest = createHash("sha256")
    .update(canonicalIdentity)
    .digest("hex")
    .slice(0, 24);

  return `signal:${context.surface}:${digest}`;
}
import "server-only";

import { createHash } from "node:crypto";
