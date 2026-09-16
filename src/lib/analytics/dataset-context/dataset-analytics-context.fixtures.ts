import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { SEMANTIC_TYPE_IDS } from "@/lib/datasets/semantic/semantic-type-registry";
import type {
  SemanticFieldMapping,
  SemanticMappingValue,
  SemanticSchema,
} from "@/lib/datasets/semantic/types";
import { parseDatasetForAnalytics } from "@/lib/datasets/server/parse-dataset";
import type { ParsedDataset } from "@/lib/datasets/server/parsers/types";

import { buildDatasetAnalyticsContext } from "./index";
import { buildRetentionDiagnosis } from "../retention-diagnosis-builder";

const FIXTURE_FILE_NAME = "insightflow_analytics_test_dataset.csv";
const FIXTURE_DATASET_ID = "dataset-analytics-context-fixture";

const FIXTURE_MAPPINGS: Record<string, SemanticMappingValue> = {
  user_id: {
    semanticRole: "identifier",
    semanticType: SEMANTIC_TYPE_IDS.userId,
    businessMeaning: "Product user identifier",
  },
  event_name: {
    semanticRole: "dimension",
    semanticType: SEMANTIC_TYPE_IDS.eventName,
    businessMeaning: "Tracked product event",
  },
  event_timestamp: {
    semanticRole: "time",
    semanticType: SEMANTIC_TYPE_IDS.eventTimestamp,
    businessMeaning: "Event occurrence time",
  },
  retention_rate: {
    semanticRole: "outcome",
    semanticType: SEMANTIC_TYPE_IDS.retention,
    businessMeaning: "Retention rate",
  },
  retention_day: {
    semanticRole: "dimension",
    semanticType: SEMANTIC_TYPE_IDS.dimension,
    businessMeaning: "Retention interval day",
  },
  platform: {
    semanticRole: "dimension",
    semanticType: SEMANTIC_TYPE_IDS.platform,
    businessMeaning: "User platform",
  },
  user_segment: {
    semanticRole: "dimension",
    semanticType: SEMANTIC_TYPE_IDS.dimension,
    businessMeaning: "User segment",
  },
  subscription_plan: {
    semanticRole: "dimension",
    semanticType: SEMANTIC_TYPE_IDS.dimension,
    businessMeaning: "Subscription plan",
  },
  funnel_name: {
    semanticRole: "dimension",
    semanticType: SEMANTIC_TYPE_IDS.dimension,
    businessMeaning: "Funnel name",
  },
  from_step: {
    semanticRole: "dimension",
    semanticType: SEMANTIC_TYPE_IDS.funnelStep,
    businessMeaning: "Funnel transition start step",
  },
  to_step: {
    semanticRole: "dimension",
    semanticType: SEMANTIC_TYPE_IDS.funnelStep,
    businessMeaning: "Funnel transition end step",
  },
  step_completion_rate: {
    semanticRole: "measure",
    semanticType: SEMANTIC_TYPE_IDS.metric,
    businessMeaning: "Funnel transition completion rate",
  },
  feedback_text: {
    semanticRole: "text",
    semanticType: SEMANTIC_TYPE_IDS.feedbackText,
    businessMeaning: "Original user feedback",
  },
  feedback_topic: {
    semanticRole: "dimension",
    semanticType: SEMANTIC_TYPE_IDS.dimension,
    businessMeaning: "Feedback topic",
  },
  feedback_sentiment: {
    semanticRole: "classification",
    semanticType: SEMANTIC_TYPE_IDS.sentiment,
    businessMeaning: "Feedback sentiment",
  },
  release_version: {
    semanticRole: "dimension",
    semanticType: SEMANTIC_TYPE_IDS.releaseVersion,
    businessMeaning: "Product release version",
  },
};

function assertFixture(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Dataset analytics context fixture failed: ${message}`);
  }
}

function createSemanticField(
  dataset: ParsedDataset,
  fieldIndex: number,
): SemanticFieldMapping {
  const column = dataset.columns[fieldIndex];

  if (!column) {
    throw new Error(`Missing fixture column at index ${fieldIndex}.`);
  }

  const mapping = FIXTURE_MAPPINGS[column.originalName];

  return {
    fieldId: `fixture-field-${fieldIndex}`,
    stableFieldKey: `${column.originalName}__${fieldIndex}`,
    fieldIndex,
    originalName: column.originalName,
    suggestion: null,
    resolution: mapping
      ? {
          status: "edited",
          sourceSuggestionId: null,
          value: mapping,
          note: null,
        }
      : {
          status: "excluded",
          reason: "Not required by the dataset analytics fixture.",
        },
  };
}

function createConfirmedSemanticSchema(dataset: ParsedDataset): SemanticSchema {
  return {
    id: "dataset-analytics-context-fixture-schema",
    physicalSchema: {
      datasetId: FIXTURE_DATASET_ID,
      physicalSchemaVersion: 1,
      schemaFingerprint: "dataset-analytics-context-fixture-fingerprint",
      selectedSheetName: dataset.selectedSheetName,
    },
    semanticSchemaVersion: 1,
    status: "confirmed",
    retention: "session-only",
    fields: dataset.columns.map((_, fieldIndex) =>
      createSemanticField(dataset, fieldIndex),
    ),
  };
}

function excludeSemanticFields(
  schema: SemanticSchema,
  excludedNames: readonly string[],
): SemanticSchema {
  const excluded = new Set(excludedNames);

  return {
    ...schema,
    fields: schema.fields.map((field) =>
      excluded.has(field.originalName)
        ? {
            ...field,
            suggestion: null,
            resolution: {
              status: "excluded" as const,
              reason: "Excluded by retention fixture scenario.",
            },
          }
        : field,
    ),
  };
}

function addExplicitCohortAnchor(
  dataset: ParsedDataset,
  schema: SemanticSchema,
): { dataset: ParsedDataset; semanticSchema: SemanticSchema } {
  const fieldIndex = dataset.columns.length;
  const originalName = "cohort_date";

  return {
    dataset: {
      ...dataset,
      columns: [
        ...dataset.columns,
        { index: fieldIndex, originalName, displayName: originalName },
      ],
      rows: dataset.rows.map((row) => [...row, "2026-06-01"]),
    },
    semanticSchema: {
      ...schema,
      fields: [
        ...schema.fields,
        {
          fieldId: `fixture-field-${fieldIndex}`,
          stableFieldKey: `${originalName}__${fieldIndex}`,
          fieldIndex,
          originalName,
          suggestion: null,
          resolution: {
            status: "edited",
            sourceSuggestionId: null,
            value: {
              semanticRole: "time",
              semanticType: SEMANTIC_TYPE_IDS.eventTimestamp,
              businessMeaning: "Explicit retention cohort date",
            },
            note: null,
          },
        },
      ],
    },
  };
}

async function parseFixtureDataset(): Promise<ParsedDataset> {
  const fileBytes = await readFile(
    join(process.cwd(), "public", "demo-data", FIXTURE_FILE_NAME),
  );
  const uploadBytes = Uint8Array.from(fileBytes);

  return parseDatasetForAnalytics({
    name: FIXTURE_FILE_NAME,
    size: uploadBytes.byteLength,
    type: "text/csv",
    async arrayBuffer() {
      return uploadBytes.buffer;
    },
  });
}

export async function runDatasetAnalyticsContextFixtures() {
  const context = await buildFixtureDatasetAnalyticsContext();
  const { dataset, semanticSchema } = context.fixture;

  assertFixture(semanticSchema.status === "confirmed", "the fixture schema must be confirmed.");
  assertFixture(dataset.rowCount === 5_000, "the CSV must contain 5,000 rows.");
  assertFixture(dataset.columns.length === 27, "the CSV must contain 27 columns.");
  assertFixture(
    context.availableSurfaces.join("|") === "retention|funnel|feedback",
    "all three Analytics surfaces must be available.",
  );

  const retention = context.retentionEvidence;

  assertFixture(retention, "retention evidence must be generated.");
  assertFixture(
    retention.fields.retentionMetric.originalName === "retention_rate" &&
      retention.fields.retentionDay.originalName === "retention_day" &&
      retention.fields.date.originalName === "event_timestamp" &&
      retention.fields.userIdentifier.originalName === "user_id",
    "retention must bind the confirmed metric, interval, date, and user fields.",
  );
  assertFixture(
    retention.intervals.map((interval) => interval.day).join("|") === "1|7|30",
    "retention evidence must contain D1, D7, and D30 intervals.",
  );
  assertFixture(
    retention.users === 5_000 &&
      retention.intervals.every(
        (interval) =>
          interval.retentionRate >= 0 && interval.retentionRate <= 100,
      ),
    "retention evidence must preserve user scope and normalized rates.",
  );
  assertFixture(
    retention.comparison?.evidenceQuality === "estimated" &&
      retention.comparison.baseline.intervals.length === 3 &&
      retention.comparison.current.intervals.length === 3,
    "retention evidence must expose bounded estimated comparison windows.",
  );
  assertFixture(
    retention.breakdowns?.map((dimension) => dimension.id).join("|") ===
      "platform|user-type" &&
      retention.fields.platform?.originalName === "platform" &&
      retention.fields.userType?.originalName === "user_segment",
    "platform and the highest-priority user_segment field must generate two retention breakdowns.",
  );
  assertFixture(
    retention.breakdowns.every(
      (dimension) =>
        dimension.segments.length >= 2 &&
        dimension.segments.every((segment) =>
          [1, 7, 30].every((day) =>
            segment.intervals.some((interval) => interval.day === day),
          ),
        ),
    ),
    "each fixture breakdown must preserve comparable D1, D7, and D30 evidence.",
  );
  assertFixture(
    retention.cohorts === null && retention.fields.cohortAnchor === null,
    "the uploaded fixture must not infer cohorts without an explicit cohort anchor.",
  );

  const platformOnlySchema = excludeSemanticFields(semanticSchema, [
    "user_segment",
    "subscription_plan",
  ]);
  const platformOnlyContext = buildDatasetAnalyticsContext({
    datasetId: FIXTURE_DATASET_ID,
    dataset,
    semanticSchema: platformOnlySchema,
  });

  assertFixture(
    platformOnlyContext.retentionEvidence?.breakdowns?.length === 1 &&
      platformOnlyContext.retentionEvidence.breakdowns[0]?.id === "platform",
    "a dataset with only platform must generate only the platform breakdown.",
  );

  const noSegmentSchema = excludeSemanticFields(semanticSchema, [
    "platform",
    "user_segment",
    "subscription_plan",
  ]);
  const noSegmentContext = buildDatasetAnalyticsContext({
    datasetId: FIXTURE_DATASET_ID,
    dataset,
    semanticSchema: noSegmentSchema,
  });

  assertFixture(
    noSegmentContext.retentionEvidence?.breakdowns === null,
    "a dataset without supported dimensions must keep retention breakdown unavailable.",
  );

  const explicitCohortFixture = addExplicitCohortAnchor(
    dataset,
    semanticSchema,
  );
  const explicitCohortContext = buildDatasetAnalyticsContext({
    datasetId: FIXTURE_DATASET_ID,
    dataset: explicitCohortFixture.dataset,
    semanticSchema: explicitCohortFixture.semanticSchema,
  });
  const explicitCohort = explicitCohortContext.retentionEvidence?.cohorts?.[0];

  assertFixture(
    explicitCohortContext.retentionEvidence?.fields.cohortAnchor?.originalName ===
      "cohort_date" &&
      explicitCohort?.date === "2026-06-01" &&
      explicitCohort.intervals.map((interval) => interval.day).join("|") ===
        "1|7|30",
    "an explicit cohort_date field must generate independently grouped cohort interval evidence.",
  );

  const breakdownPresentation = retention.breakdowns.map((dimension) => ({
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
  }));
  const diagnosis = buildRetentionDiagnosis({
    breakdowns: breakdownPresentation,
  });

  assertFixture(
    diagnosis &&
      diagnosis.primaryEvidence.d7Gap < 0 &&
      diagnosis.primaryEvidence.impactScore ===
        diagnosis.primaryEvidence.segment.users *
          Math.abs(diagnosis.primaryEvidence.d7Gap) &&
      diagnosis.suggestedChecks.length === 3,
    "segment diagnosis must preserve best/worst D7 gap, impact score ordering, and deterministic suggested checks.",
  );
  const diagnosisRuleFixture = buildRetentionDiagnosis({
    breakdowns: [
      {
        id: "platform",
        label: "Platform",
        segments: [
          {
            id: "platform-web",
            label: "Web",
            users: 2_300,
            intervals: [
              { day: 1, users: 1_334, rate: 58 },
              { day: 7, users: 805, rate: 35 },
              { day: 30, users: 414, rate: 18 },
            ],
          },
          {
            id: "platform-ios",
            label: "iOS",
            users: 9_200,
            intervals: [
              { day: 1, users: 6_992, rate: 76 },
              { day: 7, users: 4_968, rate: 54 },
              { day: 30, users: 2_852, rate: 31 },
            ],
          },
        ],
      },
      {
        id: "user-type",
        label: "User type",
        segments: [
          {
            id: "user-type-free",
            label: "Free",
            users: 15_000,
            intervals: [
              { day: 1, users: 9_000, rate: 60 },
              { day: 7, users: 5_700, rate: 38 },
              { day: 30, users: 2_850, rate: 19 },
            ],
          },
          {
            id: "user-type-enterprise",
            label: "Enterprise",
            users: 1_500,
            intervals: [
              { day: 1, users: 1_365, rate: 91 },
              { day: 7, users: 1_170, rate: 78 },
              { day: 30, users: 930, rate: 62 },
            ],
          },
        ],
      },
    ],
  });

  assertFixture(
    diagnosisRuleFixture?.primaryEvidence.dimensionId === "user-type" &&
      diagnosisRuleFixture.primaryEvidence.segment.label === "Free" &&
      diagnosisRuleFixture.primaryEvidence.benchmark.label === "Enterprise" &&
      diagnosisRuleFixture.primaryEvidence.d7Gap === -40 &&
      diagnosisRuleFixture.primaryEvidence.impactScore === 600_000 &&
      diagnosisRuleFixture.secondaryEvidence[0]?.dimensionId === "platform",
    "diagnosis must choose the dimension with the highest affected-users by absolute-D7-gap impact score.",
  );

  const funnel = context.funnelEvidence;

  assertFixture(funnel, "funnel evidence must be generated.");
  assertFixture(
    funnel.fields.funnelName.originalName === "funnel_name" &&
      funnel.fields.eventName.originalName === "event_name" &&
      funnel.fields.fromStep.originalName === "from_step" &&
      funnel.fields.toStep.originalName === "to_step" &&
      funnel.fields.version?.originalName === "release_version",
    "funnel must bind the confirmed funnel, event, transition, and version fields.",
  );
  assertFixture(
    funnel.transitions.length === 1 &&
      funnel.transitions[0]?.funnelName === "Activation Funnel" &&
      funnel.transitions[0]?.fromStep === "complete_step2" &&
      funnel.transitions[0]?.toStep === "complete_step3" &&
      funnel.transitions[0]?.observedRows === 5_000 &&
      funnel.transitions[0]?.users === 5_000 &&
      funnel.transitions[0]?.versions.length === 3 &&
      (funnel.transitions[0]?.dropOffUsers ?? 0) > 0,
    "funnel evidence must aggregate the uploaded transition and version rows.",
  );

  const feedback = context.feedbackEvidence;

  assertFixture(feedback, "feedback evidence must be generated.");
  assertFixture(
    feedback.fields.feedbackText.originalName === "feedback_text" &&
      feedback.fields.feedbackTopic.originalName === "feedback_topic" &&
      feedback.fields.feedbackSentiment.originalName === "feedback_sentiment" &&
      feedback.fields.date?.originalName === "event_timestamp",
    "feedback must bind the confirmed text, topic, sentiment, and date fields.",
  );
  assertFixture(
    feedback.totalFeedback === 5_000 && feedback.topics.length === 6,
    "feedback evidence must aggregate all uploaded feedback rows and topics.",
  );

  const pricingTopic = feedback.topics.find((topic) => topic.topic === "Pricing");

  assertFixture(
    pricingTopic?.mentions === 876 &&
      pricingTopic.quotes.length >= 1 &&
      pricingTopic.quotes.length <= 3 &&
      pricingTopic.trend !== null &&
      Object.values(pricingTopic.sentimentCounts).reduce(
        (total, count) => total + count,
        0,
      ) === 876,
    "feedback topics must preserve mention, quote, sentiment, and trend evidence.",
  );

  return {
    dataset: {
      rows: dataset.rowCount,
      columns: dataset.columns.length,
    },
    availableSurfaces: context.availableSurfaces,
    retention: {
      users: retention.users,
      intervals: retention.intervals,
      dateRange: retention.dateRange,
      comparison: retention.comparison,
      breakdowns: retention.breakdowns?.map((dimension) => ({
        id: dimension.id,
        field: dimension.field.originalName,
        segments: dimension.segments.length,
      })),
      cohortsAvailable: retention.cohorts !== null,
      diagnosisPrimaryDimension:
        diagnosis?.primaryEvidence.dimensionId ?? null,
    },
    funnel: funnel.transitions,
    feedback: {
      totalFeedback: feedback.totalFeedback,
      topics: feedback.topics.map((topic) => ({
        topic: topic.topic,
        mentions: topic.mentions,
        sentiment: topic.sentiment,
        trend: topic.trend,
      })),
    },
  };
}

export async function buildFixtureDatasetAnalyticsContext() {
  const dataset = await parseFixtureDataset();
  const semanticSchema = createConfirmedSemanticSchema(dataset);
  const context = buildDatasetAnalyticsContext({
    datasetId: FIXTURE_DATASET_ID,
    dataset,
    semanticSchema,
  });

  return {
    ...context,
    fixture: {
      dataset,
      semanticSchema,
    },
  };
}
