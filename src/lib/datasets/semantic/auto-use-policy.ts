import type { DatasetSchema, FieldDataType } from "@/lib/datasets/types";

import {
  SEMANTIC_TYPE_IDS,
  isSemanticTypeCompatibleWithRole,
} from "./semantic-type-registry";
import type {
  PhysicalSchemaReference,
  SemanticAutoUseAssessment,
  SemanticAutoUsePolicyResult,
  SemanticConflict,
  SemanticFieldMapping,
  SemanticInferenceContext,
  SemanticMappingOrigin,
  SemanticMappingValue,
  SemanticSchema,
  SemanticSuggestion,
  SemanticSuggestionBatch,
  SemanticType,
  SemanticUseStatus,
} from "./types";

const SINGLE_VALUE_SEMANTIC_TYPES = new Set<SemanticType>([
  SEMANTIC_TYPE_IDS.userId,
  SEMANTIC_TYPE_IDS.sessionId,
  SEMANTIC_TYPE_IDS.eventName,
  SEMANTIC_TYPE_IDS.eventTimestamp,
]);

function isKnownSuggestion(
  suggestion: SemanticSuggestion | null,
): suggestion is SemanticSuggestion {
  return Boolean(
    suggestion &&
      suggestion.semanticRole !== "unknown" &&
      suggestion.semanticType !== SEMANTIC_TYPE_IDS.unknown &&
      isSemanticTypeCompatibleWithRole(
        suggestion.semanticType,
        suggestion.semanticRole,
      ),
  );
}

function isPhysicalTypeCompatible(
  semanticType: SemanticType,
  physicalType: FieldDataType,
): boolean {
  const isNumber = physicalType === "integer" || physicalType === "number";
  const isTextLike = physicalType === "string" || physicalType === "integer";

  switch (semanticType) {
    case SEMANTIC_TYPE_IDS.userId:
    case SEMANTIC_TYPE_IDS.sessionId:
      return isTextLike;
    case SEMANTIC_TYPE_IDS.eventTimestamp:
      return physicalType === "date" || physicalType === "datetime";
    case SEMANTIC_TYPE_IDS.metric:
    case SEMANTIC_TYPE_IDS.revenue:
      return isNumber;
    case SEMANTIC_TYPE_IDS.retention:
      return isNumber || physicalType === "boolean";
    case SEMANTIC_TYPE_IDS.eventName:
    case SEMANTIC_TYPE_IDS.dimension:
    case SEMANTIC_TYPE_IDS.platform:
    case SEMANTIC_TYPE_IDS.releaseVersion:
    case SEMANTIC_TYPE_IDS.feedbackText:
    case SEMANTIC_TYPE_IDS.sentiment:
    case SEMANTIC_TYPE_IDS.funnelStep:
      return physicalType === "string";
    case SEMANTIC_TYPE_IDS.unknown:
      return false;
  }
}

function hasReliableProfile(
  field: SemanticInferenceContext["fields"][number],
  semanticType: SemanticType,
): boolean {
  if (
    field.detectedPhysicalType === "mixed" ||
    field.detectedPhysicalType === "empty" ||
    field.physicalTypeConfidence < 0.8 ||
    field.nullRate >= 0.98
  ) {
    return false;
  }

  if (
    semanticType === SEMANTIC_TYPE_IDS.userId ||
    semanticType === SEMANTIC_TYPE_IDS.sessionId
  ) {
    return field.distinctRate >= 0.5;
  }

  if (
    semanticType === SEMANTIC_TYPE_IDS.metric ||
    semanticType === SEMANTIC_TYPE_IDS.revenue
  ) {
    return field.safeStatistics.kind === "numeric";
  }

  if (semanticType === SEMANTIC_TYPE_IDS.eventTimestamp) {
    return field.safeStatistics.kind === "temporal";
  }

  return true;
}

function hasClearValueSemantics(
  suggestion: SemanticSuggestion,
  field: SemanticInferenceContext["fields"][number],
): boolean {
  if (suggestion.semanticType === SEMANTIC_TYPE_IDS.retention) {
    // A physical number or boolean does not establish rate vs. flag semantics.
    return false;
  }

  if (suggestion.semanticType === SEMANTIC_TYPE_IDS.metric) {
    return (
      suggestion.semanticConfidence >= 0.85 &&
      field.safeStatistics.kind === "numeric"
    );
  }

  return true;
}

function getRequiredSemanticTypes(
  suggestions: readonly SemanticSuggestion[],
  datasetContext: string | null,
): SemanticType[] {
  const normalizedContext = datasetContext?.trim().toLowerCase() ?? "";
  const describesEventData =
    suggestions.some(
      (suggestion) =>
        suggestion.semanticType === SEMANTIC_TYPE_IDS.eventName,
    ) || /\b(event|events|behavior|behaviour|analytics)\b/.test(normalizedContext);

  return describesEventData
    ? [SEMANTIC_TYPE_IDS.eventName, SEMANTIC_TYPE_IDS.eventTimestamp]
    : [];
}

function isCriticalField(
  suggestion: SemanticSuggestion,
  requiredSemanticTypes: readonly SemanticType[],
): boolean {
  return (
    requiredSemanticTypes.includes(suggestion.semanticType) ||
    (requiredSemanticTypes.includes(SEMANTIC_TYPE_IDS.eventTimestamp) &&
      suggestion.semanticRole === "time")
  );
}

export function createSemanticAutoUsePolicy(
  context: SemanticInferenceContext,
  suggestionBatch: SemanticSuggestionBatch,
  datasetContext: string | null = null,
): SemanticAutoUsePolicyResult {
  const suggestionByFieldKey = new Map(
    suggestionBatch.suggestions.map((suggestion) => [
      suggestion.stableFieldKey,
      suggestion,
    ]),
  );
  const requiredSemanticTypes = getRequiredSemanticTypes(
    suggestionBatch.suggestions,
    datasetContext,
  );
  const datasetContextAvailable = Boolean(datasetContext?.trim());

  const assessments = context.fields.map((field): SemanticAutoUseAssessment => {
    const suggestion = suggestionByFieldKey.get(field.stableFieldKey) ?? null;
    const primaryHeuristic = field.heuristicCandidates[0] ?? null;
    const knownSuggestion = isKnownSuggestion(suggestion);
    const deterministicAgreement = Boolean(
      knownSuggestion &&
        primaryHeuristic &&
        primaryHeuristic.semanticRole === suggestion.semanticRole &&
        primaryHeuristic.semanticType === suggestion.semanticType,
    );
    const fieldNameEvidence = Boolean(
      primaryHeuristic &&
        primaryHeuristic.semanticConfidence >= 0.8 &&
        primaryHeuristic.reason.includes("normalized field name"),
    );
    const physicalTypeCompatible = Boolean(
      knownSuggestion &&
        isPhysicalTypeCompatible(
          suggestion.semanticType,
          field.detectedPhysicalType,
        ),
    );
    const profileReliable = Boolean(
      knownSuggestion && hasReliableProfile(field, suggestion.semanticType),
    );
    const valueSemanticsClear = Boolean(
      knownSuggestion && hasClearValueSemantics(suggestion, field),
    );
    const ambiguityClear = Boolean(knownSuggestion && !suggestion.ambiguity);
    const alternativesClear = Boolean(
      knownSuggestion && suggestion.alternatives.length === 0,
    );
    const canAutoUse = Boolean(
      knownSuggestion &&
        suggestion.semanticConfidence >= 0.8 &&
        deterministicAgreement &&
        fieldNameEvidence &&
        physicalTypeCompatible &&
        profileReliable &&
        valueSemanticsClear &&
        ambiguityClear &&
        alternativesClear,
    );
    const baseStatus: SemanticAutoUseAssessment["baseStatus"] = !knownSuggestion
      ? "meaning-unclear"
      : canAutoUse
        ? "ready-to-use"
        : "needs-review";
    const reasons: string[] = [];

    if (!knownSuggestion) reasons.push("The available evidence does not identify a reliable field meaning.");
    if (knownSuggestion && !deterministicAgreement) reasons.push("The system suggestion and deterministic field evidence do not fully agree.");
    if (knownSuggestion && !physicalTypeCompatible) reasons.push("The detected field type does not safely support this meaning.");
    if (knownSuggestion && !profileReliable) reasons.push("The available field profile is not strong enough for automatic use.");
    if (knownSuggestion && !valueSemanticsClear) reasons.push("The stored values do not establish the metric unit or value semantics.");
    if (knownSuggestion && !ambiguityClear) reasons.push(suggestion.ambiguity ?? "The suggestion remains ambiguous.");
    if (knownSuggestion && !alternativesClear) reasons.push("Other plausible field meanings are still available.");
    if (canAutoUse) reasons.push("Field name, detected type, profile, and system suggestion agree.");

    return {
      stableFieldKey: field.stableFieldKey,
      baseStatus,
      isCritical: knownSuggestion
        ? isCriticalField(suggestion, requiredSemanticTypes)
        : primaryHeuristic?.semanticRole === "time" &&
          requiredSemanticTypes.includes(SEMANTIC_TYPE_IDS.eventTimestamp),
      signals: {
        suggestionAvailable: knownSuggestion,
        deterministicAgreement,
        physicalTypeCompatible,
        fieldNameEvidence,
        profileReliable,
        valueSemanticsClear,
        ambiguityClear,
        alternativesClear,
        datasetContextAvailable,
      },
      reasons,
    };
  });

  return {
    version: 1,
    physicalSchema: { ...context.physicalSchema },
    datasetContextUsed: datasetContextAvailable,
    requiredSemanticTypes,
    assessments,
  };
}

function getAssessment(
  policy: SemanticAutoUsePolicyResult,
  stableFieldKey: string,
): SemanticAutoUseAssessment | null {
  return (
    policy.assessments.find(
      (assessment) => assessment.stableFieldKey === stableFieldKey,
    ) ?? null
  );
}

function getCandidateMapping(
  field: SemanticFieldMapping,
): SemanticMappingValue | null {
  if (
    field.resolution.status === "accepted" ||
    field.resolution.status === "edited"
  ) {
    return field.resolution.value;
  }

  if (
    field.resolution.status === "excluded" ||
    field.resolution.status === "unresolved"
  ) {
    return null;
  }

  return isKnownSuggestion(field.suggestion) ? field.suggestion : null;
}

export function getSemanticConflicts(
  schema: SemanticSchema,
  policy: SemanticAutoUsePolicyResult,
): SemanticConflict[] {
  const groupedFields = new Map<SemanticType, SemanticFieldMapping[]>();

  for (const field of schema.fields) {
    const candidate = getCandidateMapping(field);

    if (!candidate || !SINGLE_VALUE_SEMANTIC_TYPES.has(candidate.semanticType)) {
      continue;
    }

    const existing = groupedFields.get(candidate.semanticType) ?? [];
    existing.push(field);
    groupedFields.set(candidate.semanticType, existing);
  }

  return [...groupedFields.entries()]
    .filter(([, fields]) => fields.length > 1)
    .map(([semanticType, fields]) => {
      const fieldKeys = fields
        .map((field) => field.stableFieldKey)
        .sort((left, right) => left.localeCompare(right));
      const severity = policy.requiredSemanticTypes.includes(semanticType)
        ? "blocking"
        : "warning";

      return {
        id: `semantic-conflict_${semanticType}_${fieldKeys.join("_")}`,
        semanticType,
        fieldKeys,
        severity,
        message: `Multiple fields may represent the same ${semanticType.replaceAll("-", " ")} meaning.`,
      };
    });
}

export type SemanticFieldUnderstanding = {
  status: SemanticUseStatus;
  origin: SemanticMappingOrigin;
  effectiveMapping: SemanticMappingValue | null;
  isCritical: boolean;
  isBlocking: boolean;
  conflicts: SemanticConflict[];
  reasons: string[];
};

export function getSemanticFieldUnderstanding(
  field: SemanticFieldMapping,
  policy: SemanticAutoUsePolicyResult,
  conflicts: readonly SemanticConflict[] = [],
): SemanticFieldUnderstanding {
  const assessment = getAssessment(policy, field.stableFieldKey);
  const fieldConflicts = conflicts.filter((conflict) =>
    conflict.fieldKeys.includes(field.stableFieldKey),
  );
  const hasBlockingConflict = fieldConflicts.some(
    (conflict) => conflict.severity === "blocking",
  );

  if (field.resolution.status === "excluded") {
    return {
      status: "not-used",
      origin: "human-excluded",
      effectiveMapping: null,
      isCritical: assessment?.isCritical ?? false,
      isBlocking: false,
      conflicts: fieldConflicts,
      reasons: assessment?.reasons ?? [],
    };
  }

  if (field.resolution.status === "unresolved") {
    return {
      status: "meaning-unclear",
      origin: "human-unresolved",
      effectiveMapping: null,
      isCritical: assessment?.isCritical ?? false,
      isBlocking: Boolean(assessment?.isCritical || hasBlockingConflict),
      conflicts: fieldConflicts,
      reasons: assessment?.reasons ?? [],
    };
  }

  if (
    field.resolution.status === "accepted" ||
    field.resolution.status === "edited"
  ) {
    return {
      status: hasBlockingConflict ? "needs-review" : "ready-to-use",
      origin:
        field.resolution.status === "accepted"
          ? "human-accepted"
          : "human-edited",
      effectiveMapping: field.resolution.value,
      isCritical: assessment?.isCritical ?? false,
      isBlocking: hasBlockingConflict,
      conflicts: fieldConflicts,
      reasons: assessment?.reasons ?? [],
    };
  }

  const baseStatus = assessment?.baseStatus ?? "meaning-unclear";
  const status = fieldConflicts.length > 0 ? "needs-review" : baseStatus;
  const isBlocking = Boolean(
    hasBlockingConflict ||
      (assessment?.isCritical && status !== "ready-to-use"),
  );

  return {
    status,
    origin:
      status === "ready-to-use"
        ? "system-auto-use"
        : status === "meaning-unclear"
          ? "system-unclear"
          : "system-needs-review",
    effectiveMapping:
      status === "ready-to-use" && isKnownSuggestion(field.suggestion)
        ? field.suggestion
        : null,
    isCritical: assessment?.isCritical ?? false,
    isBlocking,
    conflicts: fieldConflicts,
    reasons: assessment?.reasons ?? [],
  };
}

export function getSemanticSchemaUnderstandings(
  schema: SemanticSchema,
  policy: SemanticAutoUsePolicyResult,
): Map<string, SemanticFieldUnderstanding> {
  const conflicts = getSemanticConflicts(schema, policy);

  return new Map(
    schema.fields.map((field) => [
      field.stableFieldKey,
      getSemanticFieldUnderstanding(field, policy, conflicts),
    ]),
  );
}

export function getUsableSemanticMappings(
  schema: SemanticSchema,
  policy: SemanticAutoUsePolicyResult,
): Array<{ field: SemanticFieldMapping; value: SemanticMappingValue }> {
  const understandings = getSemanticSchemaUnderstandings(schema, policy);

  return schema.fields.flatMap((field) => {
    const understanding = understandings.get(field.stableFieldKey);

    return understanding?.status === "ready-to-use" &&
      understanding.effectiveMapping
      ? [{ field, value: understanding.effectiveMapping }]
      : [];
  });
}

export function isPolicyForPhysicalSchema(
  policy: SemanticAutoUsePolicyResult,
  physicalSchema: PhysicalSchemaReference,
): boolean {
  return (
    policy.physicalSchema.datasetId === physicalSchema.datasetId &&
    policy.physicalSchema.physicalSchemaVersion ===
      physicalSchema.physicalSchemaVersion &&
    policy.physicalSchema.schemaFingerprint === physicalSchema.schemaFingerprint &&
    policy.physicalSchema.selectedSheetName === physicalSchema.selectedSheetName
  );
}

export function rebindSemanticAutoUsePolicy(
  policy: SemanticAutoUsePolicyResult,
  physicalSchema: DatasetSchema,
): SemanticAutoUsePolicyResult {
  if (
    policy.physicalSchema.schemaFingerprint !==
      physicalSchema.schemaFingerprint ||
    policy.physicalSchema.selectedSheetName !==
      physicalSchema.selectedSheetName
  ) {
    throw new Error("An auto-use policy cannot be reused for a different schema.");
  }

  const physicalFieldKeys = new Set(
    physicalSchema.fields.map((field) => field.stableFieldKey),
  );

  if (
    policy.assessments.length !== physicalSchema.fields.length ||
    policy.assessments.some(
      (assessment) => !physicalFieldKeys.has(assessment.stableFieldKey),
    )
  ) {
    throw new Error("The saved auto-use policy does not match this schema.");
  }

  return {
    ...policy,
    physicalSchema: {
      datasetId: physicalSchema.datasetId,
      physicalSchemaVersion: physicalSchema.version,
      schemaFingerprint: physicalSchema.schemaFingerprint,
      selectedSheetName: physicalSchema.selectedSheetName,
    },
  };
}

export function mergeSemanticAutoUsePolicy(
  previousPolicy: SemanticAutoUsePolicyResult,
  refreshedPolicy: SemanticAutoUsePolicyResult,
  previousSchema: SemanticSchema,
): SemanticAutoUsePolicyResult {
  if (
    previousPolicy.physicalSchema.schemaFingerprint !==
      refreshedPolicy.physicalSchema.schemaFingerprint ||
    previousPolicy.physicalSchema.selectedSheetName !==
      refreshedPolicy.physicalSchema.selectedSheetName
  ) {
    return refreshedPolicy;
  }

  const previousAssessmentByFieldKey = new Map(
    previousPolicy.assessments.map((assessment) => [
      assessment.stableFieldKey,
      assessment,
    ]),
  );
  const previousFieldByKey = new Map(
    previousSchema.fields.map((field) => [field.stableFieldKey, field]),
  );

  return {
    ...refreshedPolicy,
    assessments: refreshedPolicy.assessments.map((assessment) => {
      const previousField = previousFieldByKey.get(assessment.stableFieldKey);

      if (!previousField || previousField.resolution.status === "suggested") {
        return assessment;
      }

      return (
        previousAssessmentByFieldKey.get(assessment.stableFieldKey) ??
        assessment
      );
    }),
  };
}
