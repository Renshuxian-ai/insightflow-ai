import { SEMANTIC_TYPE_IDS } from "../datasets/semantic/semantic-type-registry";
import type {
  SemanticFieldMapping,
  SemanticMappingValue,
  SemanticSchema,
} from "../datasets/semantic/types";
import type { ParsedDataset } from "../datasets/server/parsers/types";
import { toTemporalValue } from "../datasets/server/profiling/infer-field-type";
import type { DatasetCellValue } from "../datasets/types";

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
const D1_DECLINE_THRESHOLD_POINTS = 3;
const CONVERSION_DECLINE_THRESHOLD_POINTS = 5;
const DAU_DECLINE_THRESHOLD_RATIO = 0.1;

const SUPPORTED_SEMANTIC_TYPES = [
  SEMANTIC_TYPE_IDS.userId,
  SEMANTIC_TYPE_IDS.eventTimestamp,
  SEMANTIC_TYPE_IDS.eventName,
  SEMANTIC_TYPE_IDS.feedbackText,
  SEMANTIC_TYPE_IDS.sentiment,
  SEMANTIC_TYPE_IDS.funnelStep,
] as const;

type SupportedSemanticType = (typeof SUPPORTED_SEMANTIC_TYPES)[number];

export type DatasetOverviewMetricId =
  | "dau"
  | "d1-retention"
  | "core-conversion"
  | "feedback";

export type DatasetOverviewMetricUnit = "users" | "percentage" | "rows";

export type DatasetOverviewComparison = {
  previous: number;
  absoluteChange: number;
  relativeChange: number | null;
  currentPeriod: string;
  previousPeriod: string;
};

export type DatasetOverviewAvailableMetric = {
  status: "available";
  id: DatasetOverviewMetricId;
  label: string;
  unit: DatasetOverviewMetricUnit;
  current: number;
  currentPeriod: string;
  comparison: DatasetOverviewComparison | null;
  comparisonUnavailableReason: string | null;
};

export type DatasetOverviewUnavailableMetric = {
  status: "unavailable";
  id: DatasetOverviewMetricId;
  label: string;
  reason: string;
};

export type DatasetOverviewMetric =
  | DatasetOverviewAvailableMetric
  | DatasetOverviewUnavailableMetric;

export type DailyDauPoint = {
  date: string;
  value: number;
};

export type DatasetOverviewDailyDau =
  | {
      status: "available";
      points: DailyDauPoint[];
    }
  | {
      status: "unavailable";
      reason: string;
    };

export type DatasetOverviewAnomaly = {
  source: "dataset";
  metric: "D1 Retention" | "Core Conversion" | "DAU";
  unit: "percentage" | "users";
  current: number;
  previous: number;
  change: {
    absolute: number;
    relative: number | null;
  };
  period: {
    current: string;
    previous: string;
  };
  evidenceSummary: string;
};

export type DatasetOverviewFieldBinding = {
  stableFieldKey: string;
  originalName: string;
  fieldIndex: number;
};

export type DatasetOverviewResult = {
  version: 1;
  source: "dataset";
  rowCount: number;
  selectedSheetName: string | null;
  fieldBindings: Record<
    SupportedSemanticType,
    DatasetOverviewFieldBinding | null
  >;
  metrics: {
    dau: DatasetOverviewMetric;
    d1Retention: DatasetOverviewMetric;
    coreConversion: DatasetOverviewMetric;
    feedback: DatasetOverviewMetric;
  };
  dailyDau: DatasetOverviewDailyDau;
  primaryAnomaly: DatasetOverviewAnomaly | null;
};

type BoundField = DatasetOverviewFieldBinding & {
  semanticType: SupportedSemanticType;
};

type FieldSelection =
  | { status: "available"; field: BoundField }
  | { status: "unavailable"; reason: string };

type FieldSelections = Record<SupportedSemanticType, FieldSelection>;

type ActivityIndex = {
  dailyUsers: Map<string, Set<string>>;
  userDays: Map<string, Set<string>>;
  earliestDate: string;
  latestDate: string;
};

type ConversionRecord = {
  userId: string;
  value: string;
  date: string | null;
  rowIndex: number;
};

type ConversionDefinition = {
  first: string;
  final: string;
  records: ConversionRecord[];
};

type DateWindow = {
  start: string;
  end: string;
  label: string;
};

const SEMANTIC_TYPE_LABELS: Record<SupportedSemanticType, string> = {
  [SEMANTIC_TYPE_IDS.userId]: "user-id",
  [SEMANTIC_TYPE_IDS.eventTimestamp]: "event-timestamp",
  [SEMANTIC_TYPE_IDS.eventName]: "event-name",
  [SEMANTIC_TYPE_IDS.feedbackText]: "feedback-text",
  [SEMANTIC_TYPE_IDS.sentiment]: "sentiment",
  [SEMANTIC_TYPE_IDS.funnelStep]: "funnel-step",
};

const DEMO_FUNNEL_EVENTS = [
  "account created",
  "workspace created",
  "data source connected",
  "first insight saved",
] as const;

function isSupportedSemanticType(
  value: string,
): value is SupportedSemanticType {
  return (SUPPORTED_SEMANTIC_TYPES as readonly string[]).includes(value);
}

function getEffectiveMapping(
  field: SemanticFieldMapping,
): SemanticMappingValue | null {
  switch (field.resolution.status) {
    case "accepted":
    case "edited":
      return field.resolution.value;
    case "suggested":
      return field.suggestion;
    case "excluded":
    case "unresolved":
      return null;
  }
}

function normalizeCellText(value: DatasetCellValue): string | null {
  if (value === null) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeEventValue(value: DatasetCellValue): string | null {
  return normalizeCellText(value)?.toLocaleLowerCase("en-US") ?? null;
}

const DASHED_CSV_TEMPORAL_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}):(\d{2})(?:\.(\d{3}))?)?$/;
const SLASHED_CSV_TEMPORAL_PATTERN =
  /^(\d{4})\/(\d{2})\/(\d{2})(?: (\d{2}):(\d{2})(?::(\d{2}))?)?$/;

function getCommonCsvDateKey(value: DatasetCellValue): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const text = value.trim();
  const match =
    DASHED_CSV_TEMPORAL_PATTERN.exec(text) ??
    SLASHED_CSV_TEMPORAL_PATTERN.exec(text);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4] ?? 0);
  const minute = Number(match[5] ?? 0);
  const second = Number(match[6] ?? 0);
  const millisecond = Number(match[7] ?? 0);
  const parsed = new Date(0);
  parsed.setUTCFullYear(year, month - 1, day);
  parsed.setUTCHours(hour, minute, second, millisecond);

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day ||
    parsed.getUTCHours() !== hour ||
    parsed.getUTCMinutes() !== minute ||
    parsed.getUTCSeconds() !== second ||
    parsed.getUTCMilliseconds() !== millisecond
  ) {
    return null;
  }

  return [match[1], match[2], match[3]].join("-");
}

function getDateKey(value: DatasetCellValue): string | null {
  const strictTemporalValue = toTemporalValue(value);

  return strictTemporalValue?.slice(0, 10) ?? getCommonCsvDateKey(value);
}

function shiftDate(date: string, days: number): string {
  const timestamp = Date.parse(`${date}T00:00:00.000Z`);
  return new Date(timestamp + days * DAY_IN_MILLISECONDS)
    .toISOString()
    .slice(0, 10);
}

function createDateWindow(end: string, days: number): DateWindow {
  const start = shiftDate(end, -(days - 1));

  return {
    start,
    end,
    label: start === end ? start : `${start} to ${end}`,
  };
}

function isDateInWindow(date: string, window: DateWindow): boolean {
  return date >= window.start && date <= window.end;
}

function createComparison(
  current: number,
  previous: number,
  currentPeriod: string,
  previousPeriod: string,
): DatasetOverviewComparison {
  return {
    previous,
    absoluteChange: current - previous,
    relativeChange: previous === 0 ? null : (current - previous) / previous,
    currentPeriod,
    previousPeriod,
  };
}

function unavailableMetric(
  id: DatasetOverviewMetricId,
  label: string,
  reason: string,
): DatasetOverviewUnavailableMetric {
  return { status: "unavailable", id, label, reason };
}

function validateInput(
  parsedDataset: ParsedDataset,
  semanticSchema: SemanticSchema,
) {
  if (semanticSchema.status !== "confirmed") {
    throw new Error("Dataset analytics requires a confirmed semantic schema.");
  }

  if (
    semanticSchema.physicalSchema.selectedSheetName !==
    parsedDataset.selectedSheetName
  ) {
    throw new Error(
      "The confirmed semantic schema does not match the parsed worksheet.",
    );
  }

  if (semanticSchema.fields.length !== parsedDataset.columns.length) {
    throw new Error(
      "The confirmed semantic schema does not match the parsed columns.",
    );
  }

  const seenIndexes = new Set<number>();

  for (const field of semanticSchema.fields) {
    const column = parsedDataset.columns[field.fieldIndex];

    if (
      !column ||
      seenIndexes.has(field.fieldIndex) ||
      column.index !== field.fieldIndex ||
      column.originalName !== field.originalName
    ) {
      throw new Error(
        "The confirmed semantic schema contains an invalid field mapping.",
      );
    }

    seenIndexes.add(field.fieldIndex);
  }
}

function selectSemanticFields(
  parsedDataset: ParsedDataset,
  semanticSchema: SemanticSchema,
): {
  selections: FieldSelections;
  bindings: DatasetOverviewResult["fieldBindings"];
} {
  validateInput(parsedDataset, semanticSchema);

  const candidates = new Map<SupportedSemanticType, BoundField[]>();

  for (const semanticType of SUPPORTED_SEMANTIC_TYPES) {
    candidates.set(semanticType, []);
  }

  for (const field of semanticSchema.fields) {
    const mapping = getEffectiveMapping(field);

    if (!mapping || !isSupportedSemanticType(mapping.semanticType)) {
      continue;
    }

    candidates.get(mapping.semanticType)!.push({
      semanticType: mapping.semanticType,
      stableFieldKey: field.stableFieldKey,
      originalName: field.originalName,
      fieldIndex: field.fieldIndex,
    });
  }

  const selections = {} as FieldSelections;
  const bindings = {} as DatasetOverviewResult["fieldBindings"];

  for (const semanticType of SUPPORTED_SEMANTIC_TYPES) {
    const matchingFields = candidates.get(semanticType)!;

    if (matchingFields.length === 1) {
      const field = matchingFields[0]!;
      selections[semanticType] = { status: "available", field };
      bindings[semanticType] = {
        stableFieldKey: field.stableFieldKey,
        originalName: field.originalName,
        fieldIndex: field.fieldIndex,
      };
      continue;
    }

    bindings[semanticType] = null;
    selections[semanticType] = {
      status: "unavailable",
      reason:
        matchingFields.length === 0
          ? `No confirmed ${SEMANTIC_TYPE_LABELS[semanticType]} field was found.`
          : `Multiple confirmed ${SEMANTIC_TYPE_LABELS[semanticType]} fields were found.`,
    };
  }

  return { selections, bindings };
}

function requireFields(
  selections: FieldSelections,
  semanticTypes: SupportedSemanticType[],
): BoundField[] | string {
  const selectedFields: BoundField[] = [];

  for (const semanticType of semanticTypes) {
    const selection = selections[semanticType];

    if (selection.status === "unavailable") {
      return selection.reason;
    }

    selectedFields.push(selection.field);
  }

  return selectedFields;
}

function buildActivityIndex(
  parsedDataset: ParsedDataset,
  userField: BoundField,
  timestampField: BoundField,
): ActivityIndex | null {
  const dailyUsers = new Map<string, Set<string>>();
  const userDays = new Map<string, Set<string>>();

  for (const row of parsedDataset.rows) {
    const userId = normalizeCellText(row[userField.fieldIndex] ?? null);
    const date = getDateKey(row[timestampField.fieldIndex] ?? null);

    if (!userId || !date) {
      continue;
    }

    const users = dailyUsers.get(date) ?? new Set<string>();
    users.add(userId);
    dailyUsers.set(date, users);

    const dates = userDays.get(userId) ?? new Set<string>();
    dates.add(date);
    userDays.set(userId, dates);
  }

  const dates = [...dailyUsers.keys()].sort();

  if (dates.length === 0) {
    return null;
  }

  return {
    dailyUsers,
    userDays,
    earliestDate: dates[0]!,
    latestDate: dates.at(-1)!,
  };
}

function calculateDau(
  selections: FieldSelections,
  activityIndex: ActivityIndex | null,
): {
  metric: DatasetOverviewMetric;
  series: DatasetOverviewDailyDau;
} {
  const requiredFields = requireFields(selections, [
    SEMANTIC_TYPE_IDS.userId,
    SEMANTIC_TYPE_IDS.eventTimestamp,
  ]);

  if (typeof requiredFields === "string") {
    return {
      metric: unavailableMetric("dau", "DAU", requiredFields),
      series: { status: "unavailable", reason: requiredFields },
    };
  }

  if (!activityIndex) {
    const reason = "No rows contain both a valid user ID and timestamp.";
    return {
      metric: unavailableMetric("dau", "DAU", reason),
      series: { status: "unavailable", reason },
    };
  }

  const points = [...activityIndex.dailyUsers.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, users]) => ({ date, value: users.size }));
  const currentPoint = points.at(-1)!;
  const previousPoint = points.at(-2);

  return {
    metric: {
      status: "available",
      id: "dau",
      label: "DAU",
      unit: "users",
      current: currentPoint.value,
      currentPeriod: currentPoint.date,
      comparison: previousPoint
        ? createComparison(
            currentPoint.value,
            previousPoint.value,
            currentPoint.date,
            previousPoint.date,
          )
        : null,
      comparisonUnavailableReason: previousPoint
        ? null
        : "A previous active date is not available.",
    },
    series: { status: "available", points },
  };
}

function calculateD1Retention(
  selections: FieldSelections,
  activityIndex: ActivityIndex | null,
): DatasetOverviewMetric {
  const requiredFields = requireFields(selections, [
    SEMANTIC_TYPE_IDS.userId,
    SEMANTIC_TYPE_IDS.eventTimestamp,
  ]);

  if (typeof requiredFields === "string") {
    return unavailableMetric(
      "d1-retention",
      "D1 Retention",
      requiredFields,
    );
  }

  if (!activityIndex) {
    return unavailableMetric(
      "d1-retention",
      "D1 Retention",
      "No rows contain both a valid user ID and timestamp.",
    );
  }

  const cohorts = new Map<string, string[]>();

  for (const [userId, dates] of activityIndex.userDays) {
    const cohortDate = [...dates].sort()[0]!;

    if (shiftDate(cohortDate, 1) > activityIndex.latestDate) {
      continue;
    }

    const users = cohorts.get(cohortDate) ?? [];
    users.push(userId);
    cohorts.set(cohortDate, users);
  }

  const cohortResults = [...cohorts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, users]) => {
      const nextDate = shiftDate(date, 1);
      const retainedUsers = users.filter((userId) =>
        activityIndex.userDays.get(userId)!.has(nextDate),
      ).length;

      return {
        date,
        rate: (retainedUsers / users.length) * 100,
      };
    });

  const currentCohort = cohortResults.at(-1);

  if (!currentCohort) {
    return unavailableMetric(
      "d1-retention",
      "D1 Retention",
      "No cohort has a complete next-day observation window.",
    );
  }

  const previousCohort = cohortResults.at(-2);

  return {
    status: "available",
    id: "d1-retention",
    label: "D1 Retention",
    unit: "percentage",
    current: currentCohort.rate,
    currentPeriod: currentCohort.date,
    comparison: previousCohort
      ? createComparison(
          currentCohort.rate,
          previousCohort.rate,
          currentCohort.date,
          previousCohort.date,
        )
      : null,
    comparisonUnavailableReason: previousCohort
      ? null
      : "A previous complete cohort is not available.",
  };
}

function createConversionRecords(
  parsedDataset: ParsedDataset,
  userField: BoundField,
  valueField: BoundField,
  timestampField: BoundField | null,
): ConversionRecord[] {
  const records: ConversionRecord[] = [];

  parsedDataset.rows.forEach((row, rowIndex) => {
    const userId = normalizeCellText(row[userField.fieldIndex] ?? null);
    const value = normalizeEventValue(row[valueField.fieldIndex] ?? null);

    if (!userId || !value) {
      return;
    }

    records.push({
      userId,
      value,
      date: timestampField
        ? getDateKey(row[timestampField.fieldIndex] ?? null)
        : null,
      rowIndex,
    });
  });

  return records;
}

function findConversionDefinition(
  parsedDataset: ParsedDataset,
  selections: FieldSelections,
): ConversionDefinition | string {
  const userSelection = selections[SEMANTIC_TYPE_IDS.userId];

  if (userSelection.status === "unavailable") {
    return userSelection.reason;
  }

  const timestampSelection = selections[SEMANTIC_TYPE_IDS.eventTimestamp];
  const timestampField =
    timestampSelection.status === "available" ? timestampSelection.field : null;
  const eventSelection = selections[SEMANTIC_TYPE_IDS.eventName];

  if (eventSelection.status === "available") {
    const records = createConversionRecords(
      parsedDataset,
      userSelection.field,
      eventSelection.field,
      timestampField,
    );
    const values = new Set(records.map((record) => record.value));

    if (DEMO_FUNNEL_EVENTS.every((eventName) => values.has(eventName))) {
      return {
        first: DEMO_FUNNEL_EVENTS[0],
        final: DEMO_FUNNEL_EVENTS.at(-1)!,
        records,
      };
    }
  }

  const funnelSelection = selections[SEMANTIC_TYPE_IDS.funnelStep];

  if (funnelSelection.status === "unavailable") {
    return "The fixed demo funnel events were not found, and no confirmed funnel-step field is available.";
  }

  const records = createConversionRecords(
    parsedDataset,
    userSelection.field,
    funnelSelection.field,
    timestampField,
  );
  const orderedSteps = [
    ...new Map(
      records
        .sort((left, right) => left.rowIndex - right.rowIndex)
        .map((record) => [record.value, record.value]),
    ).values(),
  ];

  if (orderedSteps.length < 2) {
    return "The confirmed funnel-step field contains fewer than two non-empty steps.";
  }

  return {
    first: orderedSteps[0]!,
    final: orderedSteps.at(-1)!,
    records,
  };
}

function calculateConversionRate(
  definition: ConversionDefinition,
  window: DateWindow | null,
): { rate: number; firstUserCount: number } | null {
  const records = window
    ? definition.records.filter(
        (record) => record.date && isDateInWindow(record.date, window),
      )
    : definition.records;
  const firstUsers = new Set(
    records
      .filter((record) => record.value === definition.first)
      .map((record) => record.userId),
  );

  if (firstUsers.size === 0) {
    return null;
  }

  const finalUsers = new Set(
    records
      .filter(
        (record) =>
          record.value === definition.final && firstUsers.has(record.userId),
      )
      .map((record) => record.userId),
  );

  return {
    rate: (finalUsers.size / firstUsers.size) * 100,
    firstUserCount: firstUsers.size,
  };
}

function calculateCoreConversion(
  parsedDataset: ParsedDataset,
  selections: FieldSelections,
): DatasetOverviewMetric {
  const definition = findConversionDefinition(parsedDataset, selections);

  if (typeof definition === "string") {
    return unavailableMetric(
      "core-conversion",
      "Core Conversion",
      definition,
    );
  }

  const validDates = definition.records
    .map((record) => record.date)
    .filter((date): date is string => Boolean(date))
    .sort();

  if (validDates.length === 0) {
    const result = calculateConversionRate(definition, null);

    if (!result) {
      return unavailableMetric(
        "core-conversion",
        "Core Conversion",
        "No users completed the first funnel step.",
      );
    }

    return {
      status: "available",
      id: "core-conversion",
      label: "Core Conversion",
      unit: "percentage",
      current: result.rate,
      currentPeriod: "Entire dataset",
      comparison: null,
      comparisonUnavailableReason:
        "A confirmed event-timestamp field is required for period comparison.",
    };
  }

  const earliestDate = validDates[0]!;
  const latestDate = validDates.at(-1)!;
  const currentWindow = createDateWindow(latestDate, 7);
  const previousWindow = createDateWindow(shiftDate(currentWindow.start, -1), 7);
  const current = calculateConversionRate(definition, currentWindow);

  if (!current) {
    return unavailableMetric(
      "core-conversion",
      "Core Conversion",
      "No users completed the first funnel step in the latest seven-day period.",
    );
  }

  const hasCompletePreviousWindow = earliestDate <= previousWindow.start;
  const previous = hasCompletePreviousWindow
    ? calculateConversionRate(definition, previousWindow)
    : null;

  return {
    status: "available",
    id: "core-conversion",
    label: "Core Conversion",
    unit: "percentage",
    current: current.rate,
    currentPeriod: currentWindow.label,
    comparison: previous
      ? createComparison(
          current.rate,
          previous.rate,
          currentWindow.label,
          previousWindow.label,
        )
      : null,
    comparisonUnavailableReason: previous
      ? null
      : hasCompletePreviousWindow
        ? "No users completed the first funnel step in the previous period."
        : "The dataset does not cover the preceding seven-day period.",
  };
}

function calculateFeedback(
  parsedDataset: ParsedDataset,
  selections: FieldSelections,
): DatasetOverviewMetric {
  const selection = selections[SEMANTIC_TYPE_IDS.feedbackText];

  if (selection.status === "unavailable") {
    return unavailableMetric("feedback", "Feedback", selection.reason);
  }

  const feedbackCount = parsedDataset.rows.reduce(
    (count, row) =>
      normalizeCellText(row[selection.field.fieldIndex] ?? null)
        ? count + 1
        : count,
    0,
  );

  return {
    status: "available",
    id: "feedback",
    label: "Feedback",
    unit: "rows",
    current: feedbackCount,
    currentPeriod: "Entire dataset",
    comparison: null,
    comparisonUnavailableReason:
      "Feedback is a full-dataset count without a period comparison.",
  };
}

function formatEvidenceValue(value: number, unit: "percentage" | "users") {
  return unit === "percentage"
    ? `${value.toFixed(1)}%`
    : `${value.toFixed(1)} users`;
}

function anomalyFromMetric(
  metric: DatasetOverviewMetric,
  thresholdPoints: number,
): DatasetOverviewAnomaly | null {
  if (
    metric.status !== "available" ||
    metric.unit !== "percentage" ||
    !metric.comparison ||
    metric.comparison.absoluteChange > -thresholdPoints
  ) {
    return null;
  }

  const anomalyMetric =
    metric.id === "d1-retention" ? "D1 Retention" : "Core Conversion";

  return {
    source: "dataset",
    metric: anomalyMetric,
    unit: "percentage",
    current: metric.current,
    previous: metric.comparison.previous,
    change: {
      absolute: metric.comparison.absoluteChange,
      relative: metric.comparison.relativeChange,
    },
    period: {
      current: metric.comparison.currentPeriod,
      previous: metric.comparison.previousPeriod,
    },
    evidenceSummary: `${anomalyMetric} declined from ${formatEvidenceValue(metric.comparison.previous, "percentage")} to ${formatEvidenceValue(metric.current, "percentage")} (${Math.abs(metric.comparison.absoluteChange).toFixed(1)} percentage points).`,
  };
}

function averageDau(
  dailyUsers: Map<string, Set<string>>,
  window: DateWindow,
): number {
  let total = 0;

  for (let offset = 0; offset < 7; offset += 1) {
    const date = shiftDate(window.start, offset);
    total += dailyUsers.get(date)?.size ?? 0;
  }

  return total / 7;
}

function findDauAnomaly(
  activityIndex: ActivityIndex | null,
): DatasetOverviewAnomaly | null {
  if (!activityIndex) {
    return null;
  }

  const currentWindow = createDateWindow(activityIndex.latestDate, 7);
  const previousWindow = createDateWindow(shiftDate(currentWindow.start, -1), 7);

  if (activityIndex.earliestDate > previousWindow.start) {
    return null;
  }

  const current = averageDau(activityIndex.dailyUsers, currentWindow);
  const previous = averageDau(activityIndex.dailyUsers, previousWindow);
  const relativeChange = previous === 0 ? null : (current - previous) / previous;

  if (relativeChange === null || relativeChange > -DAU_DECLINE_THRESHOLD_RATIO) {
    return null;
  }

  return {
    source: "dataset",
    metric: "DAU",
    unit: "users",
    current,
    previous,
    change: {
      absolute: current - previous,
      relative: relativeChange,
    },
    period: {
      current: currentWindow.label,
      previous: previousWindow.label,
    },
    evidenceSummary: `Average DAU declined from ${formatEvidenceValue(previous, "users")} to ${formatEvidenceValue(current, "users")} (${Math.abs(relativeChange * 100).toFixed(1)}%).`,
  };
}

function findPrimaryAnomaly(
  d1Retention: DatasetOverviewMetric,
  coreConversion: DatasetOverviewMetric,
  activityIndex: ActivityIndex | null,
): DatasetOverviewAnomaly | null {
  return (
    anomalyFromMetric(d1Retention, D1_DECLINE_THRESHOLD_POINTS) ??
    anomalyFromMetric(coreConversion, CONVERSION_DECLINE_THRESHOLD_POINTS) ??
    findDauAnomaly(activityIndex)
  );
}

export function createDatasetOverview(
  parsedDataset: ParsedDataset,
  semanticSchema: SemanticSchema,
): DatasetOverviewResult {
  const { selections, bindings } = selectSemanticFields(
    parsedDataset,
    semanticSchema,
  );
  const activityFields = requireFields(selections, [
    SEMANTIC_TYPE_IDS.userId,
    SEMANTIC_TYPE_IDS.eventTimestamp,
  ]);
  const activityIndex =
    typeof activityFields === "string"
      ? null
      : buildActivityIndex(
          parsedDataset,
          activityFields[0]!,
          activityFields[1]!,
        );
  const dau = calculateDau(selections, activityIndex);
  const d1Retention = calculateD1Retention(selections, activityIndex);
  const coreConversion = calculateCoreConversion(parsedDataset, selections);
  const feedback = calculateFeedback(parsedDataset, selections);

  return {
    version: 1,
    source: "dataset",
    rowCount: parsedDataset.rowCount,
    selectedSheetName: parsedDataset.selectedSheetName,
    fieldBindings: bindings,
    metrics: {
      dau: dau.metric,
      d1Retention,
      coreConversion,
      feedback,
    },
    dailyDau: dau.series,
    primaryAnomaly: findPrimaryAnomaly(
      d1Retention,
      coreConversion,
      activityIndex,
    ),
  };
};
