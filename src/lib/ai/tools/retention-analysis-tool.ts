import "server-only";

import { retentionDemoData } from "@/lib/analytics/retention-demo-data";

import type {
  AnalyticsTool,
  ToolInput,
  ToolInputValidationResult,
  ToolObservation,
} from "./types";

function validateInput(input: unknown): ToolInputValidationResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { valid: false, message: "Retention input must be an object." };
  }

  const record = input as Record<string, unknown>;
  const allowedKeys = new Set(["metric", "segment", "period"]);

  if (Object.keys(record).some((key) => !allowedKeys.has(key))) {
    return {
      valid: false,
      message: "Retention input contains unsupported fields.",
    };
  }

  if (typeof record.metric !== "string" || !record.metric.trim()) {
    return { valid: false, message: "A non-empty metric is required." };
  }

  for (const key of ["segment", "period"] as const) {
    if (
      record[key] !== undefined &&
      (typeof record[key] !== "string" || !record[key].trim())
    ) {
      return { valid: false, message: `${key} must be a non-empty string.` };
    }
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

function getDemoInterval(period: string | undefined) {
  const dayMatch = period?.match(/D(\d+)/i);
  const day = dayMatch ? Number(dayMatch[1]) : 1;
  const currentCohort = retentionDemoData.cohorts.find(
    (cohort) => cohort.date === retentionDemoData.summary.currentCohort,
  );

  return {
    current: currentCohort?.intervals.find((interval) => interval.day === day),
    baseline: retentionDemoData.baselineIntervals.find(
      (interval) => interval.day === day,
    ),
  };
}

export const retentionAnalysisTool: AnalyticsTool = {
  name: "retention_analysis",
  description:
    "Read retention values, their baseline gap, and available scope evidence for the current case.",
  inputSchema: {
    type: "object",
    properties: {
      metric: {
        type: "string",
        description: "The retention metric or interval to inspect.",
      },
      segment: {
        type: "string",
        description: "Optional affected segment from the current case.",
      },
      period: {
        type: "string",
        description: "Optional retention interval such as D1 or D7.",
      },
    },
    required: ["metric"],
    additionalProperties: false,
  },
  validateInput,
  async execute(input: ToolInput, context): Promise<ToolObservation> {
    const datasetRetention = context.datasetAnalyticsContext?.retentionEvidence;

    if (context.executionScope === "analytics-dataset" && datasetRetention) {
      const comparison = datasetRetention.comparison;
      const requestedInterval =
        input.period ?? context.diagnosticCase.primarySignal?.interval ?? "D1";
      const current = comparison?.current.intervals.find(
        (interval) => interval.interval.toLocaleLowerCase("en-US") ===
          requestedInterval.toLocaleLowerCase("en-US"),
      );
      const baseline = comparison?.baseline.intervals.find(
        (interval) => interval.day === current?.day,
      );

      if (!comparison || !current || !baseline) {
        throw new Error("Dataset retention comparison is unavailable.");
      }

      const gap = Number(
        (current.retentionRate - baseline.retentionRate).toFixed(2),
      );
      const sourceSignal = context.diagnosticCase.evidence.behaviorSignals[0];

      return {
        summary: `${current.interval} retention is ${current.retentionRate}% in the current uploaded-data window versus ${baseline.retentionRate}% in the baseline window (${gap > 0 ? "+" : ""}${gap} pp).`,
        facts: {
          metric: input.metric,
          interval: current.interval,
          currentValue: current.retentionRate,
          baselineValue: baseline.retentionRate,
          gap,
          currentUsers: current.users,
          baselineUsers: baseline.users,
          evidenceSource: "uploaded-dataset",
          evidenceQuality: comparison.evidenceQuality,
        },
        sourceReferences: [
          {
            sourceType: "behavior-signal",
            sourceId: sourceSignal.id,
          },
        ],
        limitations: [
          "Current and baseline use adjacent estimated time windows from the uploaded dataset.",
          "Retained-user counts are estimated from unique users and aggregate retention rate.",
        ],
      };
    }

    const primarySignal = context.diagnosticCase.primarySignal;
    const demoInterval = getDemoInterval(input.period);
    const isRetentionSignal = Boolean(
      primarySignal?.metric.toLocaleLowerCase("en-US").includes("retention"),
    );
    const currentValue = isRetentionSignal && primarySignal
      ? primarySignal.currentValue
      : (demoInterval.current?.rate ?? retentionDemoData.summary.currentRetention);
    const baselineValue = isRetentionSignal && primarySignal
      ? primarySignal.baselineValue
      : (demoInterval.baseline?.rate ??
        retentionDemoData.summary.previousRetention);
    const gap = isRetentionSignal && primarySignal
      ? primarySignal.gap
      : currentValue - baselineValue;
    const affectedSegment =
      input.segment ?? primarySignal?.segment ?? context.diagnosticCase.context.segment.label;
    const evidence = context.diagnosticCase.evidence.behaviorSignals
      .filter((signal) =>
        `${signal.id} ${signal.label}`
          .toLocaleLowerCase("en-US")
          .includes("retention"),
      )
      .map((signal) => signal.finding);

    if (evidence.length === 0 && demoInterval.current && demoInterval.baseline) {
      evidence.push(
        `${input.period ?? "D1"} retention is ${demoInterval.current.rate}% versus the ${demoInterval.baseline.rate}% demo baseline.`,
      );
    }
    const relatedSignal = context.diagnosticCase.evidence.behaviorSignals.find(
      (signal) => signal.id.includes("related-signal"),
    );
    const retentionSignal = context.diagnosticCase.evidence.behaviorSignals.find(
      (signal) =>
        `${signal.id} ${signal.label}`
          .toLocaleLowerCase("en-US")
          .includes("retention"),
    );
    const sourceSignal = relatedSignal ?? retentionSignal;

    return {
      summary: `${input.metric} is ${currentValue}% versus ${baselineValue}% (${gap > 0 ? "+" : ""}${gap} pp) for ${affectedSegment}.`,
      facts: {
        metric: input.metric,
        currentValue,
        baselineValue,
        gap,
        affectedSegment,
        evidence,
      },
      sourceReferences: sourceSignal
        ? [{ sourceType: "behavior-signal", sourceId: sourceSignal.id }]
        : [
            {
              sourceType: "metric",
              sourceId: context.diagnosticCase.metric.id,
            },
          ],
      limitations: [
        "This read-only tool uses the current DiagnosticCase and demo retention data.",
      ],
    };
  },
};
