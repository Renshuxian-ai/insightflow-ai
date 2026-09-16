import {
  DATASET_ANALYTICS_SEMANTIC_TYPES,
  findAnalyticsField,
  readCell,
  toAnalyticsDateKey,
  toCellText,
} from "@/lib/analytics/dataset-context/field-bindings";
import type { DatasetAnalyticsBuilderInput } from "@/lib/analytics/dataset-context/types";
import { toTemporalValue } from "@/lib/datasets/server/profiling/infer-field-type";

import type {
  OverviewRuntimeActivityEvidence,
  OverviewRuntimeAnomaly,
} from "./overview-runtime";

const ACTIVITY_DECLINE_THRESHOLD_RATIO = 0.1;
const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

function unavailableActivity(
  input: DatasetAnalyticsBuilderInput,
  reason: string,
): OverviewRuntimeActivityEvidence {
  return {
    rowCount: input.dataset.rowCount,
    selectedSheetName: input.dataset.selectedSheetName,
    fields: {
      userIdentifier: null,
      eventTimestamp: null,
    },
    dau: { status: "unavailable", id: "dau", label: "DAU", reason },
    dailyDau: { status: "unavailable", reason },
    anomaly: null,
  };
}

function toDateKey(value: Parameters<typeof toAnalyticsDateKey>[0]) {
  const analyticsDate = toAnalyticsDateKey(value);

  if (analyticsDate) {
    return analyticsDate;
  }

  return toTemporalValue(value)?.slice(0, 10) ?? null;
}

function shiftDate(date: string, days: number): string {
  const timestamp = Date.parse(`${date}T00:00:00.000Z`);
  return new Date(timestamp + days * DAY_IN_MILLISECONDS)
    .toISOString()
    .slice(0, 10);
}

function averageDau(
  dailyUsers: ReadonlyMap<string, ReadonlySet<string>>,
  start: string,
): number {
  let total = 0;

  for (let offset = 0; offset < 7; offset += 1) {
    total += dailyUsers.get(shiftDate(start, offset))?.size ?? 0;
  }

  return total / 7;
}

function buildActivityAnomaly(
  dailyUsers: ReadonlyMap<string, ReadonlySet<string>>,
  dates: readonly string[],
): OverviewRuntimeAnomaly | null {
  const latestDate = dates.at(-1);

  if (!latestDate) {
    return null;
  }

  const currentStart = shiftDate(latestDate, -6);
  const previousEnd = shiftDate(currentStart, -1);
  const previousStart = shiftDate(previousEnd, -6);

  if (dates[0]! > previousStart) {
    return null;
  }

  const current = averageDau(dailyUsers, currentStart);
  const previous = averageDau(dailyUsers, previousStart);
  const relative = previous === 0 ? null : (current - previous) / previous;

  if (relative === null || relative > -ACTIVITY_DECLINE_THRESHOLD_RATIO) {
    return null;
  }

  return {
    source: "dataset",
    metric: "DAU",
    unit: "users",
    current,
    previous,
    change: { absolute: current - previous, relative },
    period: {
      current: `${currentStart} to ${latestDate}`,
      previous: `${previousStart} to ${previousEnd}`,
    },
    evidenceSummary: `Average DAU declined from ${previous.toFixed(1)} users to ${current.toFixed(1)} users (${Math.abs(relative * 100).toFixed(1)}%).`,
  };
}

export function buildOverviewActivityEvidence(
  input: DatasetAnalyticsBuilderInput,
): OverviewRuntimeActivityEvidence {
  const userIdentifier = findAnalyticsField(input, {
    names: ["user_id", "account_id"],
    semanticTypes: [DATASET_ANALYTICS_SEMANTIC_TYPES.userId],
  });
  const eventTimestamp = findAnalyticsField(input, {
    names: ["event_timestamp", "timestamp", "occurred_at", "event_time"],
    semanticTypes: [DATASET_ANALYTICS_SEMANTIC_TYPES.eventTimestamp],
  });

  if (!userIdentifier || !eventTimestamp) {
    return {
      ...unavailableActivity(
        input,
        "A confirmed user identifier and event timestamp are required for activity evidence.",
      ),
      fields: { userIdentifier, eventTimestamp },
    };
  }

  const dailyUsers = new Map<string, Set<string>>();

  for (const row of input.dataset.rows) {
    const userId = toCellText(readCell(row, userIdentifier));
    const date = toDateKey(readCell(row, eventTimestamp));

    if (!userId || !date) {
      continue;
    }

    const users = dailyUsers.get(date) ?? new Set<string>();
    users.add(userId);
    dailyUsers.set(date, users);
  }

  const points = [...dailyUsers.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, users]) => ({ date, value: users.size }));

  if (points.length === 0) {
    return {
      ...unavailableActivity(
        input,
        "No rows contain both a valid user identifier and event timestamp.",
      ),
      fields: { userIdentifier, eventTimestamp },
    };
  }

  const current = points.at(-1)!;
  const previous = points.at(-2);
  const comparison = previous
    ? {
        previous: previous.value,
        absoluteChange: current.value - previous.value,
        relativeChange:
          previous.value === 0
            ? null
            : (current.value - previous.value) / previous.value,
        currentPeriod: current.date,
        previousPeriod: previous.date,
      }
    : null;

  return {
    rowCount: input.dataset.rowCount,
    selectedSheetName: input.dataset.selectedSheetName,
    fields: { userIdentifier, eventTimestamp },
    dau: {
      status: "available",
      id: "dau",
      label: "DAU",
      unit: "users",
      current: current.value,
      currentPeriod: current.date,
      comparison,
      comparisonUnavailableReason: comparison
        ? null
        : "A previous active date is not available.",
    },
    dailyDau: { status: "available", points },
    anomaly: buildActivityAnomaly(dailyUsers, points.map((point) => point.date)),
  };
}
