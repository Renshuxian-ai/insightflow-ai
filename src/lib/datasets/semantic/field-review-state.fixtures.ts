import {
  createSemanticAutoUsePolicy,
  getSemanticSchemaUnderstandings,
  getUsableSemanticMappings,
} from "./auto-use-policy";
import { getFieldImportance } from "./field-importance";
import { getSemanticFieldEditState } from "./field-review-editor";
import { getHeuristicSemanticCandidates } from "./heuristics";
import {
  applySemanticFieldResolution,
  canConfirmSemanticSchema,
  createAcceptedResolution,
  createEditedResolution,
  createUnresolvedResolution,
  mergeSemanticSchemaDraft,
} from "./review-state";
import type {
  SemanticInferenceContext,
  SemanticSchema,
  SemanticSuggestion,
  SemanticSuggestionBatch,
} from "./types";
import type { DatasetSchema, FieldProfile } from "@/lib/datasets/types";

type FixtureField = {
  name: string;
  semanticRole: SemanticSuggestion["semanticRole"];
  semanticType: SemanticSuggestion["semanticType"];
  detectedType: FieldProfile["detectedType"];
  semanticConfidence: number;
};

const fixtureFields: FixtureField[] = [
  {
    name: "user_id",
    semanticRole: "identifier",
    semanticType: "user-id",
    detectedType: "string",
    semanticConfidence: 0.7,
  },
  {
    name: "event_timestamp",
    semanticRole: "time",
    semanticType: "event-timestamp",
    detectedType: "datetime",
    semanticConfidence: 0.7,
  },
  {
    name: "cohort_date",
    semanticRole: "time",
    semanticType: "cohort-date",
    detectedType: "date",
    semanticConfidence: 0.95,
  },
  {
    name: "first_active_date",
    semanticRole: "time",
    semanticType: "cohort-date",
    detectedType: "date",
    semanticConfidence: 0.95,
  },
  {
    name: "user_segment",
    semanticRole: "unknown",
    semanticType: "unknown",
    detectedType: "string",
    semanticConfidence: 0.35,
  },
];

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function createPhysicalField(
  field: FixtureField,
  index: number,
): FieldProfile {
  return {
    id: `field-${index}`,
    stableFieldKey: `field_${field.name}`,
    index,
    originalName: field.name,
    displayName: field.name,
    detectedType: field.detectedType,
    typeConfidence: 1,
    nonNullCount: 4,
    nullCount: 0,
    nullRate: 0,
    distinctCount: 4,
    isDistinctCountExact: true,
    sampleValues: [],
    statistics:
      field.detectedType === "date" || field.detectedType === "datetime"
        ? {
            kind: "temporal",
            earliest: "2026-08-01",
            latest: "2026-08-04",
          }
        : { kind: "none" },
    warnings: [],
  };
}

function createFixture() {
  const physicalFields = fixtureFields.map(createPhysicalField);
  const physicalSchema: DatasetSchema = {
    datasetId: "field-review-state-fixture",
    version: 1,
    schemaFingerprint: "field-review-state-fixture-v1",
    selectedSheetName: null,
    availableSheetNames: [],
    headerRowIndex: 0,
    fields: physicalFields,
    profileScope: { totalRows: 4, profiledRows: 4, isComplete: true },
    warnings: [],
  };
  const context: SemanticInferenceContext = {
    physicalSchema: {
      datasetId: physicalSchema.datasetId,
      physicalSchemaVersion: physicalSchema.version,
      schemaFingerprint: physicalSchema.schemaFingerprint,
      selectedSheetName: physicalSchema.selectedSheetName,
    },
    profileScope: { ...physicalSchema.profileScope },
    physicalWarnings: [],
    fields: fixtureFields.map((field) => ({
      stableFieldKey: `field_${field.name}`,
      fieldName: field.name,
      detectedPhysicalType: field.detectedType,
      physicalTypeConfidence: 1,
      nullRate: 0,
      distinctCount: 4,
      isDistinctCountExact: true,
      distinctRate: 1,
      safeStatistics:
        field.detectedType === "date" || field.detectedType === "datetime"
          ? {
              kind: "temporal" as const,
              earliest: "2026-08-01",
              latest: "2026-08-04",
            }
          : { kind: "none" as const, valuesRedacted: true },
      sanitizedSamples: [],
      sampleSummary: {
        observedSampleCount: 0,
        includedSampleCount: 0,
        redactedSampleCount: 0,
        minimumTextLength: null,
        maximumTextLength: null,
        policy: "no-samples" as const,
      },
      neighboringFieldNames: [],
      heuristicCandidates: [
        {
          semanticRole: field.semanticRole,
          semanticType: field.semanticType,
          businessMeaning:
            field.semanticType === "unknown" ? null : field.name,
          semanticConfidence: field.semanticConfidence,
          reason: `The normalized field name "${field.name}" matches a controlled semantic rule.`,
        },
      ],
      physicalWarnings: [],
    })),
  };
  const suggestions: SemanticSuggestion[] = fixtureFields.map(
    (field) => ({
      id: `suggestion-${field.name}`,
      stableFieldKey: `field_${field.name}`,
      semanticRole: field.semanticRole,
      semanticType: field.semanticType,
      businessMeaning: field.semanticType === "unknown" ? null : field.name,
      semanticConfidence: field.semanticConfidence,
      inferenceSource: "ai",
      explanation: "Fixture suggestion requiring review.",
      alternatives: [],
      ambiguity: null,
    }),
  );
  const suggestionBatch: SemanticSuggestionBatch = {
    physicalSchema: { ...context.physicalSchema },
    suggestions,
  };
  const schema: SemanticSchema = {
    id: "semantic-schema_field-review-state-fixture",
    physicalSchema: { ...context.physicalSchema },
    semanticSchemaVersion: 1,
    status: "draft",
    retention: "session-only",
    fields: fixtureFields.map((field, index) => ({
      fieldId: physicalFields[index]!.id,
      stableFieldKey: `field_${field.name}`,
      fieldIndex: index,
      originalName: field.name,
      suggestion: suggestions[index]!,
      resolution: { status: "suggested" },
    })),
  };
  const policy = createSemanticAutoUsePolicy(context, suggestionBatch);

  return { physicalFields, physicalSchema, policy, schema };
}

export function runFieldReviewStateFixtures() {
  const { physicalFields, policy, schema } = createFixture();
  const initialUnderstandings = getSemanticSchemaUnderstandings(schema, policy);
  const initiallyUsableKeys = new Set(
    getUsableSemanticMappings(schema, policy).map(
      ({ field }) => field.stableFieldKey,
    ),
  );

  assert(
    initialUnderstandings.get("field_user_id")?.isBlocking === true,
    "user_id must be a required field for event-style data.",
  );
  assert(
    initialUnderstandings.get("field_event_timestamp")?.isBlocking === true,
    "event_timestamp must be a required field for event-style data.",
  );
  assert(
    initialUnderstandings.get("field_cohort_date")?.isBlocking === false,
    "cohort_date must remain optional.",
  );
  assert(
    initialUnderstandings.get("field_cohort_date")?.status === "ready-to-use",
    "An explicit cohort_date must be ready to use without manual review.",
  );
  assert(
    initiallyUsableKeys.has("field_cohort_date"),
    "A suggested cohort_date must be usable before any human decision.",
  );
  assert(
    initialUnderstandings.get("field_first_active_date")?.isBlocking === false,
    "first_active_date must not become required only because it is a date.",
  );

  const userField = schema.fields[0]!;
  const eventTimestampField = schema.fields[1]!;
  const cohortField = schema.fields[2]!;
  const optionalUnknownField = schema.fields[4]!;
  const withUserAccepted = applySemanticFieldResolution(
    schema,
    userField.stableFieldKey,
    createAcceptedResolution(userField),
  );
  const afterUserUnderstandings = getSemanticSchemaUnderstandings(
    withUserAccepted,
    policy,
  );

  assert(
    afterUserUnderstandings.get(userField.stableFieldKey)?.isBlocking === false,
    "An accepted required field must not re-enter the required queue.",
  );
  assert(
    afterUserUnderstandings.get(eventTimestampField.stableFieldKey)
      ?.isBlocking === true,
    "The remaining required field must stay independently reviewable.",
  );

  const withRequiredAccepted = applySemanticFieldResolution(
    withUserAccepted,
    eventTimestampField.stableFieldKey,
    createAcceptedResolution(eventTimestampField),
  );

  assert(
    canConfirmSemanticSchema(withRequiredAccepted, policy),
    "Confirming the two genuinely required fields must enable schema confirmation.",
  );

  const requiredStillUnresolved = applySemanticFieldResolution(
    withRequiredAccepted,
    userField.stableFieldKey,
    createUnresolvedResolution("The required identifier is still unclear."),
  );

  assert(
    !canConfirmSemanticSchema(requiredStillUnresolved, policy),
    "An unresolved required field must continue to block schema confirmation.",
  );

  const withOptionalDescription = applySemanticFieldResolution(
    withRequiredAccepted,
    optionalUnknownField.stableFieldKey,
    createUnresolvedResolution("Customer-defined user segment."),
  );
  const optionalDescriptionUnderstanding = getSemanticSchemaUnderstandings(
    withOptionalDescription,
    policy,
  ).get(optionalUnknownField.stableFieldKey);
  const optionalDescriptionUsableKeys = new Set(
    getUsableSemanticMappings(withOptionalDescription, policy).map(
      ({ field }) => field.stableFieldKey,
    ),
  );

  assert(
    canConfirmSemanticSchema(withOptionalDescription, policy),
    "An unresolved optional field must not block schema confirmation.",
  );
  assert(
    optionalDescriptionUnderstanding?.status === "meaning-unclear" &&
      optionalDescriptionUnderstanding.effectiveMapping === null &&
      !optionalDescriptionUsableKeys.has(optionalUnknownField.stableFieldKey),
    "A description-only save must keep the optional field unresolved and unavailable to analytics.",
  );

  const unchangedEditorState = getSemanticFieldEditState({
    initialSemanticType: "unknown",
    currentSemanticType: "unknown",
    initialDescription: "",
    currentDescription: "",
  });
  const descriptionOnlyEditorState = getSemanticFieldEditState({
    initialSemanticType: "unknown",
    currentSemanticType: "unknown",
    initialDescription: "",
    currentDescription: "Customer-defined user segment.",
  });

  assert(
    !unchangedEditorState.canSave &&
      descriptionOnlyEditorState.canSave &&
      descriptionOnlyEditorState.saveMode === "description-only",
    "Description-only edits must enable saving while unchanged editors remain disabled.",
  );

  const selectedMeaningEditorState = getSemanticFieldEditState({
    initialSemanticType: "unknown",
    currentSemanticType: "dimension",
    initialDescription: "Customer-defined user segment.",
    currentDescription: "Customer-defined user segment.",
  });
  const withSelectedMeaning = applySemanticFieldResolution(
    withOptionalDescription,
    optionalUnknownField.stableFieldKey,
    createEditedResolution(optionalUnknownField, {
      semanticRole: "dimension",
      semanticType: "dimension",
      businessMeaning: "Customer-defined user segment.",
    }),
  );
  const selectedMeaningUnderstanding = getSemanticSchemaUnderstandings(
    withSelectedMeaning,
    policy,
  ).get(optionalUnknownField.stableFieldKey);

  assert(
    selectedMeaningEditorState.canSave &&
      selectedMeaningEditorState.saveMode === "semantic-mapping" &&
      selectedMeaningUnderstanding?.status === "ready-to-use" &&
      selectedMeaningUnderstanding.effectiveMapping?.semanticType ===
        "dimension",
    "Selecting a valid meaning must save the description and resolve the field for use.",
  );

  const refreshedSchema: SemanticSchema = {
    ...schema,
    semanticSchemaVersion: schema.semanticSchemaVersion + 1,
  };
  const mergedSchema = mergeSemanticSchemaDraft(
    withRequiredAccepted,
    refreshedSchema,
  );

  assert(
    mergedSchema.fields[0]?.resolution.status === "accepted" &&
      mergedSchema.fields[1]?.resolution.status === "accepted",
    "A refreshed suggestion batch must preserve independent accepted decisions.",
  );

  const withCohortAccepted = applySemanticFieldResolution(
    withRequiredAccepted,
    cohortField.stableFieldKey,
    createAcceptedResolution(cohortField),
  );
  const usableKeys = new Set(
    getUsableSemanticMappings(withCohortAccepted, policy).map(
      ({ field }) => field.stableFieldKey,
    ),
  );
  const cohortImportance = getFieldImportance(
    cohortField,
    physicalFields[2]!,
  );

  assert(
    usableKeys.has(cohortField.stableFieldKey),
    "An accepted cohort_date must remain available to Dataset Retention.",
  );
  assert(
    cohortImportance.importance === "important" &&
      cohortImportance.description.includes("cohort-based retention"),
    "cohort_date must use conditional cohort-analysis importance copy.",
  );

  for (const fieldName of [
    "cohort_date",
    "cohort_start_date",
    "cohort_start",
    "acquisition_date",
    "signup_date",
    "first_active_date",
  ]) {
    const candidate = getHeuristicSemanticCandidates({
      ...physicalFields[2]!,
      stableFieldKey: `field_${fieldName}`,
      originalName: fieldName,
      displayName: fieldName,
    })[0];

    assert(
      candidate?.semanticType === "cohort-date" &&
        candidate.businessMeaning === "Cohort date",
      `${fieldName} must map to the controlled Cohort date meaning.`,
    );
  }
}
