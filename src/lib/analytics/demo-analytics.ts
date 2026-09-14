import type {
  DemoDiagnosticDataset,
  DemoEventRow,
  DemoMetricRow,
} from "@/lib/diagnostics/demo-dataset/types";

import { retentionDemoData } from "./retention-demo-data";

export const ANALYTICS_DIAGNOSTIC_HREF =
  "/ai-diagnostics/new-user-d1-retention-drop";

export const ONBOARDING_FUNNEL_EVENTS = [
  "app_open",
  "view_onboarding",
  "complete_step1",
  "complete_step2",
  "complete_step3",
] as const;

export type AnalyticsTrendPoint = {
  date: string;
  segment: string;
  value: number;
};

export type AnalyticsMetricTrend = {
  id: string;
  label: string;
  points: AnalyticsTrendPoint[];
  current: AnalyticsTrendPoint;
  previous: AnalyticsTrendPoint | null;
  change: number | null;
  anomalyDetected: boolean;
};

export type AnalyticsAnomaly = {
  id: string;
  title: string;
  metricLabel: string;
  current: number;
  previous: number;
  change: number;
  comparison: string;
  investigateHref: string | null;
};

export type AnalyticsFunnelStage = {
  eventName: (typeof ONBOARDING_FUNNEL_EVENTS)[number];
  label: string;
  currentUsers: number;
  previousUsers: number;
  currentCompletionRate: number;
  previousCompletionRate: number;
  dropOffUsers: number;
  dropOffRate: number;
  isLargestDropOff: boolean;
};

export type AnalyticsFunnel = {
  currentVersion: string;
  previousVersion: string;
  currentPlatform: string;
  currentEntryUsers: number;
  previousEntryUsers: number;
  stages: AnalyticsFunnelStage[];
};

type RetentionDemoCohort = (typeof retentionDemoData.cohorts)[number];

export type AnalyticsRetentionCohort = RetentionDemoCohort & {
  segment: string;
  d1Retention: number;
  d7Retention: number;
  d30Retention: number;
  changeFromPrevious: number | null;
  anomalyDetected: boolean;
};

export type AnalyticsRetention = Omit<typeof retentionDemoData, "cohorts"> & {
  current: AnalyticsRetentionCohort;
  previous: AnalyticsRetentionCohort | null;
  cohorts: AnalyticsRetentionCohort[];
};

export type DemoAnalyticsResult = {
  source: "demo-dataset";
  trends: {
    metrics: AnalyticsMetricTrend[];
    anomalies: AnalyticsAnomaly[];
  };
  funnel: AnalyticsFunnel;
  retention: AnalyticsRetention;
};

function normalized(value: string) {
  return value.trim().toLocaleLowerCase("en-US");
}

function toId(value: string) {
  return normalized(value).replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function sortMetricRows(rows: DemoMetricRow[]) {
  return [...rows].sort(
    (left, right) =>
      left.date.localeCompare(right.date) ||
      left.segment.localeCompare(right.segment),
  );
}

function buildMetricTrends(metrics: DemoMetricRow[]): AnalyticsMetricTrend[] {
  const groupedMetrics = new Map<string, DemoMetricRow[]>();

  for (const metric of metrics) {
    const key = normalized(metric.metricName);
    groupedMetrics.set(key, [...(groupedMetrics.get(key) ?? []), metric]);
  }

  return [...groupedMetrics.values()].map((rows) => {
    const sortedRows = sortMetricRows(rows);
    const current = sortedRows.at(-1)!;
    const previous = sortedRows.at(-2) ?? null;
    const points = sortedRows.map((row) => ({
      date: row.date,
      segment: row.segment,
      value: row.value,
    }));
    const change = previous ? current.value - previous.value : null;

    return {
      id: toId(current.metricName),
      label: current.metricName,
      points,
      current: points.at(-1)!,
      previous: points.at(-2) ?? null,
      change,
      anomalyDetected: change !== null && change < 0,
    };
  });
}

function buildAnomalies(trends: AnalyticsMetricTrend[]): AnalyticsAnomaly[] {
  return trends.flatMap((trend) => {
    if (!trend.previous || trend.change === null || !trend.anomalyDetected) {
      return [];
    }

    const isD1Retention = normalized(trend.label) === "d1 retention";

    return [
      {
        id: `${trend.id}-decline`,
        title: `${trend.label} declined`,
        metricLabel: trend.label,
        current: trend.current.value,
        previous: trend.previous.value,
        change: trend.change,
        comparison: `${trend.current.date} vs. ${trend.previous.date}`,
        investigateHref: isD1Retention ? ANALYTICS_DIAGNOSTIC_HREF : null,
      },
    ];
  });
}

function uniqueUsersForEvent(
  events: DemoEventRow[],
  eventName: (typeof ONBOARDING_FUNNEL_EVENTS)[number],
) {
  return new Set(
    events
      .filter((event) => normalized(event.eventName) === eventName)
      .map((event) => event.userId),
  ).size;
}

function formatEventLabel(eventName: string) {
  return eventName
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function buildFunnel(dataset: DemoDiagnosticDataset): AnalyticsFunnel {
  const versionSorter = new Intl.Collator("en-US", { numeric: true });
  const versions = [...new Set(dataset.events.map((event) => event.version))]
    .sort(versionSorter.compare);
  const currentVersion = versions.at(-1);
  const previousVersion = versions.at(-2);

  if (!currentVersion || !previousVersion) {
    throw new Error(
      "events.csv requires current and previous versions for funnel comparison.",
    );
  }

  const currentEvents = dataset.events.filter(
    (event) => event.version === currentVersion,
  );
  const previousEvents = dataset.events.filter(
    (event) => event.version === previousVersion,
  );
  const currentEntryUsers = uniqueUsersForEvent(currentEvents, "app_open");
  const previousEntryUsers = uniqueUsersForEvent(previousEvents, "app_open");

  if (currentEntryUsers === 0 || previousEntryUsers === 0) {
    throw new Error("events.csv does not contain a comparable app_open cohort.");
  }

  const stageDrafts = ONBOARDING_FUNNEL_EVENTS.map((eventName, index) => {
    const currentUsers = uniqueUsersForEvent(currentEvents, eventName);
    const previousUsers = uniqueUsersForEvent(previousEvents, eventName);
    const priorCurrentUsers =
      index === 0
        ? currentEntryUsers
        : uniqueUsersForEvent(currentEvents, ONBOARDING_FUNNEL_EVENTS[index - 1]!);
    const dropOffUsers = Math.max(priorCurrentUsers - currentUsers, 0);

    return {
      eventName,
      label: formatEventLabel(eventName),
      currentUsers,
      previousUsers,
      currentCompletionRate: (currentUsers / currentEntryUsers) * 100,
      previousCompletionRate: (previousUsers / previousEntryUsers) * 100,
      dropOffUsers,
      dropOffRate:
        priorCurrentUsers === 0 ? 0 : (dropOffUsers / priorCurrentUsers) * 100,
    };
  });
  const largestDropOffUsers = Math.max(
    ...stageDrafts.map((stage) => stage.dropOffUsers),
  );
  const currentPlatforms = [
    ...new Set(
      dataset.users
        .filter((user) => user.version === currentVersion)
        .map((user) => user.platform),
    ),
  ];

  return {
    currentVersion,
    previousVersion,
    currentPlatform: currentPlatforms.join(" / ") || "All platforms",
    currentEntryUsers,
    previousEntryUsers,
    stages: stageDrafts.map((stage) => ({
      ...stage,
      isLargestDropOff:
        stage.dropOffUsers > 0 && stage.dropOffUsers === largestDropOffUsers,
    })),
  };
}

function getRetentionRate(cohort: RetentionDemoCohort, day: number) {
  const interval = cohort.intervals.find((item) => item.day === day);

  if (!interval) {
    throw new Error(
      `Retention demo cohort ${cohort.date} is missing its D${day} interval.`,
    );
  }

  return interval.rate;
}

function buildRetention(): AnalyticsRetention {
  const cohorts = retentionDemoData.cohorts.map((cohort, index) => {
    const d1Retention = getRetentionRate(cohort, 1);
    const previousCohort = retentionDemoData.cohorts[index - 1] ?? null;
    const changeFromPrevious = previousCohort
      ? d1Retention - getRetentionRate(previousCohort, 1)
      : null;

    return {
      ...cohort,
      segment: retentionDemoData.definition.segment,
      d1Retention,
      d7Retention: getRetentionRate(cohort, 7),
      d30Retention: getRetentionRate(cohort, 30),
      changeFromPrevious,
      anomalyDetected:
        changeFromPrevious !== null && changeFromPrevious < 0,
    };
  });

  return {
    ...retentionDemoData,
    current: cohorts.at(-1)!,
    previous: cohorts.at(-2) ?? null,
    cohorts,
  };
}

export function buildDemoAnalyticsResult(
  dataset: DemoDiagnosticDataset,
): DemoAnalyticsResult {
  const metrics = buildMetricTrends(dataset.metrics);

  return {
    source: "demo-dataset",
    trends: {
      metrics,
      anomalies: buildAnomalies(metrics),
    },
    funnel: buildFunnel(dataset),
    retention: buildRetention(),
  };
}
