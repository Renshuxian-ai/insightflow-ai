import {
  isSemanticRole,
  isSemanticType,
  isSemanticTypeCompatibleWithRole,
} from "./semantic-type-registry";
import type {
  SemanticFieldMapping,
  SemanticFieldResolution,
  SemanticMappingValue,
  SemanticSchema,
  SemanticSchemaStatus,
} from "./types";

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

  if (value.businessMeaning && value.businessMeaning.trim().length > 160) {
    throw new Error("Business meaning can contain at most 160 characters.");
  }
}

function getSchemaStatus(fields: SemanticFieldMapping[]): SemanticSchemaStatus {
  if (fields.every((field) => field.resolution.status === "suggested")) {
    return "draft";
  }

  if (
    fields.every((field) =>
      ["accepted", "edited", "excluded"].includes(field.resolution.status),
    )
  ) {
    return "confirmed";
  }

  return "in-review";
}

export function createAcceptedResolution(
  field: SemanticFieldMapping,
  note?: string | null,
): SemanticFieldResolution {
  if (!field.suggestion) {
    throw new Error("A field without a suggestion cannot be accepted.");
  }

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
    status: getSchemaStatus(fields),
    fields,
  };
}
