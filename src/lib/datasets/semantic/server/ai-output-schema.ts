import "server-only";

import {
  getSemanticTypeDefinition,
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
import {
  SEMANTIC_AI_ALTERNATIVE_PROPERTIES,
  SEMANTIC_AI_OUTPUT_CONTRACT,
  SEMANTIC_AI_RESPONSE_PROPERTIES,
  SEMANTIC_AI_SUGGESTION_PROPERTIES,
} from "./semantic-ai-output-contract";

type JsonRecord = Record<string, unknown>;

export type SemanticAiOutputValidationDiagnostic = {
  path: string;
  reason: string;
  expected: string;
  receivedType: string;
  receivedSummary: string;
};

export type SemanticAiSuggestionBatchValidationResult = {
  validOutputs: SemanticAiSuggestionOutput[];
  invalidSuggestions: SemanticAiOutputValidationDiagnostic[];
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

  if (value.length > maximumLength) {
    failValidation(
      path,
      "text exceeds the allowed length.",
      `string no longer than ${maximumLength} characters`,
      value,
    );
  }

  return value;
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

function readOptionalSemanticRole(
  value: unknown,
  semanticType: SemanticType,
  path: string,
): SemanticRole | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (semanticType !== SEMANTIC_TYPE_IDS.unknown) {
    failValidation(
      path,
      "semanticRole is server-derived for a known semanticType.",
      "omitted unless semanticType is unknown",
      value,
    );
  }

  if (!isSemanticRole(value)) {
    failValidation(
      path,
      "invalid semantic role.",
      "a registered SemanticRole",
      value,
    );
  }

  if (!isSemanticTypeCompatibleWithRole(semanticType, value)) {
    failValidation(
      path,
      "semantic role and type are incompatible.",
      `a registry-compatible role for ${semanticType}`,
      value,
    );
  }

  return value;
}

function assertUnknownInvariants(
  value: {
    semanticType: SemanticType;
    businessMeaning: string | null;
    ambiguity?: string | null;
  },
  path: string,
  requireAmbiguity = false,
) {
  const hasUnknownSemantic = value.semanticType === SEMANTIC_TYPE_IDS.unknown;

  if (!hasUnknownSemantic) {
    if (value.businessMeaning === null) {
      failValidation(
        `${path}.businessMeaning`,
        "known semantics require a business meaning.",
        "non-empty string when semanticType is known",
        value.businessMeaning,
      );
    }

    return;
  }

  if (value.businessMeaning !== null) {
    failValidation(
      `${path}.businessMeaning`,
      "unknown semantics cannot claim a specific business meaning.",
      "null when semanticType is unknown",
      value.businessMeaning,
    );
  }

  if (requireAmbiguity && value.ambiguity === null) {
    failValidation(
      `${path}.ambiguity`,
      "unknown semantics must disclose ambiguity.",
      "non-empty string when semanticType is unknown",
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
    SEMANTIC_AI_ALTERNATIVE_PROPERTIES,
    path,
  );
  const semanticType = readSemanticType(
    alternative.semanticType,
    `${path}.semanticType`,
  );
  const semanticRole = readOptionalSemanticRole(
    alternative.semanticRole,
    semanticType,
    `${path}.semanticRole`,
  );
  const businessMeaning = readNullableString(
    alternative.businessMeaning,
    `${path}.businessMeaning`,
    SEMANTIC_AI_OUTPUT_CONTRACT.businessMeaning.hardMax,
  );
  const semanticConfidence = readConfidence(
    alternative.semanticConfidence,
    `${path}.semanticConfidence`,
  );

  assertUnknownInvariants(
    {
      semanticType,
      businessMeaning,
    },
    path,
  );

  return {
    ...(semanticRole ? { semanticRole } : {}),
    semanticType,
    businessMeaning,
    semanticConfidence,
    reason: readString(
      alternative.reason,
      `${path}.reason`,
      SEMANTIC_AI_OUTPUT_CONTRACT.alternativeReason.hardMax,
    ),
  };
}

function getCandidateSignature(value: {
  semanticRole?: SemanticRole;
  semanticType: SemanticType;
}): string {
  const semanticRole =
    value.semanticRole ?? getSemanticTypeDefinition(value.semanticType).role;

  return `${semanticRole}:${value.semanticType}`;
}

function parseSuggestion(
  value: unknown,
  path: string,
  allowedFieldKeys: ReadonlySet<string>,
): SemanticAiSuggestionOutput {
  const suggestion = readRecord(value, path);
  assertAllowedKeys(
    suggestion,
    SEMANTIC_AI_SUGGESTION_PROPERTIES,
    path,
  );
  const stableFieldKey = readString(
    suggestion.stableFieldKey,
    `${path}.stableFieldKey`,
    SEMANTIC_AI_OUTPUT_CONTRACT.stableFieldKeyMaxCharacters,
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

  const semanticType = readSemanticType(
    suggestion.semanticType,
    `${path}.semanticType`,
  );
  const semanticRole = readOptionalSemanticRole(
    suggestion.semanticRole,
    semanticType,
    `${path}.semanticRole`,
  );
  const businessMeaning = readNullableString(
    suggestion.businessMeaning,
    `${path}.businessMeaning`,
    SEMANTIC_AI_OUTPUT_CONTRACT.businessMeaning.hardMax,
  );
  const semanticConfidence = readConfidence(
    suggestion.semanticConfidence,
    `${path}.semanticConfidence`,
  );
  const ambiguity = suggestion.ambiguity === undefined
    ? null
    : readNullableString(
        suggestion.ambiguity,
        `${path}.ambiguity`,
        SEMANTIC_AI_OUTPUT_CONTRACT.ambiguity.hardMax,
      );

  assertUnknownInvariants(
    {
      semanticType,
      businessMeaning,
      ambiguity,
    },
    path,
    true,
  );

  if (
    suggestion.alternatives !== undefined &&
    !Array.isArray(suggestion.alternatives)
  ) {
    failValidation(
      `${path}.alternatives`,
      "type mismatch.",
      "array when provided",
      suggestion.alternatives,
    );
  }

  const rawAlternatives = suggestion.alternatives ?? [];
  const alternatives = rawAlternatives.map((alternative, index) =>
    parseAlternative(alternative, `${path}.alternatives[${index}]`),
  );
  const primarySignature = getCandidateSignature({
    semanticRole,
    semanticType,
  });
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

  if (alternatives.length > SEMANTIC_AI_OUTPUT_CONTRACT.maxAlternatives) {
    failValidation(
      `${path}.alternatives`,
      "invalid array length.",
      `array with at most ${SEMANTIC_AI_OUTPUT_CONTRACT.maxAlternatives} items`,
      alternatives,
    );
  }

  return {
    stableFieldKey,
    ...(semanticRole ? { semanticRole } : {}),
    semanticType,
    businessMeaning,
    semanticConfidence,
    explanation: readString(
      suggestion.explanation,
      `${path}.explanation`,
      SEMANTIC_AI_OUTPUT_CONTRACT.explanation.hardMax,
    ),
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

/**
 * Validates the batch structure before validating each field suggestion in
 * isolation. Structural ambiguity remains batch-fatal; a mapped field's
 * semantic failure is reported without modifying or partially accepting it.
 */
export function validateSemanticAiSuggestionBatchOutput(
  value: unknown,
  context: SemanticInferenceContext,
): SemanticAiSuggestionBatchValidationResult {
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
  const rawSuggestions = value.map((rawSuggestion, index) => {
    const path = `semanticAiSuggestions[${index}]`;
    const suggestion = readRecord(rawSuggestion, path);
    const stableFieldKey = readString(
      suggestion.stableFieldKey,
      `${path}.stableFieldKey`,
      SEMANTIC_AI_OUTPUT_CONTRACT.stableFieldKeyMaxCharacters,
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

    return { path, rawSuggestion, stableFieldKey };
  });
  const stableFieldKeys = rawSuggestions.map(
    (suggestion) => suggestion.stableFieldKey,
  );

  if (new Set(stableFieldKeys).size !== stableFieldKeys.length) {
    failValidation(
      "semanticAiSuggestions",
      "duplicate stableFieldKey values.",
      "at most one suggestion for each inference-context field",
      value,
      "array(contains duplicate stableFieldKey)",
    );
  }

  const validOutputs: SemanticAiSuggestionOutput[] = [];
  const invalidSuggestions: SemanticAiOutputValidationDiagnostic[] = [];

  for (const { path, rawSuggestion } of rawSuggestions) {
    try {
      validOutputs.push(parseSuggestion(rawSuggestion, path, allowedFieldKeys));
    } catch (error) {
      if (!(error instanceof SemanticAiOutputValidationError)) {
        throw error;
      }

      invalidSuggestions.push(error.diagnostic);
    }
  }

  return { validOutputs, invalidSuggestions };
}

export function unwrapSemanticAiSuggestionResponse(value: unknown): unknown {
  const response = readRecord(value, "semanticAiResponse");
  assertAllowedKeys(
    response,
    SEMANTIC_AI_RESPONSE_PROPERTIES,
    "semanticAiResponse",
  );

  if (!Object.prototype.hasOwnProperty.call(response, "suggestions")) {
    failValidation(
      "semanticAiResponse.suggestions",
      "missing field.",
      "array",
      undefined,
    );
  }

  return response.suggestions;
}

export function stampSemanticAiSuggestions(
  outputs: readonly SemanticAiSuggestionOutput[],
): SemanticSuggestion[] {
  return outputs.map((output) => ({
    id: `semantic-suggestion_${output.stableFieldKey}_ai-v1`,
    stableFieldKey: output.stableFieldKey,
    semanticRole:
      output.semanticRole ?? getSemanticTypeDefinition(output.semanticType).role,
    semanticType: output.semanticType,
    businessMeaning: output.businessMeaning,
    semanticConfidence: output.semanticConfidence,
    inferenceSource: "ai",
    explanation: output.explanation,
    alternatives: output.alternatives.map((alternative) => ({
      ...alternative,
      semanticRole:
        alternative.semanticRole ??
        getSemanticTypeDefinition(alternative.semanticType).role,
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
