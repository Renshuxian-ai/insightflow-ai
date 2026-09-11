import {
  isSemanticRole,
  isSemanticType,
  isSemanticTypeCompatibleWithRole,
} from "./semantic-type-registry";
import { getSemanticSchemaUnderstandings } from "./auto-use-policy";
import type {
  SemanticAutoUsePolicyResult,
  SemanticFieldMapping,
  SemanticFieldResolution,
  SemanticMappingValue,
  SemanticSchema,
  SemanticSchemaStatus,
} from "./types";
import type { DatasetSchema } from "@/lib/datasets/types";

function normalizeOptionalText(
  value: string | null | undefined,
  maximumLength = 500,
): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  if (normalized.length > maximumLength) {
    throw new Error(`Review text can contain at most ${maximumLength} characters.`);
  }

  return normalized;
}

function assertValidMappingValue(value: SemanticMappingValue) {
  if (!isSemanticRole(value.semanticRole) || !isSemanticType(value.semanticType)) {
    throw new Error("The semantic mapping contains an unregistered role or type.");
  }

  if (!isSemanticTypeCompatibleWithRole(value.semanticType, value.semanticRole)) {
    throw new Error("The semantic type is not compatible with the selected role.");
  }

  if (value.semanticRole === "unknown" || value.semanticType === "unknown") {
    throw new Error(
      "Define a semantic role and type, or keep this field unresolved.",
    );
  }

  if (value.businessMeaning && value.businessMeaning.trim().length > 160) {
    throw new Error("Business meaning can contain at most 160 characters.");
  }
}

function getReviewStatus(fields: SemanticFieldMapping[]): SemanticSchemaStatus {
  if (fields.every((field) => field.resolution.status === "suggested")) {
    return "draft";
  }

  return "in-review";
}

export function canConfirmSemanticSchema(
  schema: SemanticSchema,
  autoUsePolicy: SemanticAutoUsePolicyResult,
): boolean {
  const understandings = getSemanticSchemaUnderstandings(
    schema,
    autoUsePolicy,
  );

  return (
    schema.fields.length > 0 &&
    schema.fields.every(
      (field) => !understandings.get(field.stableFieldKey)?.isBlocking,
    )
  );
}

export function confirmSemanticSchema(
  schema: SemanticSchema,
  autoUsePolicy: SemanticAutoUsePolicyResult,
): SemanticSchema {
  if (!canConfirmSemanticSchema(schema, autoUsePolicy)) {
    throw new Error(
      "Resolve the critical field meanings and conflicts before confirming.",
    );
  }

  return {
    ...schema,
    semanticSchemaVersion: schema.semanticSchemaVersion + 1,
    status: "confirmed",
  };
}

export function resetSemanticFieldResolution(
  schema: SemanticSchema,
  stableFieldKey: string,
): SemanticSchema {
  return applySemanticFieldResolution(schema, stableFieldKey, {
    status: "suggested",
  });
}

export function mergeSemanticSchemaDraft(
  previousSchema: SemanticSchema,
  refreshedSchema: SemanticSchema,
): SemanticSchema {
  if (
    previousSchema.physicalSchema.schemaFingerprint !==
      refreshedSchema.physicalSchema.schemaFingerprint ||
    previousSchema.physicalSchema.selectedSheetName !==
      refreshedSchema.physicalSchema.selectedSheetName
  ) {
    return refreshedSchema;
  }

  const previousByFieldKey = new Map(
    previousSchema.fields.map((field) => [field.stableFieldKey, field]),
  );
  const fields = refreshedSchema.fields.map((field) => {
    const previousField = previousByFieldKey.get(field.stableFieldKey);

    if (!previousField || previousField.resolution.status === "suggested") {
      return field;
    }

    return {
      ...field,
      suggestion: previousField.suggestion,
      resolution: previousField.resolution,
    };
  });

  return {
    ...refreshedSchema,
    semanticSchemaVersion:
      Math.max(
        previousSchema.semanticSchemaVersion,
        refreshedSchema.semanticSchemaVersion,
      ) + 1,
    status: getReviewStatus(fields),
    fields,
  };
}

export function rebindSemanticSchemaToPhysicalSchema(
  semanticSchema: SemanticSchema,
  physicalSchema: DatasetSchema,
): SemanticSchema {
  if (
    semanticSchema.physicalSchema.schemaFingerprint !==
      physicalSchema.schemaFingerprint ||
    semanticSchema.physicalSchema.selectedSheetName !==
      physicalSchema.selectedSheetName
  ) {
    throw new Error("A field review cannot be reused for a different schema.");
  }

  const mappingByFieldKey = new Map(
    semanticSchema.fields.map((field) => [field.stableFieldKey, field]),
  );

  if (
    physicalSchema.fields.some(
      (field) => !mappingByFieldKey.has(field.stableFieldKey),
    ) ||
    semanticSchema.fields.length !== physicalSchema.fields.length
  ) {
    throw new Error("The saved field review does not match this schema.");
  }

  return {
    ...semanticSchema,
    id: `semantic-schema_${physicalSchema.datasetId}_${physicalSchema.schemaFingerprint}`,
    physicalSchema: {
      datasetId: physicalSchema.datasetId,
      physicalSchemaVersion: physicalSchema.version,
      schemaFingerprint: physicalSchema.schemaFingerprint,
      selectedSheetName: physicalSchema.selectedSheetName,
    },
    fields: physicalSchema.fields.map((field) => {
      const mapping = mappingByFieldKey.get(field.stableFieldKey)!;

      return {
        ...mapping,
        fieldId: field.id,
        fieldIndex: field.index,
        originalName: field.originalName,
      };
    }),
  };
}

export function createAcceptedResolution(
  field: SemanticFieldMapping,
  note?: string | null,
): SemanticFieldResolution {
  if (!field.suggestion) {
    throw new Error("A field without a suggestion cannot be accepted.");
  }

  assertValidMappingValue({
    semanticRole: field.suggestion.semanticRole,
    semanticType: field.suggestion.semanticType,
    businessMeaning: field.suggestion.businessMeaning,
  });

  return {
    status: "accepted",
    acceptedSuggestionId: field.suggestion.id,
    value: {
      semanticRole: field.suggestion.semanticRole,
      semanticType: field.suggestion.semanticType,
      businessMeaning: field.suggestion.businessMeaning,
    },
    note: normalizeOptionalText(note),
  };
}

export function createEditedResolution(
  field: SemanticFieldMapping,
  value: SemanticMappingValue,
  note?: string | null,
): SemanticFieldResolution {
  assertValidMappingValue(value);

  return {
    status: "edited",
    sourceSuggestionId: field.suggestion?.id ?? null,
    value: {
      ...value,
      businessMeaning: normalizeOptionalText(value.businessMeaning, 160),
    },
    note: normalizeOptionalText(note),
  };
}

export function createExcludedResolution(
  reason?: string | null,
): SemanticFieldResolution {
  return {
    status: "excluded",
    reason: normalizeOptionalText(reason),
  };
}

export function createUnresolvedResolution(
  reason?: string | null,
): SemanticFieldResolution {
  return {
    status: "unresolved",
    reason: normalizeOptionalText(reason),
  };
}

export function applySemanticFieldResolution(
  schema: SemanticSchema,
  stableFieldKey: string,
  resolution: SemanticFieldResolution,
): SemanticSchema {
  let fieldFound = false;
  const fields = schema.fields.map((field) => {
    if (field.stableFieldKey !== stableFieldKey) {
      return field;
    }

    fieldFound = true;
    return {
      ...field,
      resolution,
    };
  });

  if (!fieldFound) {
    throw new Error(`Semantic field was not found: ${stableFieldKey}.`);
  }

  return {
    ...schema,
    semanticSchemaVersion: schema.semanticSchemaVersion + 1,
    status: getReviewStatus(fields),
    fields,
  };
}
