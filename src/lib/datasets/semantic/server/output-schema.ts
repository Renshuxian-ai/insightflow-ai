import "server-only";

import {
  isSemanticRole,
  isSemanticType,
  isSemanticTypeCompatibleWithRole,
} from "../semantic-type-registry";
import type {
  SemanticAlternative,
  SemanticInferenceContext,
  SemanticInferenceSource,
  SemanticRole,
  SemanticSuggestion,
  SemanticType,
} from "../types";

type JsonRecord = Record<string, unknown>;

export class SemanticSuggestionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SemanticSuggestionValidationError";
  }
}

function readRecord(value: unknown, path: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new SemanticSuggestionValidationError(`${path} must be an object.`);
  }

  return value as JsonRecord;
}

function assertAllowedKeys(
  value: JsonRecord,
  allowedKeys: readonly string[],
  path: string,
) {
  const unexpectedKey = Object.keys(value).find(
    (key) => !allowedKeys.includes(key),
  );

  if (unexpectedKey) {
    throw new SemanticSuggestionValidationError(
      `${path}.${unexpectedKey} is not allowed.`,
    );
  }
}

function readString(value: unknown, path: string, maximumLength: number): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new SemanticSuggestionValidationError(
      `${path} must be a non-empty string.`,
    );
  }

  const normalized = value.trim();

  if (normalized.length > maximumLength) {
    throw new SemanticSuggestionValidationError(`${path} is too long.`);
  }

  return normalized;
}

function readNullableString(
  value: unknown,
  path: string,
  maximumLength: number,
): string | null {
  if (value === null) {
    return null;
  }

  return readString(value, path, maximumLength);
}

function readConfidence(value: unknown, path: string): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 1
  ) {
    throw new SemanticSuggestionValidationError(
      `${path} must be a number between 0 and 1.`,
    );
  }

  return value;
}

function readSemanticRole(value: unknown, path: string): SemanticRole {
  if (!isSemanticRole(value)) {
    throw new SemanticSuggestionValidationError(
      `${path} must be a registered semantic role.`,
    );
  }

  return value;
}

function readSemanticType(value: unknown, path: string): SemanticType {
  if (!isSemanticType(value)) {
    throw new SemanticSuggestionValidationError(
      `${path} must be a registered semantic type.`,
    );
  }

  return value;
}

function readInferenceSource(
  value: unknown,
  path: string,
): SemanticInferenceSource {
  if (value !== "heuristic" && value !== "mock" && value !== "ai") {
    throw new SemanticSuggestionValidationError(
      `${path} must be heuristic, mock, or ai.`,
    );
  }

  return value;
}

function assertCompatibleRole(
  semanticType: SemanticType,
  semanticRole: SemanticRole,
  path: string,
) {
  if (!isSemanticTypeCompatibleWithRole(semanticType, semanticRole)) {
    throw new SemanticSuggestionValidationError(
      `${path} does not match the registered role for ${semanticType}.`,
    );
  }
}

function parseAlternative(value: unknown, path: string): SemanticAlternative {
  const alternative = readRecord(value, path);
  assertAllowedKeys(
    alternative,
    [
      "semanticRole",
      "semanticType",
      "businessMeaning",
      "semanticConfidence",
      "reason",
    ],
    path,
  );
  const semanticRole = readSemanticRole(
    alternative.semanticRole,
    `${path}.semanticRole`,
  );
  const semanticType = readSemanticType(
    alternative.semanticType,
    `${path}.semanticType`,
  );
  assertCompatibleRole(semanticType, semanticRole, path);

  return {
    semanticRole,
    semanticType,
    businessMeaning: readNullableString(
      alternative.businessMeaning,
      `${path}.businessMeaning`,
      160,
    ),
    semanticConfidence: readConfidence(
      alternative.semanticConfidence,
      `${path}.semanticConfidence`,
    ),
    reason: readString(alternative.reason, `${path}.reason`, 300),
  };
}

function parseSuggestion(
  value: unknown,
  path: string,
  allowedFieldKeys: ReadonlySet<string>,
): SemanticSuggestion {
  const suggestion = readRecord(value, path);
  assertAllowedKeys(
    suggestion,
    [
      "id",
      "stableFieldKey",
      "semanticRole",
      "semanticType",
      "businessMeaning",
      "semanticConfidence",
      "inferenceSource",
      "explanation",
      "alternatives",
      "ambiguity",
    ],
    path,
  );
  const stableFieldKey = readString(
    suggestion.stableFieldKey,
    `${path}.stableFieldKey`,
    96,
  );

  if (!allowedFieldKeys.has(stableFieldKey)) {
    throw new SemanticSuggestionValidationError(
      `${path}.stableFieldKey does not exist in this inference context.`,
    );
  }

  const semanticRole = readSemanticRole(
    suggestion.semanticRole,
    `${path}.semanticRole`,
  );
  const semanticType = readSemanticType(
    suggestion.semanticType,
    `${path}.semanticType`,
  );
  assertCompatibleRole(semanticType, semanticRole, path);

  if (!Array.isArray(suggestion.alternatives) || suggestion.alternatives.length > 3) {
    throw new SemanticSuggestionValidationError(
      `${path}.alternatives must contain at most 3 items.`,
    );
  }

  return {
    id: readString(suggestion.id, `${path}.id`, 180),
    stableFieldKey,
    semanticRole,
    semanticType,
    businessMeaning: readNullableString(
      suggestion.businessMeaning,
      `${path}.businessMeaning`,
      160,
    ),
    semanticConfidence: readConfidence(
      suggestion.semanticConfidence,
      `${path}.semanticConfidence`,
    ),
    inferenceSource: readInferenceSource(
      suggestion.inferenceSource,
      `${path}.inferenceSource`,
    ),
    explanation: readString(
      suggestion.explanation,
      `${path}.explanation`,
      500,
    ),
    alternatives: suggestion.alternatives.map((alternative, index) =>
      parseAlternative(alternative, `${path}.alternatives[${index}]`),
    ),
    ambiguity: readNullableString(
      suggestion.ambiguity,
      `${path}.ambiguity`,
      300,
    ),
  };
}

export function parseSemanticSchemaSuggestions(
  value: unknown,
  context: SemanticInferenceContext,
): SemanticSuggestion[] {
  if (!Array.isArray(value)) {
    throw new SemanticSuggestionValidationError(
      "semanticSuggestions must be an array.",
    );
  }

  if (value.length > context.fields.length) {
    throw new SemanticSuggestionValidationError(
      "semanticSuggestions contains more fields than the inference context.",
    );
  }

  const allowedFieldKeys = new Set(
    context.fields.map((field) => field.stableFieldKey),
  );
  const suggestions = value.map((suggestion, index) =>
    parseSuggestion(
      suggestion,
      `semanticSuggestions[${index}]`,
      allowedFieldKeys,
    ),
  );
  const fieldKeys = suggestions.map((suggestion) => suggestion.stableFieldKey);
  const suggestionIds = suggestions.map((suggestion) => suggestion.id);

  if (new Set(fieldKeys).size !== fieldKeys.length) {
    throw new SemanticSuggestionValidationError(
      "semanticSuggestions contains duplicate field references.",
    );
  }

  if (new Set(suggestionIds).size !== suggestionIds.length) {
    throw new SemanticSuggestionValidationError(
      "semanticSuggestions contains duplicate suggestion IDs.",
    );
  }

  return suggestions;
}
