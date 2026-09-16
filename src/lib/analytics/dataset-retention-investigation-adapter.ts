import type {
  AnalyticsRetentionInvestigationContext,
  AnalyticsRetentionInterval,
} from "./investigation-context";
import type { DatasetAnalyticsContext } from "./dataset-context";
import { buildRetentionDiagnosis } from "./retention-diagnosis-builder";

const SUPPORTED_INTERVALS = new Set<AnalyticsRetentionInterval>([
  "D0",
  "D1",
  "D3",
  "D7",
  "D14",
  "D30",
]);

function toInterval(value: string): AnalyticsRetentionInterval | null {
  return SUPPORTED_INTERVALS.has(value as AnalyticsRetentionInterval)
    ? (value as AnalyticsRetentionInterval)
    : null;
}

export function buildDatasetRetentionInvestigationContext(
  analyticsContext: DatasetAnalyticsContext,
): AnalyticsRetentionInvestigationContext | null {
  const evidence = analyticsContext.retentionEvidence;
  const comparison = evidence?.comparison;

  if (!evidence || !comparison) {
    return null;
  }

  const baselineByDay = new Map(
    comparison.baseline.intervals.map((interval) => [interval.day, interval]),
  );
  const intervals = comparison.current.intervals.flatMap((current) => {
    const baseline = baselineByDay.get(current.day);
    const interval = toInterval(current.interval);

    if (!baseline || !interval) {
      return [];
    }

    return [{
      interval,
      currentRate: current.retentionRate,
      currentRetainedUsers: current.retainedUsers,
      baselineRate: baseline.retentionRate,
      baselineRetainedUsers: baseline.retainedUsers,
      gapPercentagePoints: Number(
        (current.retentionRate - baseline.retentionRate).toFixed(2),
      ),
    }];
  });

  if (intervals.length === 0) {
    return null;
  }

  const selectedInterval = intervals.reduce((selected, interval) =>
    interval.gapPercentagePoints < selected.gapPercentagePoints
      ? interval
      : selected,
  ).interval;
  const intervalByName = new Map(
    intervals.map((interval) => [interval.interval, interval]),
  );
  const d1 = intervalByName.get("D1");
  const d7 = intervalByName.get("D7");
  const d30 = intervalByName.get("D30");
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
  })) ?? [];
  const diagnosis = buildRetentionDiagnosis({ breakdowns });
  const focusInterval: AnalyticsRetentionInterval =
    diagnosis && intervalByName.has("D7") ? "D7" : selectedInterval;
  const primarySegment = diagnosis?.primaryEvidence;
  const primarySegmentD1 = primarySegment?.segment.retention.D1;
  const primarySegmentD30 = primarySegment?.segment.retention.D30;
  const benchmarkD1 = primarySegment?.benchmark.retention.D1;
  const benchmarkD30 = primarySegment?.benchmark.retention.D30;
  const segmentEvidence =
    primarySegment &&
    primarySegmentD1 !== null &&
    primarySegmentD1 !== undefined &&
    primarySegmentD30 !== null &&
    primarySegmentD30 !== undefined &&
    benchmarkD1 !== null &&
    benchmarkD1 !== undefined &&
    benchmarkD30 !== null &&
    benchmarkD30 !== undefined
      ? {
          dimension: primarySegment.dimensionLabel,
          segment: primarySegment.segment.label,
          users: primarySegment.segment.users,
          retention: {
            D1: primarySegmentD1,
            D7: primarySegment.segment.retention.D7,
            D30: primarySegmentD30,
          },
          comparisonSegment: primarySegment.benchmark.label,
          comparisonRetention: {
            D1: benchmarkD1,
            D7: primarySegment.benchmark.retention.D7,
            D30: benchmarkD30,
          },
        }
      : d1 && d7 && d30
    ? {
        dimension: "analysis window",
        segment: "Current window",
        users: comparison.current.users,
        retention: {
          D1: d1.currentRate,
          D7: d7.currentRate,
          D30: d30.currentRate,
        },
        comparisonSegment: "Baseline window",
        comparisonRetention: {
          D1: d1.baselineRate,
          D7: d7.baselineRate,
          D30: d30.baselineRate,
        },
      }
    : null;

  return {
    surface: "retention",
    signalId: [
      "dataset",
      analyticsContext.datasetId,
      "retention",
      focusInterval.toLocaleLowerCase("en-US"),
    ].join(":"),
    selectedCohort: {
      date: `${comparison.current.start} to ${comparison.current.end}`,
      users: comparison.current.users,
    },
    selectedInterval: focusInterval,
    segmentEvidence,
    metricEvidence: {
      metric: "retention",
      event: evidence.fields.retentionMetric.originalName,
      returningEvent: `Retained ${evidence.fields.userIdentifier.originalName}`,
      period: "Calendar-day retention intervals",
      window: `${comparison.current.start} to ${comparison.current.end} vs ${comparison.baseline.start} to ${comparison.baseline.end}`,
      intervals,
    },
    datasetEvidence: {
      datasetId: analyticsContext.datasetId,
      source: "uploaded-dataset",
      quality: "estimated",
      method: comparison.method,
      limitations: [
        "Current and baseline are estimated by splitting observed dates into adjacent halves.",
        "Retained users are estimated from unique users and the average retention rate.",
        ...(diagnosis
          ? []
          : ["No segment comparison is inferred without segment-level retention evidence."]),
      ],
    },
  };
}
