import { DATASET_PRIMARY_ANOMALY_ID } from "../dataset-diagnostic-case";
import type {
  BehaviorSignal,
  DiagnosticCase,
  FeedbackSignal,
} from "../types";
import type {
  DemoDiagnosticDataset,
  DemoEventRow,
  DemoMetricRow,
  DemoReleaseRow,
} from "./types";

type MetricComparison = {
  current: DemoMetricRow;
  previous: DemoMetricRow;
  change: number;
};

type ReleaseComparison = {
  current: DemoReleaseRow;
  previous: DemoReleaseRow;
};

type FunnelEvidence = {
  currentEntryUsers: number;
  currentStepUsers: number;
  currentCompletionRate: number;
  previousEntryUsers: number;
  previousStepUsers: number;
  previousCompletionRate: number;
  stepName: string;
};

const D1_RETENTION_METRIC = "d1 retention";
const ONBOARDING_STEP_METRIC = "onboarding step3 completion";
const ONBOARDING_ENTRY_EVENT = "view_onboarding";

function normalized(value: string) {
  return value.trim().toLocaleLowerCase("en-US");
}

function formatPercentage(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatSignedPoints(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)} pp`;
}

function findMetricDecline(
  metrics: DemoMetricRow[],
  metricName: string,
  segment: string,
): MetricComparison {
  const matchingMetrics = metrics
    .filter(
      (metric) =>
        normalized(metric.metricName) === normalized(metricName) &&
        normalized(metric.segment) === normalized(segment),
    )
    .sort((left, right) => left.date.localeCompare(right.date));
  const current = matchingMetrics.at(-1);
  const previous = matchingMetrics.at(-2);

  if (!current || !previous) {
    throw new Error(
      `${metricName} requires two dated values in metrics.csv.`,
    );
  }

  const change = current.value - previous.value;

  if (change >= 0) {
    throw new Error(`${metricName} does not contain a decline to diagnose.`);
  }

  return { current, previous, change };
}

function findReleaseComparison(
  releases: DemoReleaseRow[],
  currentMetricDate: string,
): ReleaseComparison {
  const eligibleReleases = releases
    .filter((release) => release.releaseDate <= currentMetricDate)
    .sort((left, right) => left.releaseDate.localeCompare(right.releaseDate));
  const current = eligibleReleases.at(-1);
  const previous = eligibleReleases.at(-2);

  if (!current || !previous) {
    throw new Error(
      "releases.csv requires a current and previous release for comparison.",
    );
  }

  return { current, previous };
}

function findVersionSegmentComparison(
  metrics: DemoMetricRow[],
  releases: ReleaseComparison,
): MetricComparison {
  const current = metrics.find(
    (metric) =>
      normalized(metric.metricName) === ONBOARDING_STEP_METRIC &&
      metric.segment.includes(releases.current.version),
  );
  const previous = metrics.find(
    (metric) =>
      normalized(metric.metricName) === ONBOARDING_STEP_METRIC &&
      metric.segment.includes(releases.previous.version),
  );

  if (!current || !previous) {
    throw new Error(
      "metrics.csv is missing onboarding completion values for the compared releases.",
    );
  }

  return {
    current,
    previous,
    change: current.value - previous.value,
  };
}

function getPlatformFromSegment(segment: string, version: string) {
  const platform = segment.replace(version, "").trim();

  if (!platform) {
    throw new Error(
      "The affected metrics.csv segment does not identify a platform.",
    );
  }

  return platform;
}

function getOnboardingStageOrder(eventName: string): number | null {
  if (eventName === ONBOARDING_ENTRY_EVENT) {
    return 0;
  }

  const stepMatch = /^complete_step(\d+)$/i.exec(eventName);
  return stepMatch ? Number(stepMatch[1]) : null;
}

function uniqueUsersForEvent(events: DemoEventRow[], eventName: string) {
  return new Set(
    events
      .filter((event) => normalized(event.eventName) === normalized(eventName))
      .map((event) => event.userId),
  ).size;
}

function createFunnelEvidence(
  events: DemoEventRow[],
  platform: string,
  releases: ReleaseComparison,
): FunnelEvidence {
  const currentEvents = events.filter(
    (event) =>
      normalized(event.platform) === normalized(platform) &&
      event.version === releases.current.version,
  );
  const previousEvents = events.filter(
    (event) => event.version === releases.previous.version,
  );
  const stageNames = [
    ...new Set(currentEvents.map((event) => normalized(event.eventName))),
  ]
    .map((eventName) => ({
      eventName,
      order: getOnboardingStageOrder(eventName),
    }))
    .filter(
      (stage): stage is { eventName: string; order: number } =>
        stage.order !== null,
    )
    .sort((left, right) => left.order - right.order);
  const currentEntryUsers = uniqueUsersForEvent(
    currentEvents,
    ONBOARDING_ENTRY_EVENT,
  );
  const previousEntryUsers = uniqueUsersForEvent(
    previousEvents,
    ONBOARDING_ENTRY_EVENT,
  );

  if (
    stageNames.length < 2 ||
    currentEntryUsers === 0 ||
    previousEntryUsers === 0
  ) {
    throw new Error(
      "events.csv does not contain a comparable onboarding funnel.",
    );
  }

  const stages = stageNames.map((stage) => ({
    ...stage,
    currentUsers: uniqueUsersForEvent(currentEvents, stage.eventName),
    previousUsers: uniqueUsersForEvent(previousEvents, stage.eventName),
  }));
  const largestDrop = stages.slice(1).reduce((largest, stage, index) => {
    const priorStage = stages[index]!;
    const drop = priorStage.currentUsers - stage.currentUsers;

    return drop > largest.drop ? { stage, drop } : largest;
  }, { stage: stages[1]!, drop: stages[0]!.currentUsers - stages[1]!.currentUsers });

  return {
    currentEntryUsers,
    currentStepUsers: largestDrop.stage.currentUsers,
    currentCompletionRate:
      (largestDrop.stage.currentUsers / currentEntryUsers) * 100,
    previousEntryUsers,
    previousStepUsers: largestDrop.stage.previousUsers,
    previousCompletionRate:
      (largestDrop.stage.previousUsers / previousEntryUsers) * 100,
    stepName: largestDrop.stage.eventName,
  };
}

function createFeedbackSignal(
  dataset: DemoDiagnosticDataset,
  affectedUserIds: Set<string>,
): FeedbackSignal {
  const matchingFeedback = dataset.feedback.filter((feedback) =>
    affectedUserIds.has(feedback.userId),
  );

  if (matchingFeedback.length === 0) {
    throw new Error(
      "feedback.csv does not contain feedback from the affected segment.",
    );
  }

  const categoryCounts = new Map<string, number>();

  for (const feedback of matchingFeedback) {
    categoryCounts.set(
      feedback.category,
      (categoryCounts.get(feedback.category) ?? 0) + 1,
    );
  }

  const categorySummary = [...categoryCounts.entries()]
    .map(([category, count]) => `${count} ${category}`)
    .join(" and ");
  const sentiments = new Set(
    matchingFeedback.map((feedback) => normalized(feedback.sentiment)),
  );

  return {
    id: "demo-dataset-feedback-signal",
    topic: [...categoryCounts.keys()].join(" / "),
    mentionCount: matchingFeedback.length,
    change: `${matchingFeedback.length} reports`,
    sentiment:
      sentiments.size === 1 && sentiments.has("negative")
        ? "Negative"
        : "Mixed",
    finding: `${matchingFeedback.length} linked feedback items are negative: ${categorySummary}.`,
    source: "feedback.csv joined to users.csv",
    snippets: matchingFeedback.map((feedback) => feedback.text),
  };
}

function createBehaviorSignals(input: {
  affectedPlatform: string;
  affectedUserCount: number;
  funnel: FunnelEvidence;
  retention: MetricComparison;
  release: DemoReleaseRow;
  segmentMetric: MetricComparison;
}): [BehaviorSignal, ...BehaviorSignal[]] {
  const {
    affectedPlatform,
    affectedUserCount,
    funnel,
    retention,
    release,
    segmentMetric,
  } = input;

  return [
    {
      id: "demo-dataset-retention-change",
      label: "D1 Retention",
      value: formatSignedPoints(retention.change),
      finding: `D1 Retention declined from ${formatPercentage(retention.previous.value)} to ${formatPercentage(retention.current.value)}.`,
      detail: `${retention.previous.date} compared with ${retention.current.date}.`,
      source: "metrics.csv",
    },
    {
      id: "demo-dataset-affected-segment",
      label: `${affectedPlatform} release comparison`,
      value: formatSignedPoints(segmentMetric.change),
      finding: `${segmentMetric.current.metricName} declined from ${formatPercentage(segmentMetric.previous.value)} in ${segmentMetric.previous.segment} to ${formatPercentage(segmentMetric.current.value)} in ${segmentMetric.current.segment}.`,
      detail: `${affectedUserCount} users in users.csv match ${segmentMetric.current.segment}.`,
      source: "metrics.csv joined to users.csv",
    },
    {
      id: "demo-dataset-funnel-dropoff",
      label: "Onboarding event funnel",
      value: formatPercentage(funnel.currentCompletionRate),
      finding: `${funnel.currentStepUsers} of ${funnel.currentEntryUsers} users reached ${funnel.stepName}, compared with ${funnel.previousStepUsers} of ${funnel.previousEntryUsers} in the previous release.`,
      detail: `Completion declined from ${formatPercentage(funnel.previousCompletionRate)} to ${formatPercentage(funnel.currentCompletionRate)} in events.csv.`,
      source: "events.csv",
    },
    {
      id: "demo-dataset-release-context",
      label: "Release context",
      value: release.version,
      finding: release.change,
      detail: `Released on ${release.releaseDate}.`,
      source: "releases.csv",
    },
  ];
}

export function createDemoDatasetDiagnosticCase(
  dataset: DemoDiagnosticDataset,
): DiagnosticCase {
  const retention = findMetricDecline(
    dataset.metrics,
    D1_RETENTION_METRIC,
    "All Users",
  );
  const releases = findReleaseComparison(
    dataset.releases,
    retention.current.date,
  );
  const segmentMetric = findVersionSegmentComparison(
    dataset.metrics,
    releases,
  );
  const affectedPlatform = getPlatformFromSegment(
    segmentMetric.current.segment,
    releases.current.version,
  );
  const affectedUsers = dataset.users.filter(
    (user) =>
      normalized(user.platform) === normalized(affectedPlatform) &&
      user.version === releases.current.version,
  );

  if (affectedUsers.length === 0) {
    throw new Error(
      "users.csv does not contain users for the affected platform and release.",
    );
  }

  const affectedUserIds = new Set(affectedUsers.map((user) => user.userId));
  const affectedUserTypes = [
    ...new Set(affectedUsers.map((user) => user.userType)),
  ];
  const funnel = createFunnelEvidence(
    dataset.events,
    affectedPlatform,
    releases,
  );
  const feedbackSignal = createFeedbackSignal(dataset, affectedUserIds);
  const behaviorSignals = createBehaviorSignals({
    affectedPlatform,
    affectedUserCount: affectedUsers.length,
    funnel,
    retention,
    release: releases.current,
    segmentMetric,
  });
  const changeMagnitude = Math.abs(retention.change);
  const periodLabel = `${retention.current.date} vs. ${retention.previous.date}`;

  return {
    id: DATASET_PRIMARY_ANOMALY_ID,
    source: "dataset",
    status: "ready",
    severity: changeMagnitude >= 20 ? "HIGH" : "MEDIUM",
    title: `D1 Retention decline after ${releases.current.version} onboarding update`,
    metric: {
      id: "d1-retention",
      label: retention.current.metricName,
      currentValue: formatPercentage(retention.current.value),
      previousValue: formatPercentage(retention.previous.value),
      changeValue: retention.change,
      changeType: "percentage-points",
      comparison: periodLabel,
    },
    context: {
      dateRange: {
        id: "demo-dataset-date-range",
        label: periodLabel,
      },
      segment: {
        id: "demo-dataset-segment",
        label: `${affectedPlatform} · ${releases.current.version} · ${affectedUserTypes.join(" / ")}`,
      },
      platform: {
        id: "demo-dataset-platform",
        label: affectedPlatform,
      },
      version: {
        id: "demo-dataset-version",
        label: `${releases.current.version} · ${releases.current.change} · released ${releases.current.releaseDate}`,
      },
    },
    summary: {
      changed: `D1 Retention declined from ${formatPercentage(retention.previous.value)} to ${formatPercentage(retention.current.value)}.`,
      affected: `${segmentMetric.current.metricName} declined from ${formatPercentage(segmentMetric.previous.value)} in ${segmentMetric.previous.segment} to ${formatPercentage(segmentMetric.current.value)} in ${segmentMetric.current.segment}; ${funnel.currentStepUsers} of ${funnel.currentEntryUsers} users reached ${funnel.stepName}, compared with ${funnel.previousStepUsers} of ${funnel.previousEntryUsers} in the previous release.`,
      started: `${releases.current.version} ${releases.current.change} was released on ${releases.current.releaseDate}; ${feedbackSignal.mentionCount} linked negative feedback items are available for the affected users.`,
    },
    evidence: {
      behaviorSignals,
      feedbackSignals: [feedbackSignal],
    },
    reasoning: {
      observation: {
        statement: `The retention decline, ${affectedPlatform} ${releases.current.version} onboarding completion decline, ${funnel.stepName} event drop-off, ${feedbackSignal.mentionCount} linked negative feedback items, and ${releases.current.version} release context are confirmed in the demo datasets.`,
        evidenceIds: [
          ...behaviorSignals.map((signal) => signal.id),
          feedbackSignal.id,
        ],
      },
      inference: {
        statement: `The evidence is concentrated around the ${releases.current.version} onboarding flow and is temporally aligned with ${releases.current.change}. This alignment does not establish causality.`,
        evidenceIds: behaviorSignals.map((signal) => signal.id),
        status: "Supported by linked dataset evidence",
      },
      hypothesis: {
        statement: `${releases.current.change} may be associated with the onboarding drop-off and requires validation against the previous release behavior.`,
        evidenceIds: [
          "demo-dataset-affected-segment",
          "demo-dataset-funnel-dropoff",
          "demo-dataset-release-context",
          feedbackSignal.id,
        ],
        status: "Unvalidated",
      },
    },
    traceSteps: [
      {
        id: "demo-dataset-trace-metric",
        label: "Metric change detected",
        description: `Compared ${retention.current.metricName} on ${retention.previous.date} and ${retention.current.date}.`,
        status: "dataset-calculated",
        evidenceIds: ["demo-dataset-retention-change"],
      },
      {
        id: "demo-dataset-trace-segment",
        label: "Affected segment identified",
        description: `Matched ${segmentMetric.current.segment} metric evidence to ${affectedUsers.length} users.`,
        status: "dataset-calculated",
        evidenceIds: ["demo-dataset-affected-segment"],
      },
      {
        id: "demo-dataset-trace-funnel",
        label: "Onboarding event drop-off calculated",
        description: `Compared unique users across onboarding events for ${releases.previous.version} and ${releases.current.version}.`,
        status: "dataset-calculated",
        evidenceIds: ["demo-dataset-funnel-dropoff"],
      },
      {
        id: "demo-dataset-trace-feedback",
        label: "Feedback linked to affected users",
        description: `Joined ${feedbackSignal.mentionCount} feedback records to the affected user segment.`,
        status: "dataset-calculated",
        evidenceIds: [feedbackSignal.id],
      },
      {
        id: "demo-dataset-trace-release",
        label: "Release context attached",
        description: `Matched ${releases.current.version} and its ${releases.current.releaseDate} release date.`,
        status: "dataset-calculated",
        evidenceIds: ["demo-dataset-release-context"],
      },
    ],
    nextValidations: [
      {
        id: "dataset-compare-release-versions",
        label: "Compare release versions",
        description: `Validate whether the retention and onboarding drop-offs remain concentrated in ${releases.current.version} compared with ${releases.previous.version}.`,
      },
      {
        id: "dataset-review-onboarding-step",
        label: `Review ${funnel.stepName} behavior`,
        description:
          "Inspect the transition into the largest onboarding event drop-off and verify the event instrumentation.",
      },
      {
        id: "dataset-review-linked-feedback",
        label: "Review linked feedback",
        description:
          "Check whether the onboarding and UX reports describe the same point of friction shown in the event funnel.",
      },
    ],
  };
}
