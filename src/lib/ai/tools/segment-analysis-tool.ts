import "server-only";

import type {
  AnalyticsTool,
  ToolInput,
  ToolInputValidationResult,
  ToolObservation,
} from "./types";

function validateInput(input: unknown): ToolInputValidationResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { valid: false, message: "Segment input must be an object." };
  }

  const record = input as Record<string, unknown>;
  const allowedKeys = new Set(["dimension", "value"]);

  if (Object.keys(record).some((key) => !allowedKeys.has(key))) {
    return { valid: false, message: "Segment input contains unsupported fields." };
  }

  if (typeof record.dimension !== "string" || !record.dimension.trim()) {
    return { valid: false, message: "A non-empty dimension is required." };
  }

  if (
    record.value !== undefined &&
    (typeof record.value !== "string" || !record.value.trim())
  ) {
    return { valid: false, message: "value must be a non-empty string." };
  }

  return {
    valid: true,
    value: Object.fromEntries(
      Object.entries(record).map(([key, value]) => [
        key,
        (value as string).trim(),
      ]),
    ),
  };
}

export const segmentAnalysisTool: AnalyticsTool = {
  name: "segment_analysis",
  description:
    "Inspect the affected segment and its measured difference using available evidence.",
  inputSchema: {
    type: "object",
    properties: {
      dimension: {
        type: "string",
        description: "The segment dimension from the primary signal.",
      },
      value: {
        type: "string",
        description: "Optional segment value from the primary signal.",
      },
    },
    required: ["dimension"],
    additionalProperties: false,
  },
  validateInput,
  async execute(input: ToolInput, context): Promise<ToolObservation> {
    if (
      context.executionScope === "analytics-dataset" &&
      context.datasetAnalyticsContext
    ) {
      const primarySignal = context.diagnosticCase.primarySignal;
      const sourceSignal = context.diagnosticCase.evidence.behaviorSignals[0];
      const metricId = context.diagnosticCase.metric.id;

      if (metricId.startsWith("retention-")) {
        const comparison =
          context.datasetAnalyticsContext.retentionEvidence?.comparison;

        if (!comparison || !primarySignal) {
          throw new Error("Dataset retention scope evidence is unavailable.");
        }

        return {
          summary: `${primarySignal.segment} contains ${primarySignal.affectedUsers} users and differs from ${primarySignal.baselineValue}% to ${primarySignal.currentValue}% (${primarySignal.gap > 0 ? "+" : ""}${primarySignal.gap} pp) in uploaded dataset evidence.`,
          facts: {
            dimension: input.dimension,
            segment: input.value ?? primarySignal.segment,
            metricDifference: primarySignal.gap,
            currentValue: primarySignal.currentValue,
            baselineValue: primarySignal.baselineValue,
            affectedUsers: primarySignal.affectedUsers,
            currentWindow: `${comparison.current.start} to ${comparison.current.end}`,
            baselineWindow: `${comparison.baseline.start} to ${comparison.baseline.end}`,
            evidenceSource: "uploaded-dataset",
            evidenceQuality: comparison.evidenceQuality,
          },
          sourceReferences: [
            { sourceType: "behavior-signal", sourceId: sourceSignal.id },
          ],
          limitations: [
            "The available scope comparison is an estimated time-window segment, not a demographic user segment.",
          ],
        };
      }

      if (metricId === "funnel-conversion") {
        const transition =
          context.datasetAnalyticsContext.funnelEvidence?.transitions.find(
            (candidate) =>
              primarySignal?.interval.includes(candidate.fromStep) &&
              primarySignal.interval.includes(candidate.toStep),
          ) ?? context.datasetAnalyticsContext.funnelEvidence?.transitions[0];

        if (!transition || !primarySignal) {
          throw new Error("Dataset funnel scope evidence is unavailable.");
        }

        const comparableVersions = transition.versions.filter(
          (version) => version.completionRate !== null,
        );

        return {
          summary: `${transition.fromStep} to ${transition.toStep} is the measured funnel scope with ${primarySignal.affectedUsers} affected users in uploaded dataset evidence.`,
          facts: {
            dimension: input.dimension,
            segment: input.value ?? primarySignal.segment,
            metricDifference: primarySignal.gap,
            completionRate: transition.completionRate ?? "unavailable",
            affectedUsers: primarySignal.affectedUsers,
            comparedVersions: comparableVersions.map(
              (version) => `${version.version}:${version.completionRate}%`,
            ),
            evidenceSource: "uploaded-dataset",
          },
          sourceReferences: [
            { sourceType: "behavior-signal", sourceId: sourceSignal.id },
          ],
          limitations: [
            "The available scope is the measured funnel transition; no independent demographic segment breakdown is available.",
          ],
        };
      }

      throw new Error(
        "The uploaded DatasetAnalyticsContext does not contain segment-level evidence for this surface.",
      );
    }

    const primarySignal = context.diagnosticCase.primarySignal;
    const segment =
      input.value ?? primarySignal?.segment ?? context.diagnosticCase.context.segment.label;
    const metricDifference =
      primarySignal?.gap ?? context.diagnosticCase.metric.changeValue;
    const evidence = context.diagnosticCase.evidence.behaviorSignals
      .filter((signal) => {
        const searchable = `${signal.id} ${signal.label} ${signal.source}`
          .toLocaleLowerCase("en-US");

        return (
          searchable.includes("segment") ||
          searchable.includes(segment.toLocaleLowerCase("en-US"))
        );
      })
      .map((signal) => signal.finding);
    const isFunnelStep = input.dimension
      .toLocaleLowerCase("en-US")
      .includes("funnel");
    const sourceSignal =
      (isFunnelStep
        ? context.diagnosticCase.evidence.behaviorSignals.find((signal) =>
            signal.id.includes("transition-comparison"),
          )
        : context.diagnosticCase.evidence.behaviorSignals.find((signal) =>
            `${signal.id} ${signal.label}`
              .toLocaleLowerCase("en-US")
              .includes(segment.toLocaleLowerCase("en-US")),
          )) ?? context.diagnosticCase.evidence.behaviorSignals[0];

    return {
      summary: `${segment} differs by ${metricDifference > 0 ? "+" : ""}${metricDifference} for ${input.dimension}.`,
      facts: {
        segment,
        metricDifference,
        evidence,
      },
      sourceReferences: [
        {
          sourceType: "behavior-signal",
          sourceId: sourceSignal.id,
        },
      ],
      limitations: [
        "This read-only segment comparison uses aggregate demo evidence and cannot identify a cause.",
      ],
    };
  },
};
