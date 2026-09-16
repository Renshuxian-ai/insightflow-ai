import type { DatasetCellValue } from "@/lib/datasets/types";

import {
  DATASET_ANALYTICS_SEMANTIC_TYPES,
  findAnalyticsField,
  getPercentageScale,
  readCell,
  roundAnalyticsValue,
  toAnalyticsDateKey,
  toCellText,
  toFiniteNumber,
  toPercentage,
} from "./field-bindings";
import type {
  DatasetAnalyticsBuilderInput,
  DatasetAnalyticsFieldBinding,
  DatasetRetentionBreakdownDimensionEvidence,
  DatasetRetentionCohortEvidence,
  DatasetRetentionIntervalEvidence,
  DatasetRetentionEvidence,
  DatasetRetentionWindowEvidence,
} from "./types";

type RetentionObservation = {
  date: string;
  day: number;
  rate: number;
  userId: string;
  cohortDate: string | null;
  platform: string | null;
  userType: string | null;
};

function toId(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function findPriorityField(
  input: DatasetAnalyticsBuilderInput,
  names: readonly string[],
): DatasetAnalyticsFieldBinding | null {
  for (const name of names) {
    const field = findAnalyticsField(input, { names: [name] });

    if (field) {
      return field;
    }
  }

  return null;
}

function toRetentionDay(value: DatasetCellValue): number | null {
  const text = toCellText(value);
  const match = text?.match(/^D?(\d{1,3})$/i);

  if (!match) {
    return null;
  }

  const day = Number(match[1]);
  return Number.isInteger(day) && day >= 0 && day <= 365 ? day : null;
}

function aggregateIntervals(
  observations: readonly RetentionObservation[],
): DatasetRetentionIntervalEvidence[] {
  const groups = new Map<
    number,
    { rates: number[]; users: Set<string>; observedRows: number }
  >();

  for (const observation of observations) {
    const group = groups.get(observation.day) ?? {
      rates: [],
      users: new Set<string>(),
      observedRows: 0,
    };

    group.rates.push(observation.rate);
    group.users.add(observation.userId);
    group.observedRows += 1;
    groups.set(observation.day, group);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => left - right)
    .map(([day, group]) => {
      const retentionRate = roundAnalyticsValue(
        group.rates.reduce((sum, rate) => sum + rate, 0) / group.rates.length,
      );
      const users = group.users.size;

      return {
        day,
        interval: `D${day}`,
        observedRows: group.observedRows,
        users,
        retainedUsers: Math.round((users * retentionRate) / 100),
        retentionRate,
      };
    });
}

function buildWindow(
  observations: readonly RetentionObservation[],
  dates: readonly string[],
): DatasetRetentionWindowEvidence | null {
  if (observations.length === 0 || dates.length === 0) {
    return null;
  }

  return {
    start: dates[0]!,
    end: dates.at(-1)!,
    users: new Set(observations.map((observation) => observation.userId)).size,
    intervals: aggregateIntervals(observations),
  };
}

function buildCohorts(
  observations: readonly RetentionObservation[],
  cohortAnchor: DatasetAnalyticsFieldBinding | null,
): DatasetRetentionCohortEvidence[] | null {
  if (!cohortAnchor) {
    return null;
  }

  const groups = new Map<string, RetentionObservation[]>();

  for (const observation of observations) {
    if (!observation.cohortDate) {
      continue;
    }

    groups.set(observation.cohortDate, [
      ...(groups.get(observation.cohortDate) ?? []),
      observation,
    ]);
  }

  const cohorts = [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, cohortObservations]) => {
      const intervals = aggregateIntervals(cohortObservations);

      return {
        id: `cohort-${date}`,
        date,
        users:
          intervals.find((interval) => interval.day === 0)?.users ??
          new Set(
            cohortObservations.map((observation) => observation.userId),
          ).size,
        intervals,
      };
    })
    .filter((cohort) => cohort.intervals.length > 0);

  if (cohorts.length === 0) {
    return null;
  }

  const commonDays = cohorts.slice(1).reduce(
    (days, cohort) =>
      new Set(
        [...days].filter((day) =>
          cohort.intervals.some((interval) => interval.day === day),
        ),
      ),
    new Set(cohorts[0]!.intervals.map((interval) => interval.day)),
  );

  return commonDays.size > 0
    ? cohorts.map((cohort) => ({
        ...cohort,
        intervals: cohort.intervals.filter((interval) =>
          commonDays.has(interval.day),
        ),
      }))
    : null;
}

function buildBreakdownDimension(
  observations: readonly RetentionObservation[],
  input: {
    id: DatasetRetentionBreakdownDimensionEvidence["id"];
    label: string;
    field: DatasetAnalyticsFieldBinding | null;
    getValue: (observation: RetentionObservation) => string | null;
  },
): DatasetRetentionBreakdownDimensionEvidence | null {
  if (!input.field) {
    return null;
  }

  const groups = new Map<string, RetentionObservation[]>();

  for (const observation of observations) {
    const value = input.getValue(observation);

    if (!value) {
      continue;
    }

    groups.set(value, [...(groups.get(value) ?? []), observation]);
  }

  if (groups.size < 2) {
    return null;
  }

  const draftSegments = [...groups.entries()].map(
    ([value, segmentObservations]) => ({
      id: `${input.id}-${toId(value) || "unknown"}`,
      value,
      users: new Set(
        segmentObservations.map((observation) => observation.userId),
      ).size,
      intervals: aggregateIntervals(segmentObservations),
    }),
  );
  const dayCounts = new Map<number, number>();

  for (const segment of draftSegments) {
    for (const interval of segment.intervals) {
      dayCounts.set(interval.day, (dayCounts.get(interval.day) ?? 0) + 1);
    }
  }

  const comparableDays = new Set(
    [...dayCounts.entries()]
      .filter(([, segmentCount]) => segmentCount >= 2)
      .map(([day]) => day),
  );

  if (comparableDays.size === 0) {
    return null;
  }

  const segments = draftSegments
    .filter((segment) =>
      segment.intervals.some((interval) => comparableDays.has(interval.day)),
    )
    .sort((left, right) => left.value.localeCompare(right.value, "en-US"));

  return segments.length >= 2
    ? {
        id: input.id,
        label: input.label,
        field: input.field,
        segments,
      }
    : null;
}

export function buildDatasetRetentionEvidence(
  input: DatasetAnalyticsBuilderInput,
): DatasetRetentionEvidence | null {
  const retentionMetric = findAnalyticsField(input, {
    names: ["retention_rate"],
    semanticTypes: [DATASET_ANALYTICS_SEMANTIC_TYPES.retention],
  });
  const retentionDay = findAnalyticsField(input, {
    names: ["retention_day", "retention_interval"],
  });
  const date = findAnalyticsField(input, {
    names: ["event_timestamp", "timestamp", "occurred_at", "event_time"],
    semanticTypes: [DATASET_ANALYTICS_SEMANTIC_TYPES.eventTimestamp],
  });
  const userIdentifier = findAnalyticsField(input, {
    names: ["user_id", "account_id"],
    semanticTypes: [DATASET_ANALYTICS_SEMANTIC_TYPES.userId],
  });
  const cohortAnchor = findPriorityField(input, [
    "cohort_date",
    "cohort_start_date",
    "cohort_start",
    "acquisition_date",
    "signup_date",
  ]) ??
    findAnalyticsField(input, {
      semanticTypes: [DATASET_ANALYTICS_SEMANTIC_TYPES.cohortDate],
    });
  const platform =
    findPriorityField(input, ["platform"]) ??
    findAnalyticsField(input, {
      semanticTypes: [DATASET_ANALYTICS_SEMANTIC_TYPES.platform],
    });
  const userType = findPriorityField(input, [
    "user_segment",
    "subscription_plan",
    "user_type",
  ]);

  if (!retentionMetric || !retentionDay || !date || !userIdentifier) {
    return null;
  }

  const rawRates = input.dataset.rows.flatMap((row) => {
    const value = toFiniteNumber(readCell(row, retentionMetric));
    return value === null ? [] : [value];
  });
  const percentageScale = getPercentageScale(rawRates);
  const observations: RetentionObservation[] = [];

  for (const row of input.dataset.rows) {
    const day = toRetentionDay(readCell(row, retentionDay));
    const rawRate = toFiniteNumber(readCell(row, retentionMetric));
    const userId = toCellText(readCell(row, userIdentifier));
    const dateKey = toAnalyticsDateKey(readCell(row, date));

    if (day === null || rawRate === null || !userId || !dateKey) {
      continue;
    }

    const rate = toPercentage(rawRate, percentageScale);

    if (rate !== null) {
      observations.push({
        date: dateKey,
        day,
        rate,
        userId,
        cohortDate: cohortAnchor
          ? toAnalyticsDateKey(readCell(row, cohortAnchor))
          : null,
        platform: platform ? toCellText(readCell(row, platform)) : null,
        userType: userType ? toCellText(readCell(row, userType)) : null,
      });
    }
  }

  if (observations.length === 0) {
    return null;
  }

  const dates = [...new Set(observations.map((observation) => observation.date))]
    .sort();
  const splitIndex = Math.floor(dates.length / 2);
  const baselineDates = dates.slice(0, splitIndex);
  const currentDates = dates.slice(splitIndex);
  const baselineDateSet = new Set(baselineDates);
  const currentDateSet = new Set(currentDates);
  const baseline = buildWindow(
    observations.filter((observation) => baselineDateSet.has(observation.date)),
    baselineDates,
  );
  const current = buildWindow(
    observations.filter((observation) => currentDateSet.has(observation.date)),
    currentDates,
  );
  const cohorts = buildCohorts(observations, cohortAnchor);
  const breakdowns = [
    buildBreakdownDimension(observations, {
      id: "platform",
      label: "Platform",
      field: platform,
      getValue: (observation) => observation.platform,
    }),
    buildBreakdownDimension(observations, {
      id: "user-type",
      label: "User type",
      field: userType,
      getValue: (observation) => observation.userType,
    }),
  ].flatMap((breakdown) => (breakdown ? [breakdown] : []));

  return {
    metric: "retention",
    fields: {
      retentionMetric,
      retentionDay,
      date,
      userIdentifier,
      cohortAnchor,
      platform,
      userType,
    },
    dateRange: {
      start: dates[0]!,
      end: dates.at(-1)!,
    },
    users: new Set(observations.map((observation) => observation.userId)).size,
    intervals: aggregateIntervals(observations),
    cohorts,
    breakdowns: breakdowns.length > 0 ? breakdowns : null,
    comparison:
      baseline && current
        ? {
            method: "latest-half-vs-previous-half",
            evidenceQuality: "estimated",
            baseline,
            current,
          }
        : null,
  };
}
