import "server-only";

import {
  isSemanticRole,
  isSemanticType,
  isSemanticTypeCompatibleWithRole,
  SEMANTIC_TYPE_IDS,
} from "../semantic-type-registry";
import type {
  SemanticAiAlternativeOutput,
  SemanticAiSuggestionOutput,
  SemanticInferenceContext,
  SemanticRole,
  SemanticSuggestion,
  SemanticSuggestionBatch,
  SemanticType,
} from "../types";

type JsonRecord = Record<string, unknown>;

export type SemanticAiOutputValidationDiagnostic = {
  path: string;
  reason: string;
  expected: string;
  receivedType: string;
  receivedSummary: string;
};

export class SemanticAiOutputValidationError extends Error {
  constructor(readonly diagnostic: SemanticAiOutputValidationDiagnostic) {
    super(
      `${diagnostic.path}: ${diagnostic.reason} Expected ${diagnostic.expected}; received ${diagnostic.receivedSummary}.`,
    );
    this.name = "SemanticAiOutputValidationError";
  }
}

export function formatSemanticAiValidationDiagnostic(
  diagnostic: SemanticAiOutputValidationDiagnostic,
): string {
  return [
    "Semantic AI output validation failed:",
    `path=${diagnostic.path}`,
    `reason=${diagnostic.reason}`,
    `expected=${diagnostic.expected}`,
    `receivedType=${diagnostic.receivedType}`,
    `receivedSummary=${diagnostic.receivedSummary}`,
  ].join("\n");
}

function describeReceived(value: unknown): string {
  if (value === undefined) {
    return "missing";
  }

  if (value === null) {
    return "null";
  }

  if (Array.isArray(value)) {
    return `array(length=${value.length})`;
  }

  if (typeof value === "string") {
    return `string(length=${value.length})`;
  }

  return typeof value;
}

function getReceivedType(value: unknown): string {
  if (value === null) {
    return "null";
  }

  return Array.isArray(value) ? "array" : typeof value;
}

function failValidation(
  path: string,
  reason: string,
  expected: string,
  value: unknown,
  receivedSummary = describeReceived(value),
): never {
  throw new SemanticAiOutputValidationError({
    path,
    reason,
    expected,
    receivedType: getReceivedType(value),
    receivedSummary,
  });
}

function readRecord(value: unknown, path: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    failValidation(
      path,
      value === undefined ? "missing field." : "type mismatch.",
      "object",
      value,
    );
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
    failValidation(
      path,
      "unexpected field in AI output.",
      `only: ${allowedKeys.join(", ")}`,
      value[unexpectedKey],
    );
  }
}

function readString(value: unknown, path: string, maximumLength: number): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    failValidation(
      path,
      value === undefined ? "missing field." : "invalid string.",
      "non-empty string",
      value,
    );
  }

  const normalized = value.trim();

  if (normalized.length > maximumLength) {
    failValidation(
      path,
      "text exceeds the allowed length.",
      `string no longer than ${maximumLength} characters`,
      value,
    );
  }

  return normalized;
}

function readNullableString(
  value: unknown,
  path: string,
  maximumLength: number,
): string | null {
  return value === null ? null : readString(value, path, maximumLength);
}

function readConfidence(value: unknown, path: string): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 1
  ) {
    failValidation(
      path,
      "invalid confidence.",
      "finite number from 0 to 1",
      value,
    );
  }

  return value;
}

function readSemanticRole(value: unknown, path: string): SemanticRole {
  if (!isSemanticRole(value)) {
    failValidation(
      path,
      "invalid semantic role.",
      "a registered SemanticRole",
      value,
    );
  }

  return value;
}

function readSemanticType(value: unknown, path: string): SemanticType {
  if (!isSemanticType(value)) {
    failValidation(
      path,
      "invalid semantic type.",
      "a registered SemanticType",
      value,
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
    failValidation(
      path,
      "semantic role and type are incompatible.",
      `the registered role for ${semanticType}`,
      { semanticRole, semanticType },
      "object(role/type mismatch)",
    );
  }
}

function assertUnknownInvariants(
  value: {
    semanticRole: SemanticRole;
    semanticType: SemanticType;
    businessMeaning: string | null;
    ambiguity?: string | null;
  },
  path: string,
  requireAmbiguity = false,
) {
  const hasUnknownSemantic =
    value.semanticRole === "unknown" ||
    value.semanticType === SEMANTIC_TYPE_IDS.unknown;

  if (!hasUnknownSemantic) {
    if (value.businessMeaning === null) {
      failValidation(
        `${path}.businessMeaning`,
        "known semantics require a business meaning.",
        "non-empty string when semantic role and type are known",
        value.businessMeaning,
      );
    }

    return;
  }

  if (value.businessMeaning !== null) {
    failValidation(
      `${path}.businessMeaning`,
      "unknown semantics cannot claim a specific business meaning.",
      "null when semantic role or type is unknown",
      value.businessMeaning,
    );
  }

  if (requireAmbiguity && value.ambiguity === null) {
    failValidation(
      `${path}.ambiguity`,
      "unknown semantics must disclose ambiguity.",
      "non-empty string when semantic role or type is unknown",
      value.ambiguity,
    );
  }
}

function parseAlternative(
  value: unknown,
  path: string,
): SemanticAiAlternativeOutput {
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
  const businessMeaning = readNullableString(
    alternative.businessMeaning,
    `${path}.businessMeaning`,
    160,
  );
  const semanticConfidence = readConfidence(
    alternative.semanticConfidence,
    `${path}.semanticConfidence`,
  );

  assertUnknownInvariants(
    {
      semanticRole,
      semanticType,
      businessMeaning,
    },
    path,
  );

  return {
    semanticRole,
    semanticType,
    businessMeaning,
    semanticConfidence,
    reason: readString(alternative.reason, `${path}.reason`, 300),
  };
}

function getCandidateSignature(value: {
  semanticRole: SemanticRole;
  semanticType: SemanticType;
}): string {
  return `${value.semanticRole}:${value.semanticType}`;
}

function parseSuggestion(
  value: unknown,
  path: string,
  allowedFieldKeys: ReadonlySet<string>,
): SemanticAiSuggestionOutput {
  const suggestion = readRecord(value, path);
  assertAllowedKeys(
    suggestion,
    [
      "stableFieldKey",
      "semanticRole",
      "semanticType",
      "businessMeaning",
      "semanticConfidence",
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
    failValidation(
      `${path}.stableFieldKey`,
      "unknown field reference.",
      "a stableFieldKey from the inference context",
      stableFieldKey,
      "string(field not found)",
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
  const businessMeaning = readNullableString(
    suggestion.businessMeaning,
    `${path}.businessMeaning`,
    160,
  );
  const semanticConfidence = readConfidence(
    suggestion.semanticConfidence,
    `${path}.semanticConfidence`,
  );
  const ambiguity = readNullableString(
    suggestion.ambiguity,
    `${path}.ambiguity`,
    300,
  );

  assertUnknownInvariants(
    {
      semanticRole,
      semanticType,
      businessMeaning,
      ambiguity,
    },
    path,
    true,
  );

  if (!Array.isArray(suggestion.alternatives) || suggestion.alternatives.length > 3) {
    failValidation(
      `${path}.alternatives`,
      suggestion.alternatives === undefined ? "missing field." : "invalid array length.",
      "array with at most 3 items",
      suggestion.alternatives,
    );
  }

  const alternatives = suggestion.alternatives.map((alternative, index) =>
    parseAlternative(alternative, `${path}.alternatives[${index}]`),
  );
  const primarySignature = getCandidateSignature({ semanticRole, semanticType });
  const alternativeSignatures = alternatives.map(getCandidateSignature);

  if (alternativeSignatures.includes(primarySignature)) {
    failValidation(
      `${path}.alternatives`,
      "alternative duplicates the primary semantic candidate.",
      "alternatives with a different semantic role/type than the primary candidate",
      alternatives,
      "array(contains primary duplicate)",
    );
  }

  if (new Set(alternativeSignatures).size !== alternativeSignatures.length) {
    failValidation(
      `${path}.alternatives`,
      "duplicate semantic alternatives.",
      "alternatives with unique semantic role/type pairs",
      alternatives,
      "array(contains duplicate alternatives)",
    );
  }

  return {
    stableFieldKey,
    semanticRole,
    semanticType,
    businessMeaning,
    semanticConfidence,
    explanation: readString(suggestion.explanation, `${path}.explanation`, 500),
    alternatives,
    ambiguity,
  };
}

export function validateSemanticAiSuggestionOutput(
  value: unknown,
  context: SemanticInferenceContext,
): SemanticAiSuggestionOutput[] {
  if (!Array.isArray(value)) {
    failValidation(
      "semanticAiSuggestions",
      "type mismatch.",
      "array",
      value,
    );
  }

  if (value.length > context.fields.length) {
    failValidation(
      "semanticAiSuggestions",
      "too many suggestions.",
      "no more items than fields in the inference context",
      value,
    );
  }

  const allowedFieldKeys = new Set(
    context.fields.map((field) => field.stableFieldKey),
  );
  const suggestions = value.map((suggestion, index) =>
    parseSuggestion(
      suggestion,
      `semanticAiSuggestions[${index}]`,
      allowedFieldKeys,
    ),
  );
  const stableFieldKeys = suggestions.map(
    (suggestion) => suggestion.stableFieldKey,
  );

  if (new Set(stableFieldKeys).size !== stableFieldKeys.length) {
    failValidation(
      "semanticAiSuggestions",
      "duplicate stableFieldKey values.",
      "at most one suggestion for each inference-context field",
      suggestions,
      "array(contains duplicate stableFieldKey)",
    );
  }

  return suggestions;
}

export function stampSemanticAiSuggestions(
  outputs: readonly SemanticAiSuggestionOutput[],
): SemanticSuggestion[] {
  return outputs.map((output) => ({
    id: `semantic-suggestion_${output.stableFieldKey}_ai-v1`,
    stableFieldKey: output.stableFieldKey,
    semanticRole: output.semanticRole,
    semanticType: output.semanticType,
    businessMeaning: output.businessMeaning,
    semanticConfidence: output.semanticConfidence,
    inferenceSource: "ai",
    explanation: output.explanation,
    alternatives: output.alternatives.map((alternative) => ({
      ...alternative,
    })),
    ambiguity: output.ambiguity,
  }));
}

export function createSemanticAiSuggestionBatch(
  value: unknown,
  context: SemanticInferenceContext,
): SemanticSuggestionBatch {
  const outputs = validateSemanticAiSuggestionOutput(value, context);

  return {
    physicalSchema: { ...context.physicalSchema },
    suggestions: stampSemanticAiSuggestions(outputs),
  };
}
