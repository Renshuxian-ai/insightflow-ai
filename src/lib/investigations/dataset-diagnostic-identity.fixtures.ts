import "server-only";

import { createAnalyticsDiagnosticCase } from "@/lib/analytics/analytics-diagnostic-adapter";
import { buildFixtureDatasetAnalyticsContext } from "@/lib/analytics/dataset-context/dataset-analytics-context.fixtures";
import { buildDatasetFeedbackInvestigationContext } from "@/lib/analytics/dataset-feedback-investigation-adapter";
import { buildDatasetFunnelInvestigationContext } from "@/lib/analytics/dataset-funnel-investigation-adapter";
import { buildDatasetRetentionInvestigationContext } from "@/lib/analytics/dataset-retention-investigation-adapter";
import type {
  AnalyticsActivityInvestigationContext,
  AnalyticsInvestigationContext,
  AnalyticsRetentionInterval,
} from "@/lib/analytics/investigation-context";
import { buildDatasetSignalDiagnosticCaseId } from "@/lib/diagnostics/dataset-diagnostic-case";
import { parseDatasetDiagnosticCase } from "@/lib/diagnostics/server/dataset-diagnostic-case-schema";

import { buildAnalyticsSignalFingerprint } from "./signal-fingerprint";

function assertFixture(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Dataset DiagnosticCase identity fixture failed: ${message}`);
  }
}

function getIdentity(
  datasetIdentity: string,
  context: AnalyticsInvestigationContext,
) {
  const signalFingerprint = buildAnalyticsSignalFingerprint(
    datasetIdentity,
    context,
  );
  const diagnosticCaseId =
    buildDatasetSignalDiagnosticCaseId(signalFingerprint);
  const diagnosticCase = createAnalyticsDiagnosticCase(context, {
    diagnosticCaseId,
  });

  assertFixture(diagnosticCase, `${context.surface} case must be available.`);

  return {
    signalFingerprint,
    diagnosticCaseId: parseDatasetDiagnosticCase(diagnosticCase).id,
  };
}

export async function runDatasetDiagnosticIdentityFixtures() {
  const datasetContext = await buildFixtureDatasetAnalyticsContext();
  const datasetIdentity = "fixture-dataset-content-identity";
  const retention = buildDatasetRetentionInvestigationContext(datasetContext);
  const funnel = buildDatasetFunnelInvestigationContext(datasetContext);
  const feedback = buildDatasetFeedbackInvestigationContext(datasetContext);

  assertFixture(retention, "Retention context must be available.");
  assertFixture(funnel, "Funnel context must be available.");
  assertFixture(feedback, "Feedback context must be available.");

  const retentionIntervals: AnalyticsRetentionInterval[] = ["D1", "D7", "D30"];
  const getRetentionContext = (interval: AnalyticsRetentionInterval) => {
    assertFixture(
      retention.metricEvidence.intervals.some(
        (evidence) => evidence.interval === interval,
      ),
      `${interval} evidence must be available.`,
    );

    return {
      ...retention,
      signalId: `dataset:${datasetContext.datasetId}:retention:${interval.toLocaleLowerCase("en-US")}`,
      selectedInterval: interval,
      metricEvidence: {
        ...retention.metricEvidence,
        intervals: retention.metricEvidence.intervals.map((evidence) =>
          evidence.interval === interval
            ? {
                ...evidence,
                currentRate: Number(
                  Math.max(0, evidence.baselineRate - 1).toFixed(2),
                ),
                gapPercentagePoints: -1,
              }
            : evidence,
        ),
      },
    };
  };
  const retentionIdentities = retentionIntervals.map((interval) =>
    getIdentity(datasetIdentity, getRetentionContext(interval)),
  );
  const repeatedD7 = getIdentity(
    datasetIdentity,
    getRetentionContext("D7"),
  );

  assertFixture(
    new Set(retentionIdentities.map((identity) => identity.diagnosticCaseId))
      .size === retentionIdentities.length,
    "D1, D7, and D30 must have different DiagnosticCase IDs.",
  );
  assertFixture(
    repeatedD7.diagnosticCaseId === retentionIdentities[1].diagnosticCaseId &&
      repeatedD7.signalFingerprint ===
        retentionIdentities[1].signalFingerprint,
    "Repeated D7 selection must preserve both identities.",
  );

  const secondFunnel = {
    ...funnel,
    signalId: `dataset:${datasetContext.datasetId}:funnel:activation-funnel:complete-step1:complete-step2`,
    funnelStepTransition: {
      from: { eventName: "complete_step1", label: "Complete Step1" },
      to: { eventName: "complete_step2", label: "Complete Step2" },
    },
  };
  const funnelIdentities = [funnel, secondFunnel].map((context) =>
    getIdentity(datasetIdentity, context),
  );

  assertFixture(
    funnelIdentities[0].diagnosticCaseId !==
      funnelIdentities[1].diagnosticCaseId,
    "Different Funnel transitions must have different DiagnosticCase IDs.",
  );

  const secondFeedback = {
    ...feedback,
    signalId: `dataset:${datasetContext.datasetId}:feedback:onboarding-clarity`,
    topic: {
      ...feedback.topic,
      name: "Onboarding clarity",
    },
  };
  const feedbackIdentities = [feedback, secondFeedback].map((context) =>
    getIdentity(datasetIdentity, context),
  );

  assertFixture(
    feedbackIdentities[0].diagnosticCaseId !==
      feedbackIdentities[1].diagnosticCaseId,
    "Different Feedback topics must have different DiagnosticCase IDs.",
  );

  const activity: AnalyticsActivityInvestigationContext = {
    surface: "activity",
    signalId: `dataset:${datasetContext.datasetId}:activity:dau:2026-09-15`,
    activity: {
      metric: "daily_active_users",
      currentValue: 80,
      baselineValue: 100,
      gap: -20,
      currentPeriod: "2026-09-09 to 2026-09-15",
      previousPeriod: "2026-09-02 to 2026-09-08",
      affectedUsers: 80,
    },
    datasetEvidence: {
      datasetId: datasetContext.datasetId,
      source: "uploaded-dataset",
      quality: "observed",
      method: "fixture-window-comparison",
      limitations: [],
    },
  };
  const activityIdentity = getIdentity(datasetIdentity, activity);

  assertFixture(
    activityIdentity.diagnosticCaseId.startsWith("dataset-signal:activity:"),
    "Activity must use a signal-specific DiagnosticCase ID.",
  );

  return {
    retention: retentionIdentities,
    repeatedD7,
    funnel: funnelIdentities,
    feedback: feedbackIdentities,
    activity: activityIdentity,
  };
}
