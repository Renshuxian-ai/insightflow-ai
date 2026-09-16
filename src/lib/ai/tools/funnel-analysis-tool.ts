import "server-only";

import type {
  AnalyticsTool,
  ToolInput,
  ToolInputValidationResult,
  ToolObservation,
} from "./types";

function validateInput(input: unknown): ToolInputValidationResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { valid: false, message: "Funnel input must be an object." };
  }

  const record = input as Record<string, unknown>;
  const allowedKeys = new Set(["funnelId", "step"]);

  if (Object.keys(record).some((key) => !allowedKeys.has(key))) {
    return { valid: false, message: "Funnel input contains unsupported fields." };
  }

  for (const key of ["funnelId", "step"] as const) {
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

export const funnelAnalysisTool: AnalyticsTool = {
  name: "funnel_analysis",
  description:
    "Inspect the selected funnel transition, completion rate, drop-off rate, and affected users.",
  inputSchema: {
    type: "object",
    properties: {
      funnelId: {
        type: "string",
        description: "Optional funnel or case ID to inspect.",
      },
      step: {
        type: "string",
        description: "Optional funnel step or transition from the current case.",
      },
    },
    required: [],
    additionalProperties: false,
  },
  validateInput,
  async execute(input: ToolInput, context): Promise<ToolObservation> {
    const datasetFunnel = context.datasetAnalyticsContext?.funnelEvidence;

    if (context.executionScope === "analytics-dataset" && datasetFunnel) {
      const requestedStep = input.step?.toLocaleLowerCase("en-US");
      const transition = datasetFunnel.transitions.find((candidate) => {
        const label = `${candidate.fromStep} ${candidate.toStep}`
          .toLocaleLowerCase("en-US");

        return !requestedStep || label.includes(requestedStep) ||
          requestedStep.includes(candidate.toStep.toLocaleLowerCase("en-US"));
      }) ?? datasetFunnel.transitions[0];

      if (
        !transition ||
        transition.completionRate === null ||
        transition.dropOffUsers === null
      ) {
        throw new Error("Dataset funnel transition evidence is unavailable.");
      }

      const versions = transition.versions.filter(
        (version) => version.completionRate !== null,
      );
      const currentVersion = versions.at(-1);
      const baselineVersion = versions.at(-2);
      const sourceSignal = context.diagnosticCase.evidence.behaviorSignals[0];
      const stepTransition = `${transition.fromStep} → ${transition.toStep}`;

      return {
        summary: `${stepTransition} completes at ${transition.completionRate}% with an estimated ${transition.dropOffUsers} users dropping off in uploaded dataset evidence.`,
        facts: {
          funnelName: transition.funnelName,
          stepTransition,
          completionRate: transition.completionRate,
          dropOffRate: Number((100 - transition.completionRate).toFixed(2)),
          affectedUsers: transition.dropOffUsers,
          currentVersion: currentVersion?.version ?? "unavailable",
          currentVersionRate: currentVersion?.completionRate ?? "unavailable",
          baselineVersion: baselineVersion?.version ?? "unavailable",
          baselineVersionRate: baselineVersion?.completionRate ?? "unavailable",
          baselineAvailable:
            currentVersion && baselineVersion ? "true" : "false",
          evidenceSource: "uploaded-dataset",
        },
        sourceReferences: [
          {
            sourceType: "behavior-signal",
            sourceId: sourceSignal.id,
          },
        ],
        limitations: [
          "Drop-off users are estimated from unique users and aggregate completion rate.",
          ...(currentVersion && baselineVersion
            ? []
            : ["A comparable version baseline is unavailable."]),
        ],
      };
    }

    const primarySignal = context.diagnosticCase.primarySignal;
    const stepTransition =
      input.step ??
      primarySignal?.interval ??
      context.diagnosticCase.context.segment.label;
    const completionRate = primarySignal?.currentValue ?? 0;
    const dropOffRate = Math.max(100 - completionRate, 0);
    const affectedUsers = primarySignal?.affectedUsers ?? 0;
    const evidence = context.diagnosticCase.evidence.behaviorSignals
      .filter((signal) =>
        `${signal.id} ${signal.source}`
          .toLocaleLowerCase("en-US")
          .includes("funnel"),
      )
      .map((signal) => signal.finding);
    const sourceSignal =
      context.diagnosticCase.evidence.behaviorSignals.find((signal) =>
        signal.id.includes("primary-dropoff"),
      ) ?? context.diagnosticCase.evidence.behaviorSignals[0];

    return {
      summary: `${stepTransition} completes at ${completionRate}%, with ${affectedUsers} affected users in the demo funnel evidence.`,
      facts: {
        stepTransition,
        completionRate,
        dropOffRate,
        affectedUsers,
        evidence,
      },
      sourceReferences: [
        {
          sourceType: "behavior-signal",
          sourceId: sourceSignal.id,
        },
      ],
      limitations: [
        "This read-only tool uses aggregate demo funnel evidence and does not establish causation.",
      ],
    };
  },
};
