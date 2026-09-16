import type {
  SemanticFieldMapping,
  SemanticMappingValue,
  SemanticSchema,
  SemanticSuggestion,
} from "../datasets/semantic/types";
import type { ParsedDataset } from "../datasets/server/parsers/types";
import type { DatasetCellValue } from "../datasets/types";
import { createDatasetOverview } from "./dataset-overview";

const columns = [
  "user_id",
  "event_timestamp",
  "event_name",
  "feedback_text",
  "sentiment",
  "funnel_step",
];

const mappingValues = {
  userId: {
    semanticRole: "identifier",
    semanticType: "user-id",
    businessMeaning: "Product user",
  },
  eventTimestamp: {
    semanticRole: "time",
    semanticType: "event-timestamp",
    businessMeaning: "Event timestamp",
  },
  eventName: {
    semanticRole: "dimension",
    semanticType: "event-name",
    businessMeaning: "Product event",
  },
  feedbackText: {
    semanticRole: "text",
    semanticType: "feedback-text",
    businessMeaning: "User feedback",
  },
  sentiment: {
    semanticRole: "classification",
    semanticType: "sentiment",
    businessMeaning: "Feedback sentiment",
  },
  funnelStep: {
    semanticRole: "dimension",
    semanticType: "funnel-step",
    businessMeaning: "Funnel step",
  },
} as const satisfies Record<string, SemanticMappingValue>;

function createSuggestion(
  stableFieldKey: string,
  value: SemanticMappingValue,
): SemanticSuggestion {
  return {
    id: `suggestion-${stableFieldKey}`,
    stableFieldKey,
    ...value,
    semanticConfidence: 0.99,
    inferenceSource: "heuristic",
    explanation: "Fixture suggestion.",
    alternatives: [],
    ambiguity: null,
  };
}

function createSuggestedField(
  fieldIndex: number,
  value: SemanticMappingValue,
): SemanticFieldMapping {
  const stableFieldKey = `fixture-field-${fieldIndex}`;

  return {
    fieldId: `fixture:${fieldIndex}`,
    stableFieldKey,
    fieldIndex,
    originalName: columns[fieldIndex]!,
    suggestion: createSuggestion(stableFieldKey, value),
    resolution: { status: "suggested" },
  };
}

function createFixtureSchema(): SemanticSchema {
  const userField = createSuggestedField(0, mappingValues.eventName);
  const timestampField = createSuggestedField(1, mappingValues.eventTimestamp);
  const eventField = createSuggestedField(2, mappingValues.eventName);
  const feedbackField = createSuggestedField(3, mappingValues.eventName);
  const sentimentField = createSuggestedField(4, mappingValues.sentiment);
  const funnelField = createSuggestedField(5, mappingValues.funnelStep);

  return {
    id: "fixture-semantic-schema",
    physicalSchema: {
      datasetId: "fixture-dataset",
      physicalSchemaVersion: 1,
      schemaFingerprint: "fixture-fingerprint",
      selectedSheetName: null,
    },
    semanticSchemaVersion: 3,
    status: "confirmed",
    retention: "session-only",
    fields: [
      {
        ...userField,
        resolution: {
          status: "edited",
          sourceSuggestionId: userField.suggestion!.id,
          value: mappingValues.userId,
          note: "Human-corrected fixture field.",
        },
      },
      timestampField,
      {
        ...eventField,
        resolution: {
          status: "accepted",
          acceptedSuggestionId: eventField.suggestion!.id,
          value: mappingValues.eventName,
          note: null,
        },
      },
      {
        ...feedbackField,
        resolution: {
          status: "edited",
          sourceSuggestionId: feedbackField.suggestion!.id,
          value: mappingValues.feedbackText,
          note: null,
        },
      },
      {
        ...sentimentField,
        resolution: {
          status: "excluded",
          reason: "Not used in this fixture.",
        },
      },
      funnelField,
    ],
  };
}

function fixtureTimestamp(day: number): string {
  return `2026-01-${String(day).padStart(2, "0")}T12:00:00.000Z`;
}

function createFixtureRows(): DatasetCellValue[][] {
  const rows: DatasetCellValue[][] = [];

  for (let day = 1; day <= 16; day += 1) {
    rows.push([
      "always-active",
      fixtureTimestamp(day),
      "Session active",
      day === 5
        ? "Search results were not relevant."
        : day === 12
          ? "The onboarding flow was clear."
          : null,
      day === 5 ? "negative" : day === 12 ? "positive" : null,
      null,
    ]);
  }

  for (const userId of ["previous-1", "previous-2"]) {
    rows.push([userId, fixtureTimestamp(3), "Account created", null, null, null]);
    rows.push([userId, fixtureTimestamp(4), "Workspace created", null, null, null]);
    rows.push([userId, fixtureTimestamp(5), "Data source connected", null, null, null]);
    rows.push([userId, fixtureTimestamp(6), "First insight saved", null, null, null]);
  }

  for (const userId of ["current-1", "current-2"]) {
    rows.push([userId, fixtureTimestamp(10), "Account created", null, null, null]);
    rows.push([userId, fixtureTimestamp(11), "Workspace created", null, null, null]);
    rows.push([userId, fixtureTimestamp(12), "Data source connected", null, null, null]);
  }

  rows.push([
    "current-1",
    fixtureTimestamp(13),
    "First insight saved",
    null,
    null,
    null,
  ]);

  for (const userId of ["previous-cohort-1", "previous-cohort-2"]) {
    rows.push([userId, fixtureTimestamp(14), "Session active", null, null, null]);
    rows.push([userId, fixtureTimestamp(15), "Session active", null, null, null]);
  }

  rows.push(["latest-cohort-1", fixtureTimestamp(15), "Session active", null, null, null]);
  rows.push(["latest-cohort-2", fixtureTimestamp(15), "Session active", null, null, null]);
  rows.push(["latest-cohort-1", fixtureTimestamp(16), "Session active", null, null, null]);

  return rows;
}

function createFixtureDataset(): ParsedDataset {
  const rows = createFixtureRows();

  return {
    columns: columns.map((name, index) => ({
      index,
      originalName: name,
      displayName: name,
    })),
    rows,
    rowCount: rows.length,
    selectedSheetName: null,
    availableSheetNames: [],
    headerRowIndex: 1,
    warnings: [],
  };
}

function createDateParsingFixtureDataset(): ParsedDataset {
  const dataset = createFixtureDataset();
  const timestamps = [
    "2026-02-01",
    "2026-02-02 01:02:03",
    "2026-02-03 01:02:03.123",
    "2026/2/4",
    "2026/2/5 1:02:03",
    "2026/2/6 1:02",
    "2026-02-30 01:02:03",
    "not-a-date",
  ];
  const rows = timestamps.map((timestamp, index) => [
    `date-user-${index}`,
    timestamp,
    null,
    null,
    null,
    null,
  ]);

  return {
    ...dataset,
    rows,
    rowCount: rows.length,
  };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertApproximately(
  actual: number,
  expected: number,
  message: string,
) {
  assert(Math.abs(actual - expected) < 0.000_001, message);
}

export function runDatasetOverviewFixtures() {
  const dataset = createFixtureDataset();
  const schema = createFixtureSchema();
  const result = createDatasetOverview(dataset, schema);

  assert(result.metrics.dau.status === "available", "DAU should be available.");
  assert(result.metrics.dau.current === 2, "Latest DAU should equal 2.");
  assert(
    result.metrics.dau.comparison?.previous === 5,
    "Previous active-day DAU should equal 5.",
  );
  assert(
    result.dailyDau.status === "available" && result.dailyDau.points.length === 16,
    "The daily DAU series should contain all 16 active dates.",
  );

  assert(
    result.metrics.d1Retention.status === "available",
    "D1 retention should be available.",
  );
  assertApproximately(
    result.metrics.d1Retention.current,
    50,
    "Latest complete-cohort D1 retention should equal 50%.",
  );
  assertApproximately(
    result.metrics.d1Retention.comparison?.previous ?? -1,
    100,
    "Previous complete-cohort D1 retention should equal 100%.",
  );

  assert(
    result.metrics.coreConversion.status === "available",
    "Core conversion should be available.",
  );
  assertApproximately(
    result.metrics.coreConversion.current,
    50,
    "Current seven-day core conversion should equal 50%.",
  );
  assertApproximately(
    result.metrics.coreConversion.comparison?.previous ?? -1,
    100,
    "Previous seven-day core conversion should equal 100%.",
  );

  assert(
    result.metrics.feedback.status === "available" &&
      result.metrics.feedback.current === 2,
    "Feedback count should equal two non-empty rows.",
  );
  assert(
    result.fieldBindings["user-id"]?.originalName === "user_id",
    "Human-edited user-id resolution should override the suggestion.",
  );
  assert(
    result.fieldBindings.sentiment === null,
    "A human-excluded field must not be bound.",
  );
  assert(
    result.primaryAnomaly?.metric === "D1 Retention" &&
      result.primaryAnomaly.source === "dataset",
    "The priority D1 retention anomaly should be returned.",
  );

  const userExcludedSchema: SemanticSchema = {
    ...schema,
    fields: schema.fields.map((field) =>
      field.fieldIndex === 0
        ? {
            ...field,
            resolution: {
              status: "excluded" as const,
              reason: "Fixture unavailable-state check.",
            },
          }
        : field,
    ),
  };
  const unavailableResult = createDatasetOverview(dataset, userExcludedSchema);

  assert(
    unavailableResult.metrics.dau.status === "unavailable" &&
      unavailableResult.metrics.d1Retention.status === "unavailable" &&
      unavailableResult.metrics.coreConversion.status === "unavailable",
    "Metrics with a missing user-id must be unavailable rather than zero.",
  );

  const dateParsingResult = createDatasetOverview(
    createDateParsingFixtureDataset(),
    schema,
  );
  assert(
    dateParsingResult.dailyDau.status === "available",
    "DAU should accept supported CSV timestamp formats.",
  );
  assert(
    dateParsingResult.dailyDau.points.map((point) => point.date).join(",") ===
      [
        "2026-02-01",
        "2026-02-02",
        "2026-02-03",
        "2026-02-04",
        "2026-02-05",
        "2026-02-06",
      ].join(","),
    "Supported CSV timestamps should produce date keys and invalid dates should be ignored.",
  );

  return {
    dau: result.metrics.dau.current,
    d1Retention: result.metrics.d1Retention.current,
    coreConversion: result.metrics.coreConversion.current,
    feedback: result.metrics.feedback.current,
    anomaly: result.primaryAnomaly.metric,
  };
}
