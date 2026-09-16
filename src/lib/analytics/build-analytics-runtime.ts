import { buildDatasetFeedbackInvestigationContexts } from "./dataset-feedback-investigation-adapter";
import { buildDatasetFunnelInvestigationContexts } from "./dataset-funnel-investigation-adapter";
import { buildDatasetRetentionInvestigationContext } from "./dataset-retention-investigation-adapter";
import { buildRetentionDiagnosis } from "./retention-diagnosis-builder";
import type { DatasetAnalyticsContext } from "./dataset-context";
import type {
  DatasetAnalyticsRuntime,
  FeedbackRuntime,
  FunnelRuntime,
  RetentionRuntime,
} from "./analytics-runtime";

function toId(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function buildFunnelRuntime(context: DatasetAnalyticsContext): FunnelRuntime {
  const evidence = context.funnelEvidence;

  if (!evidence) {
    return {
      status: "unavailable",
      reason: "Funnel transition evidence is unavailable for this dataset.",
    };
  }

  const investigationContexts = buildDatasetFunnelInvestigationContexts(context);
  const transitions = evidence.transitions.flatMap((transition) => {
    if (transition.completionRate === null || transition.dropOffUsers === null) {
      return [];
    }

    const comparableVersions = transition.versions.filter(
      (version) => version.completionRate !== null,
    );
    const currentVersion = comparableVersions.at(-1) ?? null;
    const baselineVersion = comparableVersions.at(-2) ?? null;
    const investigationContext =
      investigationContexts.find(
        (candidate) =>
          candidate.funnelName === transition.funnelName &&
          candidate.funnelStepTransition.from.label === transition.fromStep &&
          candidate.funnelStepTransition.to.label === transition.toStep,
      ) ?? null;

    return [{
      id: [
        toId(transition.funnelName),
        toId(transition.fromStep),
        toId(transition.toStep),
      ].join("-"),
      funnelName: transition.funnelName,
      fromStep: transition.fromStep,
      toStep: transition.toStep,
      eventNames: transition.eventNames,
      observedRows: transition.observedRows,
      users: transition.users,
      completionRate: transition.completionRate,
      dropOffUsers: transition.dropOffUsers,
      currentVersion:
        currentVersion?.completionRate === null || !currentVersion
          ? null
          : {
              name: currentVersion.version,
              users: currentVersion.users,
              completionRate: currentVersion.completionRate,
            },
      baselineVersion:
        baselineVersion?.completionRate === null || !baselineVersion
          ? null
          : {
              name: baselineVersion.version,
              users: baselineVersion.users,
              completionRate: baselineVersion.completionRate,
            },
      gapPercentagePoints:
        currentVersion?.completionRate !== null &&
        currentVersion?.completionRate !== undefined &&
        baselineVersion?.completionRate !== null &&
        baselineVersion?.completionRate !== undefined
          ? Number(
              (
                currentVersion.completionRate - baselineVersion.completionRate
              ).toFixed(2),
            )
          : null,
      investigationContext,
    }];
  });

  if (transitions.length === 0) {
    return {
      status: "unavailable",
      reason:
        "The uploaded dataset has funnel fields but no supported completion and drop-off evidence.",
    };
  }

  const primaryTransition = [...transitions].sort(
    (left, right) =>
      right.dropOffUsers - left.dropOffUsers ||
      left.completionRate - right.completionRate,
  )[0]!;

  return {
    status: "available",
    source: "uploaded-dataset",
    datasetId: context.datasetId,
    transitions,
    primaryTransitionId: primaryTransition.id,
  };
}

function buildRetentionRuntime(
  context: DatasetAnalyticsContext,
): RetentionRuntime {
  const evidence = context.retentionEvidence;
  const comparison = evidence?.comparison;

  if (!evidence || !comparison) {
    return {
      status: "unavailable",
      reason:
        "Comparable current and baseline retention windows are unavailable for this dataset.",
    };
  }

  const baselineByDay = new Map(
    comparison.baseline.intervals.map((interval) => [interval.day, interval]),
  );
  const intervals = comparison.current.intervals.flatMap((current) => {
    const baseline = baselineByDay.get(current.day);

    return baseline
      ? [{
          day: current.day,
          label: current.interval,
          currentRate: current.retentionRate,
          currentRetainedUsers: current.retainedUsers,
          baselineRate: baseline.retentionRate,
          baselineRetainedUsers: baseline.retainedUsers,
          gapPercentagePoints: Number(
            (current.retentionRate - baseline.retentionRate).toFixed(2),
          ),
        }]
      : [];
  });

  if (intervals.length === 0) {
    return {
      status: "unavailable",
      reason:
        "The uploaded dataset does not contain matching current and baseline retention intervals.",
    };
  }

  const primaryInterval = intervals.reduce((selected, interval) =>
    interval.gapPercentagePoints < selected.gapPercentagePoints
      ? interval
      : selected,
  );
  const cohorts = evidence.cohorts?.map((cohort) => ({
    id: cohort.id,
    date: cohort.date,
    users: cohort.users,
    intervals: cohort.intervals.map((interval) => ({
      day: interval.day,
      users: interval.retainedUsers,
      rate: interval.retentionRate,
    })),
  })) ?? null;
  const breakdowns = evidence.breakdowns?.map((dimension) => ({
    id: dimension.id,
    label: dimension.label,
    segments: dimension.segments.map((segment) => ({
      id: segment.id,
      label: segment.value,
      users: segment.users,
      intervals: segment.intervals.map((interval) => ({
        day: interval.day,
        users: interval.retainedUsers,
        rate: interval.retentionRate,
      })),
    })),
  })) ?? null;
  const diagnosis = breakdowns
    ? buildRetentionDiagnosis({ breakdowns })
    : null;

  return {
    status: "available",
    source: "uploaded-dataset",
    datasetId: context.datasetId,
    evidenceQuality: "estimated",
    definition: {
      metricField: evidence.fields.retentionMetric.originalName,
      retentionDayField: evidence.fields.retentionDay.originalName,
      dateField: evidence.fields.date.originalName,
      userIdentifierField: evidence.fields.userIdentifier.originalName,
      method: comparison.method,
    },
    currentWindow: {
      start: comparison.current.start,
      end: comparison.current.end,
      users: comparison.current.users,
    },
    baselineWindow: {
      start: comparison.baseline.start,
      end: comparison.baseline.end,
      users: comparison.baseline.users,
    },
    intervals,
    primaryInterval: primaryInterval.label,
    cohorts,
    breakdowns,
    diagnosis,
    investigationContext: buildDatasetRetentionInvestigationContext(context),
  };
}

function buildFeedbackRuntime(context: DatasetAnalyticsContext): FeedbackRuntime {
  const evidence = context.feedbackEvidence;

  if (!evidence || evidence.topics.length === 0) {
    return {
      status: "unavailable",
      reason: "Feedback topic evidence is unavailable for this dataset.",
    };
  }

  const negativeCount = evidence.topics.reduce(
    (sum, topic) => sum + (topic.sentimentCounts.negative ?? 0),
    0,
  );
  const investigationContexts = buildDatasetFeedbackInvestigationContexts(context);

  return {
    status: "available",
    source: "uploaded-dataset",
    datasetId: context.datasetId,
    totalFeedback: evidence.totalFeedback,
    negativeFeedbackRate:
      evidence.totalFeedback > 0
        ? Number(((negativeCount / evidence.totalFeedback) * 100).toFixed(1))
        : null,
    topics: evidence.topics.map((topic) => ({
      id: toId(topic.topic),
      title: topic.topic,
      mentionCount: topic.mentions,
      sentiment: topic.sentiment,
      sentimentCounts: topic.sentimentCounts,
      quotes: topic.quotes,
      trend: topic.trend
        ? {
            baselineMentions: topic.trend.baselineMentions,
            currentMentions: topic.trend.currentMentions,
            changePercent: topic.trend.changePercent,
          }
        : null,
      investigationContext:
        investigationContexts.find(
          (candidate) =>
            candidate.topic.name === topic.topic &&
            candidate.topic.change !== null,
        ) ?? null,
    })),
  };
}

export function buildDatasetAnalyticsRuntime(
  context: DatasetAnalyticsContext,
): DatasetAnalyticsRuntime {
  return {
    source: "uploaded-dataset",
    datasetId: context.datasetId,
    funnel: buildFunnelRuntime(context),
    retention: buildRetentionRuntime(context),
    feedback: buildFeedbackRuntime(context),
  };
}
