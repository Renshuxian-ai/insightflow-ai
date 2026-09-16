import { buildDatasetFeedbackEvidence } from "./feedback-builder";
import { buildDatasetFunnelEvidence } from "./funnel-builder";
import { buildDatasetRetentionEvidence } from "./retention-builder";
import type {
  DatasetAnalyticsBuilderInput,
  DatasetAnalyticsContext,
  DatasetAnalyticsSurface,
} from "./types";

function assertCompatibleInput(input: DatasetAnalyticsBuilderInput): void {
  if (!input.datasetId.trim()) {
    throw new Error("Dataset analytics requires a dataset ID.");
  }

  if (input.semanticSchema.status !== "confirmed") {
    throw new Error("Confirm the semantic schema before building Analytics context.");
  }

  if (input.semanticSchema.physicalSchema.datasetId !== input.datasetId) {
    throw new Error("The semantic schema belongs to a different dataset.");
  }

  if (input.semanticSchema.fields.length !== input.dataset.columns.length) {
    throw new Error("The semantic schema does not match the parsed dataset.");
  }

  for (const field of input.semanticSchema.fields) {
    const column = input.dataset.columns[field.fieldIndex];

    if (!column || column.originalName !== field.originalName) {
      throw new Error("The semantic schema field bindings are no longer current.");
    }
  }
}

export function buildDatasetAnalyticsContext(
  input: DatasetAnalyticsBuilderInput,
): DatasetAnalyticsContext {
  assertCompatibleInput(input);

  const retentionEvidence = buildDatasetRetentionEvidence(input);
  const funnelEvidence = buildDatasetFunnelEvidence(input);
  const feedbackEvidence = buildDatasetFeedbackEvidence(input);
  const availableSurfaces: DatasetAnalyticsSurface[] = [
    ...(retentionEvidence ? (["retention"] as const) : []),
    ...(funnelEvidence ? (["funnel"] as const) : []),
    ...(feedbackEvidence ? (["feedback"] as const) : []),
  ];

  return {
    datasetId: input.datasetId,
    source: "uploaded-dataset",
    availableSurfaces,
    retentionEvidence,
    funnelEvidence,
    feedbackEvidence,
  };
}

export { buildDatasetFeedbackEvidence } from "./feedback-builder";
export { buildDatasetFunnelEvidence } from "./funnel-builder";
export { buildDatasetRetentionEvidence } from "./retention-builder";
export type {
  DatasetAnalyticsBuilderInput,
  DatasetAnalyticsContext,
  DatasetAnalyticsFieldBinding,
  DatasetAnalyticsSurface,
  DatasetFeedbackEvidence,
  DatasetFeedbackSentiment,
  DatasetFeedbackTopicEvidence,
  DatasetFunnelEvidence,
  DatasetFunnelTransitionEvidence,
  DatasetFunnelVersionEvidence,
  DatasetRetentionEvidence,
  DatasetRetentionBreakdownDimensionEvidence,
  DatasetRetentionBreakdownSegmentEvidence,
  DatasetRetentionCohortEvidence,
  DatasetRetentionIntervalEvidence,
  DatasetRetentionWindowEvidence,
} from "./types";
