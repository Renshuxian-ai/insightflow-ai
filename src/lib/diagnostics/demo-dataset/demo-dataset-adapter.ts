import { parse } from "csv-parse/browser/esm/sync";

import type {
  DemoDiagnosticDataset,
  DemoEventRow,
  DemoFeedbackRow,
  DemoMetricRow,
  DemoReleaseRow,
  DemoUserRow,
} from "./types";

type CsvRecord = Record<string, string>;

const DEMO_DATASET_URLS = {
  users: "/demo-data/users.csv",
  events: "/demo-data/events.csv",
  metrics: "/demo-data/metrics.csv",
  feedback: "/demo-data/feedback.csv",
  releases: "/demo-data/releases.csv",
} as const;

const REQUIRED_COLUMNS = {
  users: [
    "user_id",
    "platform",
    "version",
    "country",
    "channel",
    "user_type",
  ],
  events: ["user_id", "event_name", "timestamp", "platform", "version"],
  metrics: ["date", "metric_name", "segment", "value"],
  feedback: ["feedback_id", "user_id", "category", "sentiment", "text"],
  releases: ["version", "release_date", "change"],
} as const;

function parseCsvRecords(
  fileLabel: string,
  text: string,
  requiredColumns: readonly string[],
): CsvRecord[] {
  let records: CsvRecord[];

  try {
    records = parse(text, {
      bom: true,
      columns: true,
      skip_empty_lines: true,
      relax_column_count: false,
      trim: true,
    });
  } catch {
    throw new Error(`${fileLabel} could not be parsed as CSV.`);
  }

  if (records.length === 0) {
    throw new Error(`${fileLabel} does not contain any data rows.`);
  }

  const availableColumns = new Set(Object.keys(records[0]!));
  const missingColumns = requiredColumns.filter(
    (column) => !availableColumns.has(column),
  );

  if (missingColumns.length > 0) {
    throw new Error(
      `${fileLabel} is missing required columns: ${missingColumns.join(", ")}.`,
    );
  }

  return records;
}

function requireText(
  record: CsvRecord,
  field: string,
  fileLabel: string,
  rowIndex: number,
): string {
  const value = record[field]?.trim();

  if (!value) {
    throw new Error(
      `${fileLabel} row ${rowIndex + 2} has an empty ${field} value.`,
    );
  }

  return value;
}

function requireNumber(
  record: CsvRecord,
  field: string,
  fileLabel: string,
  rowIndex: number,
): number {
  const text = requireText(record, field, fileLabel, rowIndex);
  const value = Number(text);

  if (!Number.isFinite(value)) {
    throw new Error(
      `${fileLabel} row ${rowIndex + 2} has an invalid ${field} value.`,
    );
  }

  return value;
}

function requireDate(
  record: CsvRecord,
  field: string,
  fileLabel: string,
  rowIndex: number,
): string {
  const value = requireText(record, field, fileLabel, rowIndex);

  if (Number.isNaN(Date.parse(value))) {
    throw new Error(
      `${fileLabel} row ${rowIndex + 2} has an invalid ${field} value.`,
    );
  }

  return value;
}

function parseUsers(text: string): DemoUserRow[] {
  return parseCsvRecords("users.csv", text, REQUIRED_COLUMNS.users).map(
    (record, index) => ({
      userId: requireText(record, "user_id", "users.csv", index),
      platform: requireText(record, "platform", "users.csv", index),
      version: requireText(record, "version", "users.csv", index),
      country: requireText(record, "country", "users.csv", index),
      channel: requireText(record, "channel", "users.csv", index),
      userType: requireText(record, "user_type", "users.csv", index),
    }),
  );
}

function parseEvents(text: string): DemoEventRow[] {
  return parseCsvRecords("events.csv", text, REQUIRED_COLUMNS.events).map(
    (record, index) => ({
      userId: requireText(record, "user_id", "events.csv", index),
      eventName: requireText(record, "event_name", "events.csv", index),
      timestamp: requireDate(record, "timestamp", "events.csv", index),
      platform: requireText(record, "platform", "events.csv", index),
      version: requireText(record, "version", "events.csv", index),
    }),
  );
}

function parseMetrics(text: string): DemoMetricRow[] {
  return parseCsvRecords("metrics.csv", text, REQUIRED_COLUMNS.metrics).map(
    (record, index) => ({
      date: requireDate(record, "date", "metrics.csv", index),
      metricName: requireText(record, "metric_name", "metrics.csv", index),
      segment: requireText(record, "segment", "metrics.csv", index),
      value: requireNumber(record, "value", "metrics.csv", index),
    }),
  );
}

function parseFeedback(text: string): DemoFeedbackRow[] {
  return parseCsvRecords(
    "feedback.csv",
    text,
    REQUIRED_COLUMNS.feedback,
  ).map((record, index) => ({
    feedbackId: requireText(record, "feedback_id", "feedback.csv", index),
    userId: requireText(record, "user_id", "feedback.csv", index),
    category: requireText(record, "category", "feedback.csv", index),
    sentiment: requireText(record, "sentiment", "feedback.csv", index),
    text: requireText(record, "text", "feedback.csv", index),
  }));
}

function parseReleases(text: string): DemoReleaseRow[] {
  return parseCsvRecords(
    "releases.csv",
    text,
    REQUIRED_COLUMNS.releases,
  ).map((record, index) => ({
    version: requireText(record, "version", "releases.csv", index),
    releaseDate: requireDate(record, "release_date", "releases.csv", index),
    change: requireText(record, "change", "releases.csv", index),
  }));
}

async function fetchDemoCsv(url: string, signal?: AbortSignal) {
  const response = await fetch(url, { signal });

  if (!response.ok) {
    throw new Error(`Could not load ${url.split("/").at(-1) ?? "demo data"}.`);
  }

  return response.text();
}

function validateReferences(dataset: DemoDiagnosticDataset) {
  const userIds = new Set(dataset.users.map((user) => user.userId));
  const unknownEventUser = dataset.events.find(
    (event) => !userIds.has(event.userId),
  );
  const unknownFeedbackUser = dataset.feedback.find(
    (feedback) => !userIds.has(feedback.userId),
  );

  if (unknownEventUser) {
    throw new Error("events.csv contains a user_id not found in users.csv.");
  }

  if (unknownFeedbackUser) {
    throw new Error("feedback.csv contains a user_id not found in users.csv.");
  }
}

export async function loadDemoDiagnosticDataset(
  signal?: AbortSignal,
): Promise<DemoDiagnosticDataset> {
  const [usersCsv, eventsCsv, metricsCsv, feedbackCsv, releasesCsv] =
    await Promise.all([
      fetchDemoCsv(DEMO_DATASET_URLS.users, signal),
      fetchDemoCsv(DEMO_DATASET_URLS.events, signal),
      fetchDemoCsv(DEMO_DATASET_URLS.metrics, signal),
      fetchDemoCsv(DEMO_DATASET_URLS.feedback, signal),
      fetchDemoCsv(DEMO_DATASET_URLS.releases, signal),
    ]);
  const dataset: DemoDiagnosticDataset = {
    users: parseUsers(usersCsv),
    events: parseEvents(eventsCsv),
    metrics: parseMetrics(metricsCsv),
    feedback: parseFeedback(feedbackCsv),
    releases: parseReleases(releasesCsv),
  };

  validateReferences(dataset);
  return dataset;
}
