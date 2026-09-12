import "server-only";

export type SemanticAiOutputContractLimits = {
  stableFieldKeyMaxCharacters: number;
  businessMeaning: SemanticAiTextConstraint;
  explanation: SemanticAiTextConstraint;
  ambiguity: SemanticAiTextConstraint;
  maxAlternatives: number;
  alternativeReason: SemanticAiTextConstraint;
};

export type SemanticAiTextConstraint = {
  generationTarget: number;
  hardMax: number;
};

export const SEMANTIC_AI_RESPONSE_PROPERTIES = ["suggestions"] as const;

export const SEMANTIC_AI_SUGGESTION_REQUIRED_PROPERTIES = [
  "stableFieldKey",
  "semanticType",
  "businessMeaning",
  "semanticConfidence",
  "explanation",
] as const;

export const SEMANTIC_AI_SUGGESTION_OPTIONAL_PROPERTIES = [
  "semanticRole",
  "alternatives",
  "ambiguity",
] as const;

export const SEMANTIC_AI_SUGGESTION_PROPERTIES = [
  ...SEMANTIC_AI_SUGGESTION_REQUIRED_PROPERTIES,
  ...SEMANTIC_AI_SUGGESTION_OPTIONAL_PROPERTIES,
] as const;

export const SEMANTIC_AI_ALTERNATIVE_REQUIRED_PROPERTIES = [
  "semanticType",
  "businessMeaning",
  "semanticConfidence",
  "reason",
] as const;

export const SEMANTIC_AI_ALTERNATIVE_OPTIONAL_PROPERTIES = [
  "semanticRole",
] as const;

export const SEMANTIC_AI_ALTERNATIVE_PROPERTIES = [
  ...SEMANTIC_AI_ALTERNATIVE_REQUIRED_PROPERTIES,
  ...SEMANTIC_AI_ALTERNATIVE_OPTIONAL_PROPERTIES,
] as const;

export const SEMANTIC_AI_OUTPUT_CONTRACT: SemanticAiOutputContractLimits = {
  stableFieldKeyMaxCharacters: 96,
  businessMeaning: {
    generationTarget: 60,
    hardMax: 100,
  },
  explanation: {
    generationTarget: 120,
    hardMax: 200,
  },
  ambiguity: {
    generationTarget: 100,
    hardMax: 180,
  },
  maxAlternatives: 1,
  alternativeReason: {
    generationTarget: 100,
    hardMax: 180,
  },
};
