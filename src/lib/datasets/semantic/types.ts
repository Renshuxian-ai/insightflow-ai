import type {
  DatasetWarningCode,
  FieldDataType,
} from "@/lib/datasets/types";

import type {
  RegisteredSemanticRole,
  RegisteredSemanticType,
} from "./semantic-type-registry";

export type PhysicalSchemaReference = {
  datasetId: string;
  physicalSchemaVersion: number;
  schemaFingerprint: string;
  selectedSheetName: string | null;
};

export type SemanticRole = RegisteredSemanticRole;

export type SemanticType = RegisteredSemanticType;

export type SemanticInferenceSource = "heuristic" | "mock" | "ai";

export type SemanticMappingValue = {
  semanticRole: SemanticRole;
  semanticType: SemanticType;
  businessMeaning: string | null;
};

export type SemanticAlternative = SemanticMappingValue & {
  semanticConfidence: number;
  reason: string;
};

export type SemanticSuggestion = SemanticMappingValue & {
  id: string;
  stableFieldKey: string;
  semanticConfidence: number;
  inferenceSource: SemanticInferenceSource;
  explanation: string;
  alternatives: SemanticAlternative[];
  ambiguity: string | null;
};

/**
 * Model-controlled fields only. The server stamps the SemanticSuggestion id
 * and inferenceSource after this output has passed runtime validation.
 */
export type SemanticAiAlternativeOutput = {
  semanticRole: SemanticRole;
  semanticType: SemanticType;
  businessMeaning: string | null;
  semanticConfidence: number;
  reason: string;
};

export type SemanticAiSuggestionOutput = {
  stableFieldKey: string;
  semanticRole: SemanticRole;
  semanticType: SemanticType;
  businessMeaning: string | null;
  semanticConfidence: number;
  explanation: string;
  alternatives: SemanticAiAlternativeOutput[];
  ambiguity: string | null;
};

export type SemanticSuggestionBatch = {
  physicalSchema: PhysicalSchemaReference;
  suggestions: SemanticSuggestion[];
};

export type SemanticFieldResolution =
  | {
      status: "suggested";
    }
  | {
      status: "accepted";
      acceptedSuggestionId: string;
      value: SemanticMappingValue;
      note: string | null;
    }
  | {
      status: "edited";
      sourceSuggestionId: string | null;
      value: SemanticMappingValue;
      note: string | null;
    }
  | {
      status: "excluded";
      reason: string | null;
    }
  | {
      status: "unresolved";
      reason: string | null;
    };

export type SemanticFieldMapping = {
  fieldId: string;
  stableFieldKey: string;
  fieldIndex: number;
  originalName: string;
  suggestion: SemanticSuggestion | null;
  resolution: SemanticFieldResolution;
};

export type SemanticSchemaStatus = "draft" | "in-review" | "confirmed";

export type SemanticSchema = {
  id: string;
  physicalSchema: PhysicalSchemaReference;
  semanticSchemaVersion: number;
  status: SemanticSchemaStatus;
  retention: "session-only";
  fields: SemanticFieldMapping[];
};

export type HeuristicSemanticCandidate = SemanticMappingValue & {
  semanticConfidence: number;
  reason: string;
};

export type SanitizedSampleValue = string | number | boolean;

export type SemanticSampleSummary = {
  observedSampleCount: number;
  includedSampleCount: number;
  redactedSampleCount: number;
  minimumTextLength: number | null;
  maximumTextLength: number | null;
  policy:
    | "included"
    | "partially-redacted"
    | "redacted-sensitive-field"
    | "no-samples";
};

export type SemanticSafeStatistics =
  | {
      kind: "numeric";
      min: number;
      max: number;
      mean: number;
    }
  | {
      kind: "temporal";
      earliest: string;
      latest: string;
    }
  | {
      kind: "categorical";
      topValues: Array<{
        value: SanitizedSampleValue;
        count: number;
      }>;
      valuesRedacted: boolean;
    }
  | {
      kind: "none";
      valuesRedacted: boolean;
    };

export type SemanticInferenceField = {
  stableFieldKey: string;
  fieldName: string;
  detectedPhysicalType: FieldDataType;
  physicalTypeConfidence: number;
  nullRate: number;
  distinctCount: number;
  isDistinctCountExact: boolean;
  distinctRate: number;
  safeStatistics: SemanticSafeStatistics;
  sanitizedSamples: SanitizedSampleValue[];
  sampleSummary: SemanticSampleSummary;
  neighboringFieldNames: string[];
  heuristicCandidates: HeuristicSemanticCandidate[];
  physicalWarnings: DatasetWarningCode[];
};

export type SemanticInferenceContext = {
  physicalSchema: PhysicalSchemaReference;
  profileScope: {
    totalRows: number;
    profiledRows: number;
    isComplete: boolean;
  };
  physicalWarnings: DatasetWarningCode[];
  fields: SemanticInferenceField[];
};

export type SemanticUseStatus =
  | "ready-to-use"
  | "needs-review"
  | "meaning-unclear"
  | "not-used";

export type SemanticMappingOrigin =
  | "system-auto-use"
  | "system-needs-review"
  | "system-unclear"
  | "human-accepted"
  | "human-edited"
  | "human-unresolved"
  | "human-excluded";

export type SemanticAutoUseSignals = {
  suggestionAvailable: boolean;
  deterministicAgreement: boolean;
  physicalTypeCompatible: boolean;
  fieldNameEvidence: boolean;
  profileReliable: boolean;
  valueSemanticsClear: boolean;
  ambiguityClear: boolean;
  alternativesClear: boolean;
  datasetContextAvailable: boolean;
};

export type SemanticAutoUseAssessment = {
  stableFieldKey: string;
  baseStatus: Exclude<SemanticUseStatus, "not-used">;
  isCritical: boolean;
  signals: SemanticAutoUseSignals;
  reasons: string[];
};

export type SemanticConflict = {
  id: string;
  semanticType: SemanticType;
  fieldKeys: string[];
  severity: "blocking" | "warning";
  message: string;
};

export type SemanticAutoUsePolicyResult = {
  version: 1;
  physicalSchema: PhysicalSchemaReference;
  datasetContextUsed: boolean;
  requiredSemanticTypes: SemanticType[];
  assessments: SemanticAutoUseAssessment[];
};

export type SemanticFieldReviewEvidence = {
  stableFieldKey: string;
  sanitizedSamples: SanitizedSampleValue[];
  sampleSummary: SemanticSampleSummary;
  safeStatistics: SemanticSafeStatistics;
  nullRate: number;
  distinctCount: number;
  isDistinctCountExact: boolean;
};
