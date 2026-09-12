import "server-only";

import { SEMANTIC_TYPE_IDS } from "../semantic-type-registry";
import type {
  HeuristicSemanticCandidate,
  SemanticInferenceContext,
  SemanticSuggestionBatch,
} from "../types";
import { parseSemanticSchemaSuggestions } from "./output-schema";

type DeterministicInferenceSource = "heuristic" | "mock";

function roundConfidence(value: number): number {
  return Math.round(Math.max(0, Math.min(1, value)) * 100) / 100;
}

function toAlternative(candidate: HeuristicSemanticCandidate) {
  return {
    semanticRole: candidate.semanticRole,
    semanticType: candidate.semanticType,
    businessMeaning: candidate.businessMeaning,
    semanticConfidence: roundConfidence(candidate.semanticConfidence),
    reason: candidate.reason,
  };
}

export function generateSemanticSuggestionsFromHeuristics(
  context: SemanticInferenceContext,
  inferenceSource: DeterministicInferenceSource,
): SemanticSuggestionBatch {
  const rawSuggestions = context.fields.map((field) => {
    const [primaryCandidate, ...remainingCandidates] = field.heuristicCandidates;
    const primary = primaryCandidate ?? {
      semanticRole: "unknown" as const,
      semanticType: SEMANTIC_TYPE_IDS.unknown,
      businessMeaning: null,
      semanticConfidence: 0.2,
      reason: "No deterministic semantic candidate was available.",
    };
    const alternatives = remainingCandidates.slice(0, 3).map(toAlternative);
    const isAmbiguous =
      primary.semanticType === SEMANTIC_TYPE_IDS.unknown ||
      primary.semanticConfidence < 0.5 ||
      alternatives.length > 0;

    return {
      id: `semantic-suggestion_${field.stableFieldKey}_${inferenceSource}-v1`,
      stableFieldKey: field.stableFieldKey,
      semanticRole: primary.semanticRole,
      semanticType: primary.semanticType,
      businessMeaning: primary.businessMeaning,
      semanticConfidence: roundConfidence(primary.semanticConfidence),
      inferenceSource,
      explanation: `${primary.reason} The deterministic profile reports a ${field.detectedPhysicalType} physical type.`,
      alternatives,
      ambiguity: isAmbiguous
        ? "This suggestion needs human review because the available metadata is not conclusive."
        : null,
    };
  });

  return {
    physicalSchema: { ...context.physicalSchema },
    suggestions: parseSemanticSchemaSuggestions(rawSuggestions, context),
  };
}

export function generateDeterministicSemanticSuggestions(
  context: SemanticInferenceContext,
): SemanticSuggestionBatch {
  return generateSemanticSuggestionsFromHeuristics(context, "heuristic");
}
