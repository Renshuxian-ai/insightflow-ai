import type { DemoAnalyticsResult } from "./demo-analytics";
import type {
  AnalyticsRetentionInvestigationContext,
  AnalyticsRetentionInterval,
} from "./investigation-context";

type Retention = DemoAnalyticsResult["retention"];
type RetentionCohort = Retention["cohorts"][number];
type RetentionInterval = RetentionCohort["intervals"][number];
type RetentionBreakdownSegment = Retention["breakdowns"]["platform"][number];

type RetentionInvestigationAdapterInput = {
  cohort: RetentionCohort;
  selectedInterval: string | null;
  segment: {
    dimension: string;
    selected: RetentionBreakdownSegment;
    baseline: RetentionBreakdownSegment;
  };
  baseline: RetentionInterval[];
  retentionValues: RetentionInterval[];
  definition: Retention["definition"];
};

const RETENTION_INTERVALS = new Set<AnalyticsRetentionInterval>([
  "D0",
  "D1",
  "D3",
  "D7",
  "D14",
  "D30",
]);

function toRetentionInterval(day: number): AnalyticsRetentionInterval | null {
  const interval = `D${day}` as AnalyticsRetentionInterval;

  return RETENTION_INTERVALS.has(interval) ? interval : null;
}

function normalizeSelectedInterval(
  interval: string | null,
): AnalyticsRetentionInterval | null {
  return interval && RETENTION_INTERVALS.has(interval as AnalyticsRetentionInterval)
    ? (interval as AnalyticsRetentionInterval)
    : null;
}

function toSignalPart(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function buildRetentionInvestigationContext({
  cohort,
  selectedInterval,
  segment,
  baseline,
  retentionValues,
  definition,
}: RetentionInvestigationAdapterInput): AnalyticsRetentionInvestigationContext {
  const baselineByDay = new Map(
    baseline.map((interval) => [interval.day, interval]),
  );
  const normalizedInterval = normalizeSelectedInterval(selectedInterval);
  const intervals = retentionValues.flatMap((current) => {
    const baselineValue = baselineByDay.get(current.day);
    const interval = toRetentionInterval(current.day);

    if (!baselineValue || !interval) {
      return [];
    }

    return [
      {
        interval,
        currentRate: current.rate,
        currentRetainedUsers: current.users,
        baselineRate: baselineValue.rate,
        baselineRetainedUsers: baselineValue.users,
        gapPercentagePoints: current.rate - baselineValue.rate,
      },
    ];
  });
  const signalId = [
    "retention",
    cohort.date,
    normalizedInterval ?? "all-intervals",
    toSignalPart(segment.dimension),
    toSignalPart(segment.selected.name),
  ].join(":");

  return {
    surface: "retention",
    signalId,
    selectedCohort: {
      date: cohort.date,
      users: cohort.users,
    },
    selectedInterval: normalizedInterval,
    segmentEvidence: {
      dimension: segment.dimension,
      segment: segment.selected.name,
      users: segment.selected.users,
      retention: {
        D1: segment.selected.D1,
        D7: segment.selected.D7,
        D30: segment.selected.D30,
      },
      comparisonSegment: segment.baseline.name,
      comparisonRetention: {
        D1: segment.baseline.D1,
        D7: segment.baseline.D7,
        D30: segment.baseline.D30,
      },
    },
    metricEvidence: {
      metric: "retention",
      event: definition.event,
      returningEvent: definition.returningEvent,
      period: definition.period,
      window: definition.window,
      intervals,
    },
  };
}
