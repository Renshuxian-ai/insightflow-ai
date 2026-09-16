import type {
  AnalyticsActivityInvestigationContext,
  AnalyticsFeedbackInvestigationContext,
  AnalyticsFunnelInvestigationContext,
  AnalyticsInvestigationContext,
  AnalyticsRetentionInvestigationContext,
  AnalyticsRetentionInterval,
} from "./investigation-context";

type JsonRecord = Record<string, unknown>;

const MAX_CONTEXT_LENGTH = 20_000;
const RETENTION_INTERVALS: readonly AnalyticsRetentionInterval[] = [
  "D0",
  "D1",
  "D3",
  "D7",
  "D14",
  "D30",
];

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasOnlyKeys(value: JsonRecord, allowedKeys: readonly string[]) {
  return Object.keys(value).every((key) => allowedKeys.includes(key));
}

function isString(value: unknown, maximumLength: number) {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= maximumLength
  );
}

function isUserCount(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function isRetentionRate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
}

function isGap(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= -100 &&
    value <= 100
  );
}

function isFiniteChange(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > -100 &&
    value <= 10_000
  );
}

function isConsistentGap(current: number, baseline: number, gap: number) {
  return Math.abs(current - baseline - gap) < 0.001;
}

function isDatasetEvidence(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, [
      "datasetId",
      "source",
      "quality",
      "method",
      "limitations",
    ]) &&
    isString(value.datasetId, 240) &&
    value.source === "uploaded-dataset" &&
    (value.quality === "observed" ||
      value.quality === "estimated" ||
      value.quality === "mixed") &&
    isString(value.method, 500) &&
    Array.isArray(value.limitations) &&
    value.limitations.length <= 8 &&
    value.limitations.every((limitation) => isString(limitation, 500))
  );
}

function isActivityInvestigationContext(
  value: unknown,
): value is AnalyticsActivityInvestigationContext {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ["surface", "signalId", "activity", "datasetEvidence"]) &&
    value.surface === "activity" &&
    isString(value.signalId, 240) &&
    isRecord(value.activity) &&
    hasOnlyKeys(value.activity, [
      "metric",
      "currentValue",
      "baselineValue",
      "gap",
      "currentPeriod",
      "previousPeriod",
      "affectedUsers",
    ]) &&
    value.activity.metric === "daily_active_users" &&
    isFiniteChange(value.activity.currentValue) &&
    isFiniteChange(value.activity.baselineValue) &&
    isFiniteChange(value.activity.gap) &&
    isConsistentGap(
      value.activity.currentValue,
      value.activity.baselineValue,
      value.activity.gap,
    ) &&
    isString(value.activity.currentPeriod, 120) &&
    isString(value.activity.previousPeriod, 120) &&
    isUserCount(value.activity.affectedUsers) &&
    (value.datasetEvidence === undefined || isDatasetEvidence(value.datasetEvidence))
  );
}

function isRetentionInterval(
  value: unknown,
): value is AnalyticsRetentionInterval {
  return (
    typeof value === "string" &&
    RETENTION_INTERVALS.includes(value as AnalyticsRetentionInterval)
  );
}

function isRetentionValues(value: unknown): value is {
  D1: number;
  D7: number;
  D30: number;
} {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ["D1", "D7", "D30"]) &&
    isRetentionRate(value.D1) &&
    isRetentionRate(value.D7) &&
    isRetentionRate(value.D30)
  );
}

function isSelectedCohort(
  value: unknown,
): value is AnalyticsRetentionInvestigationContext["selectedCohort"] {
  return (
    value === null ||
    (isRecord(value) &&
      hasOnlyKeys(value, ["date", "users"]) &&
      isString(value.date, 64) &&
      isUserCount(value.users))
  );
}

function isSegmentEvidence(
  value: unknown,
): value is AnalyticsRetentionInvestigationContext["segmentEvidence"] {
  return (
    value === null ||
    (isRecord(value) &&
      hasOnlyKeys(value, [
        "dimension",
        "segment",
        "users",
        "retention",
        "comparisonSegment",
        "comparisonRetention",
      ]) &&
      isString(value.dimension, 80) &&
      isString(value.segment, 120) &&
      isUserCount(value.users) &&
      isRetentionValues(value.retention) &&
      isString(value.comparisonSegment, 120) &&
      isRetentionValues(value.comparisonRetention))
  );
}

function isMetricInterval(
  value: unknown,
): value is AnalyticsRetentionInvestigationContext["metricEvidence"]["intervals"][number] {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, [
      "interval",
      "currentRate",
      "currentRetainedUsers",
      "baselineRate",
      "baselineRetainedUsers",
      "gapPercentagePoints",
    ]) &&
    isRetentionInterval(value.interval) &&
    isRetentionRate(value.currentRate) &&
    isUserCount(value.currentRetainedUsers) &&
    isRetentionRate(value.baselineRate) &&
    isUserCount(value.baselineRetainedUsers) &&
    isGap(value.gapPercentagePoints) &&
    isConsistentGap(
      value.currentRate,
      value.baselineRate,
      value.gapPercentagePoints,
    )
  );
}

function isMetricEvidence(
  value: unknown,
): value is AnalyticsRetentionInvestigationContext["metricEvidence"] {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "metric",
      "event",
      "returningEvent",
      "period",
      "window",
      "intervals",
    ]) ||
    value.metric !== "retention" ||
    !isString(value.event, 240) ||
    !isString(value.returningEvent, 240) ||
    !isString(value.period, 120) ||
    !isString(value.window, 120) ||
    !Array.isArray(value.intervals) ||
    value.intervals.length < 1 ||
    value.intervals.length > RETENTION_INTERVALS.length ||
    !value.intervals.every(isMetricInterval)
  ) {
    return false;
  }

  const intervalNames = value.intervals.map((interval) => interval.interval);

  return new Set(intervalNames).size === intervalNames.length;
}

function isInvestigationTarget(
  value: unknown,
): value is NonNullable<
  AnalyticsRetentionInvestigationContext["investigationTarget"]
> {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ["id", "title", "relatedSegment", "sourceSurface"]) &&
    isString(value.id, 240) &&
    isString(value.title, 500) &&
    isString(value.relatedSegment, 240) &&
    value.sourceSurface === "retention"
  );
}

function isRetentionInvestigationContext(
  value: unknown,
): value is AnalyticsRetentionInvestigationContext {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "surface",
      "signalId",
      "selectedCohort",
      "selectedInterval",
      "segmentEvidence",
      "metricEvidence",
      "investigationTarget",
      "datasetEvidence",
    ]) ||
    value.surface !== "retention" ||
    !isString(value.signalId, 240) ||
    !isSelectedCohort(value.selectedCohort) ||
    (value.selectedInterval !== null &&
      !isRetentionInterval(value.selectedInterval)) ||
    !isSegmentEvidence(value.segmentEvidence) ||
    !isMetricEvidence(value.metricEvidence) ||
    (value.investigationTarget !== undefined &&
      !isInvestigationTarget(value.investigationTarget)) ||
    (value.datasetEvidence !== undefined &&
      !isDatasetEvidence(value.datasetEvidence))
  ) {
    return false;
  }

  return (
    (value.investigationTarget === undefined ||
      value.investigationTarget.sourceSurface === value.surface) &&
    (value.selectedInterval === null ||
      value.metricEvidence.intervals.some(
        (interval) => interval.interval === value.selectedInterval,
      ))
  );
}

function isFunnelStep(
  value: unknown,
): value is AnalyticsFunnelInvestigationContext["funnelStepTransition"]["from"] {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ["eventName", "label"]) &&
    isString(value.eventName, 160) &&
    isString(value.label, 240)
  );
}

function isFunnelStepTransition(
  value: unknown,
): value is AnalyticsFunnelInvestigationContext["funnelStepTransition"] {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ["from", "to"]) &&
    isFunnelStep(value.from) &&
    isFunnelStep(value.to) &&
    value.from.eventName !== value.to.eventName
  );
}

function isAvailableFunnelTransition(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, [
      "funnelName",
      "fromStep",
      "toStep",
      "completionRate",
      "dropOffUsers",
    ]) &&
    isString(value.funnelName, 240) &&
    isString(value.fromStep, 240) &&
    isString(value.toStep, 240) &&
    value.fromStep !== value.toStep &&
    isRetentionRate(value.completionRate) &&
    isUserCount(value.dropOffUsers)
  );
}

function isFunnelInvestigationContext(
  value: unknown,
): value is AnalyticsFunnelInvestigationContext {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, [
      "surface",
      "signalId",
      "funnelStepTransition",
      "currentVersion",
      "previousVersion",
      "currentCompletionRate",
      "baselineCompletionRate",
      "gap",
      "dropOffUsers",
      "funnelName",
      "availableTransitions",
      "datasetEvidence",
    ]) &&
    value.surface === "funnel" &&
    isString(value.signalId, 240) &&
    isFunnelStepTransition(value.funnelStepTransition) &&
    isString(value.currentVersion, 120) &&
    isString(value.previousVersion, 120) &&
    value.currentVersion !== value.previousVersion &&
    isRetentionRate(value.currentCompletionRate) &&
    isRetentionRate(value.baselineCompletionRate) &&
    isGap(value.gap) &&
    isConsistentGap(
      value.currentCompletionRate,
      value.baselineCompletionRate,
      value.gap,
    ) &&
    isUserCount(value.dropOffUsers) &&
    (value.funnelName === undefined || isString(value.funnelName, 240)) &&
    (value.availableTransitions === undefined ||
      (Array.isArray(value.availableTransitions) &&
        value.availableTransitions.length >= 1 &&
        value.availableTransitions.length <= 100 &&
        value.availableTransitions.every(isAvailableFunnelTransition))) &&
    (value.datasetEvidence === undefined ||
      isDatasetEvidence(value.datasetEvidence))
  );
}

function isFeedbackTopic(
  value: unknown,
): value is AnalyticsFeedbackInvestigationContext["topic"] {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, [
      "name",
      "mentions",
      "change",
      "sentiment",
      "trendStatus",
    ]) &&
    isString(value.name, 240) &&
    isUserCount(value.mentions) &&
    value.mentions > 0 &&
    (value.change === null || isFiniteChange(value.change)) &&
    (value.sentiment === "negative" || value.sentiment === "mixed") &&
    (value.trendStatus === undefined ||
      value.trendStatus === "available" ||
      value.trendStatus === "unavailable") &&
    (value.trendStatus !== "available" || value.change !== null) &&
    (value.trendStatus !== "unavailable" || value.change === null)
  );
}

function isFeedbackQuotes(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length >= 1 &&
    value.length <= 8 &&
    value.every((quote) => isString(quote, 500))
  );
}

function isFeedbackRelatedSignal(
  value: unknown,
): value is AnalyticsFeedbackInvestigationContext["relatedSignal"] {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ["name", "change"]) &&
    isString(value.name, 240) &&
    isFiniteChange(value.change)
  );
}

function isFeedbackInvestigationContext(
  value: unknown,
): value is AnalyticsFeedbackInvestigationContext {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, [
      "surface",
      "signalId",
      "topic",
      "affectedSegment",
      "evidenceQuotes",
      "relatedSignal",
      "datasetEvidence",
    ]) &&
    value.surface === "feedback" &&
    isString(value.signalId, 240) &&
    isFeedbackTopic(value.topic) &&
    isString(value.affectedSegment, 240) &&
    isFeedbackQuotes(value.evidenceQuotes) &&
    (value.relatedSignal === null ||
      isFeedbackRelatedSignal(value.relatedSignal)) &&
    (value.datasetEvidence === undefined ||
      isDatasetEvidence(value.datasetEvidence))
  );
}

function isAnalyticsInvestigationContext(
  value: unknown,
): value is AnalyticsInvestigationContext {
  if (!isRecord(value)) {
    return false;
  }

  if (value.surface === "retention") {
    return isRetentionInvestigationContext(value);
  }

  if (value.surface === "activity") {
    return isActivityInvestigationContext(value);
  }

  if (value.surface === "funnel") {
    return isFunnelInvestigationContext(value);
  }

  if (value.surface === "feedback") {
    return isFeedbackInvestigationContext(value);
  }

  return false;
}

function parseJson(value: string): unknown {
  const candidates = [value];

  try {
    const decoded = decodeURIComponent(value);

    if (decoded !== value) {
      candidates.push(decoded);
    }
  } catch {
    // The App Router normally supplies an already-decoded query value.
  }

  for (const candidate of candidates) {
    if (candidate.length > MAX_CONTEXT_LENGTH) {
      continue;
    }

    try {
      return JSON.parse(candidate);
    } catch {
      // Try the next safe representation, then fall back to the existing route.
    }
  }

  return null;
}

export function parseAnalyticsInvestigationContext(
  value: string | string[] | undefined,
): AnalyticsInvestigationContext | null {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }

  const parsed = parseJson(value);

  return isAnalyticsInvestigationContext(parsed) ? parsed : null;
}
