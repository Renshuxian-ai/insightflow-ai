import "server-only";

import { parseDatasetDiagnosticCase } from "@/lib/diagnostics/server/dataset-diagnostic-case-schema";
import { buildOverviewActivityEvidence } from "@/lib/overview/overview-activity-builder";

import { createAnalyticsDiagnosticCase } from "./analytics-diagnostic-adapter";
import { parseAnalyticsInvestigationContext } from "./analytics-context-parser";
import { buildTrendRuntime } from "./build-trend-runtime";
import { buildFixtureDatasetAnalyticsContext } from "./dataset-context/dataset-analytics-context.fixtures";
import {
  buildDatasetFeedbackInvestigationContext,
  buildDatasetFeedbackInvestigationContexts,
} from "./dataset-feedback-investigation-adapter";
import {
  buildDatasetFunnelInvestigationContext,
  buildDatasetFunnelInvestigationContexts,
} from "./dataset-funnel-investigation-adapter";
import { buildDatasetRetentionInvestigationContext } from "./dataset-retention-investigation-adapter";
import { runDatasetDiagnosticIdentityFixtures } from "@/lib/investigations/dataset-diagnostic-identity.fixtures";

function assertFixture(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Dataset investigation adapter fixture failed: ${message}`);
  }
}

export async function runDatasetInvestigationAdapterFixtures() {
  const identityFixtures = await runDatasetDiagnosticIdentityFixtures();
  const datasetContext = await buildFixtureDatasetAnalyticsContext();
  const retentionContext = buildDatasetRetentionInvestigationContext(
    datasetContext,
  );
  const funnelContext = buildDatasetFunnelInvestigationContext(datasetContext);
  const feedbackContext = buildDatasetFeedbackInvestigationContext(
    datasetContext,
  );
  const feedbackContexts = buildDatasetFeedbackInvestigationContexts(
    datasetContext,
  );
  const trendRuntime = buildTrendRuntime({
    analyticsContext: datasetContext,
    activityEvidence: buildOverviewActivityEvidence({
      datasetId: datasetContext.datasetId,
      dataset: datasetContext.fixture.dataset,
      semanticSchema: datasetContext.fixture.semanticSchema,
    }),
  });

  assertFixture(
    retentionContext &&
      retentionContext.datasetEvidence?.quality === "estimated" &&
      retentionContext.metricEvidence.intervals.length === 3 &&
      retentionContext.metricEvidence.intervals.every(
        (interval) =>
          Math.abs(
            interval.currentRate -
              interval.baselineRate -
              interval.gapPercentagePoints,
          ) < 0.001,
      ),
    "retention must expose consistent estimated current, baseline, and gap evidence.",
  );
  assertFixture(
    parseAnalyticsInvestigationContext(JSON.stringify(retentionContext))
      ?.surface === "retention",
    "the dataset retention result must satisfy the Analytics context parser.",
  );

  assertFixture(
    funnelContext?.funnelName === "Activation Funnel" &&
      funnelContext.currentVersion === "V3.2" &&
      funnelContext.previousVersion === "V3.1" &&
      funnelContext.gap < 0 &&
      funnelContext.availableTransitions?.length === 1,
    "funnel must use real funnel, version, completion, and drop-off evidence.",
  );
  assertFixture(
    parseAnalyticsInvestigationContext(JSON.stringify(funnelContext))
      ?.surface === "funnel",
    "the dataset funnel result must satisfy the Analytics context parser.",
  );

  const sourceTransition = datasetContext.funnelEvidence?.transitions[0];
  const funnelEvidence = datasetContext.funnelEvidence;

  assertFixture(
    sourceTransition && funnelEvidence,
    "the CSV funnel transition must exist.",
  );

  const multipleTransitionContexts = buildDatasetFunnelInvestigationContexts({
    ...datasetContext,
    funnelEvidence: {
      ...funnelEvidence,
      transitions: [
        sourceTransition,
        {
          ...sourceTransition,
          fromStep: "complete_step1",
          toStep: "complete_step2",
        },
      ],
    },
  });

  assertFixture(
    multipleTransitionContexts.length === 2 &&
      multipleTransitionContexts.every(
        (context) => context.availableTransitions?.length === 2,
      ),
    "the funnel adapter must retain multiple available transitions.",
  );

  assertFixture(
    feedbackContext?.topic.name === "Pricing" &&
      feedbackContext.topic.mentions === 876 &&
      feedbackContext.topic.sentiment === "negative" &&
      feedbackContext.topic.trendStatus === "available" &&
      feedbackContext.topic.change !== null &&
      feedbackContext.evidenceQuotes.length >= 1 &&
      feedbackContext.relatedSignal === null,
    "feedback must preserve topic, mention, sentiment, quote, and honest trend evidence without inventing a related signal.",
  );
  assertFixture(
    parseAnalyticsInvestigationContext(JSON.stringify(feedbackContext))
      ?.surface === "feedback",
    "the dataset feedback result must satisfy the Analytics context parser.",
  );
  assertFixture(
    feedbackContexts.some(
      (context) =>
        context.topic.name === "Pricing" && context.topic.change !== null,
    ),
    "each comparable negative or mixed topic must expose its own Dataset investigation context.",
  );
  assertFixture(
    trendRuntime.status === "available" &&
      trendRuntime.signals
        .filter((signal) => signal.metricId !== "activity-dau")
        .every((signal) => signal.investigationContext?.datasetEvidence),
    "each supported Dataset retention, funnel, and feedback signal must carry Dataset-backed investigation context.",
  );

  const retentionDiagnosticCase = parseDatasetDiagnosticCase(
    createAnalyticsDiagnosticCase(retentionContext),
  );
  const funnelDiagnosticCase = parseDatasetDiagnosticCase(
    createAnalyticsDiagnosticCase(funnelContext),
  );
  const feedbackDiagnosticCase = parseDatasetDiagnosticCase(
    createAnalyticsDiagnosticCase(feedbackContext),
  );
  const retentionInterval = retentionContext.selectedInterval;
  const retentionIntervalEvidence = retentionContext.metricEvidence.intervals.find(
    (interval) => interval.interval === retentionInterval,
  );
  const retentionSegment = retentionContext.segmentEvidence;
  const segmentInterval =
    retentionInterval === "D1" ||
    retentionInterval === "D7" ||
    retentionInterval === "D30"
      ? retentionInterval
      : "D7";

  assertFixture(
    retentionInterval &&
      retentionIntervalEvidence &&
      retentionSegment &&
      retentionSegment.dimension !== "analysis window" &&
      retentionDiagnosticCase.title.includes(retentionSegment.segment) &&
      retentionDiagnosticCase.primarySignal?.currentValue ===
        retentionSegment.retention[segmentInterval] &&
      retentionDiagnosticCase.primarySignal.baselineValue ===
        retentionSegment.comparisonRetention[segmentInterval] &&
      retentionDiagnosticCase.evidence.behaviorSignals.some(
        (signal) => signal.id === "analytics-retention-segment-evidence",
      ) &&
      retentionDiagnosticCase.evidence.behaviorSignals.every((signal) =>
        signal.source.startsWith("Uploaded dataset"),
      ),
    "Retention signal must become a Dataset-backed DiagnosticCase anchored on the primary segment with interval evidence as supporting context.",
  );
  assertFixture(
    funnelDiagnosticCase.title.startsWith("Conversion dropped at ") &&
      funnelDiagnosticCase.primarySignal?.currentValue ===
        funnelContext.currentCompletionRate &&
      funnelDiagnosticCase.primarySignal.baselineValue ===
        funnelContext.baselineCompletionRate &&
      funnelDiagnosticCase.primarySignal.affectedUsers ===
        funnelContext.dropOffUsers &&
      funnelDiagnosticCase.evidence.behaviorSignals.every((signal) =>
        signal.source.startsWith("Uploaded dataset"),
      ),
    "Funnel signal must become a Dataset-backed DiagnosticCase with transition comparison and drop-off evidence.",
  );
  assertFixture(
    feedbackDiagnosticCase.title ===
      `Negative feedback increased for ${feedbackContext.topic.name}` &&
      feedbackDiagnosticCase.primarySignal?.currentValue ===
        feedbackContext.topic.mentions &&
      feedbackDiagnosticCase.metric.changeValue ===
        feedbackContext.topic.change &&
      feedbackDiagnosticCase.evidence.behaviorSignals.every((signal) =>
        signal.source.startsWith("Uploaded dataset"),
      ) &&
      feedbackDiagnosticCase.evidence.feedbackSignals.every((signal) =>
        signal.source.startsWith("Uploaded dataset"),
      ),
    "Feedback signal must become a Dataset-backed DiagnosticCase with topic, mention growth, sentiment, and quotes.",
  );

  const unavailableTrendContext = buildDatasetFeedbackInvestigationContext({
    ...datasetContext,
    feedbackEvidence: datasetContext.feedbackEvidence
      ? {
          ...datasetContext.feedbackEvidence,
          topics: datasetContext.feedbackEvidence.topics.map((topic) => ({
            ...topic,
            trend: null,
          })),
        }
      : null,
  });

  assertFixture(
    unavailableTrendContext?.topic.change === null &&
      unavailableTrendContext.topic.trendStatus === "unavailable" &&
      unavailableTrendContext.datasetEvidence?.limitations.some((limitation) =>
        limitation.includes("trend is unavailable"),
      ),
    "missing feedback trend must be explicit rather than represented as zero.",
  );

  return {
    retention: retentionContext,
    funnel: funnelContext,
    feedback: feedbackContext,
    diagnosticCases: {
      retention: retentionDiagnosticCase.title,
      funnel: funnelDiagnosticCase.title,
      feedback: feedbackDiagnosticCase.title,
    },
    multiTransitionCount: multipleTransitionContexts.length,
    unavailableTrendStatus: unavailableTrendContext?.topic.trendStatus,
    datasetSignalCount:
      trendRuntime.status === "available"
        ? trendRuntime.signals.filter((signal) => signal.investigationContext)
            .length
        : 0,
    identityFixtures,
  };
}
