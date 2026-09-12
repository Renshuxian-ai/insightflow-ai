import "server-only";

import type { SemanticInferenceContext, SemanticSuggestionBatch } from "../types";
import { generateSemanticSuggestionsFromHeuristics } from "./deterministic-suggestion-generator";

export function generateMockSemanticSuggestions(
  context: SemanticInferenceContext,
): SemanticSuggestionBatch {
  return generateSemanticSuggestionsFromHeuristics(context, "mock");
}
