import "server-only";

import { semanticTypeRegistry } from "../semantic-type-registry";
import type {
  SemanticInferenceContext,
  SemanticInferenceField,
} from "../types";
import {
  SEMANTIC_AI_OUTPUT_CONTRACT,
  type SemanticAiOutputContractLimits,
} from "./semantic-ai-output-contract";

export const SEMANTIC_AI_MAX_OUTPUT_TOKENS = 5_000;
export const SEMANTIC_AI_MIN_REQUESTED_OUTPUT_TOKENS = 800;
export const SEMANTIC_AI_OUTPUT_BUDGET_UTILIZATION = 0.7;
export const MAX_FIELDS_PER_SEMANTIC_AI_BATCH = 10;
export const SEMANTIC_AI_OUTPUT_TOKENS_PER_CHARACTER = 1.15;

export type SemanticAiBatchPlan = {
  targetFieldKeys: string[];
  estimatedOutputTokens: number;
  requestedMaxTokens: number;
};

export type SemanticAiBatchPlannerInput = {
  context: SemanticInferenceContext;
  targetFieldKeys?: readonly string[];
  outputContract?: SemanticAiOutputContractLimits;
  maxOutputTokens?: number;
  budgetUtilization?: number;
  maxFieldsPerBatch?: number;
};

function getLongestValue(values: readonly string[]): string {
  return values.reduce(
    (longest, value) => value.length > longest.length ? value : longest,
    "",
  );
}

function isComplexOutputLikely(field: SemanticInferenceField): boolean {
  return (
    field.detectedPhysicalType === "empty" ||
    field.detectedPhysicalType === "mixed" ||
    field.physicalTypeConfidence < 0.9 ||
    field.physicalWarnings.length > 0 ||
    field.sampleSummary.policy !== "included"
  );
}

function createEstimatedSuggestion(
  field: SemanticInferenceField,
  outputContract: SemanticAiOutputContractLimits,
) {
  const reserveOptionalOutput = isComplexOutputLikely(field);
  const longestType = getLongestValue(
    Object.values(semanticTypeRegistry).map((definition) => definition.id),
  );
  const alternatives = reserveOptionalOutput
    ? Array.from({ length: outputContract.maxAlternatives }, () => ({
        semanticType: longestType,
        businessMeaning: "x".repeat(
          outputContract.businessMeaning.generationTarget,
        ),
        semanticConfidence: 0.99,
        reason: "x".repeat(
          outputContract.alternativeReason.generationTarget,
        ),
      }))
    : [];

  return {
    stableFieldKey: field.stableFieldKey,
    semanticType: longestType,
    businessMeaning: "x".repeat(
      outputContract.businessMeaning.generationTarget,
    ),
    semanticConfidence: 0.99,
    explanation: "x".repeat(
      outputContract.explanation.generationTarget,
    ),
    alternatives,
    ambiguity: reserveOptionalOutput
      ? "x".repeat(outputContract.ambiguity.generationTarget)
      : null,
  };
}

function estimateBatchOutputTokens(
  fields: readonly SemanticInferenceField[],
  outputContract: SemanticAiOutputContractLimits,
): number {
  const outputCharacters = JSON.stringify({
    suggestions: fields.map((field) =>
      createEstimatedSuggestion(field, outputContract),
    ),
  }).length;

  return Math.ceil(
    outputCharacters * SEMANTIC_AI_OUTPUT_TOKENS_PER_CHARACTER,
  );
}

function assertPlannerConfiguration(
  outputTokenBudget: number,
  budgetUtilization: number,
  maxFieldsPerBatch: number,
) {
  if (!Number.isInteger(outputTokenBudget) || outputTokenBudget < 1) {
    throw new Error("Semantic AI output token budget must be a positive integer.");
  }

  if (
    !Number.isFinite(budgetUtilization) ||
    budgetUtilization <= 0 ||
    budgetUtilization >= 1
  ) {
    throw new Error("Semantic AI budget utilization must be between 0 and 1.");
  }

  if (!Number.isInteger(maxFieldsPerBatch) || maxFieldsPerBatch < 1) {
    throw new Error("Semantic AI batch hard cap must be a positive integer.");
  }
}

function getTargetFields(
  context: SemanticInferenceContext,
  targetFieldKeys: readonly string[] | undefined,
): SemanticInferenceField[] {
  if (targetFieldKeys === undefined) {
    return [...context.fields];
  }

  const requestedKeys = new Set<string>();

  for (const key of targetFieldKeys) {
    if (requestedKeys.has(key)) {
      throw new Error("Semantic AI batch targets must not contain duplicate keys.");
    }

    requestedKeys.add(key);
  }

  const fieldByKey = new Map(
    context.fields.map((field) => [field.stableFieldKey, field]),
  );

  return targetFieldKeys.map((key) => {
    const field = fieldByKey.get(key);

    if (!field) {
      throw new Error("Semantic AI batch target was not found in the inference context.");
    }

    return field;
  });
}

export function getSemanticAiOutputSafetyThreshold(
  maxOutputTokens = SEMANTIC_AI_MAX_OUTPUT_TOKENS,
  budgetUtilization = SEMANTIC_AI_OUTPUT_BUDGET_UTILIZATION,
): number {
  return Math.floor(maxOutputTokens * budgetUtilization);
}

function getRequestedMaxTokens(
  estimatedOutputTokens: number,
  maxOutputTokens: number,
  budgetUtilization: number,
): number {
  return Math.min(
    maxOutputTokens,
    Math.max(
      SEMANTIC_AI_MIN_REQUESTED_OUTPUT_TOKENS,
      Math.ceil(estimatedOutputTokens / budgetUtilization),
    ),
  );
}

export function planSemanticInferenceBatches({
  context,
  targetFieldKeys,
  outputContract = SEMANTIC_AI_OUTPUT_CONTRACT,
  maxOutputTokens = SEMANTIC_AI_MAX_OUTPUT_TOKENS,
  budgetUtilization = SEMANTIC_AI_OUTPUT_BUDGET_UTILIZATION,
  maxFieldsPerBatch = MAX_FIELDS_PER_SEMANTIC_AI_BATCH,
}: SemanticAiBatchPlannerInput): SemanticAiBatchPlan[] {
  assertPlannerConfiguration(
    maxOutputTokens,
    budgetUtilization,
    maxFieldsPerBatch,
  );

  const fields = getTargetFields(context, targetFieldKeys);
  const safeOutputTokenThreshold = getSemanticAiOutputSafetyThreshold(
    maxOutputTokens,
    budgetUtilization,
  );
  const plans: SemanticAiBatchPlan[] = [];
  let currentFields: SemanticInferenceField[] = [];

  function flushCurrentBatch() {
    if (currentFields.length === 0) {
      return;
    }

    const estimatedOutputTokens = estimateBatchOutputTokens(
      currentFields,
      outputContract,
    );

    plans.push({
      targetFieldKeys: currentFields.map((field) => field.stableFieldKey),
      estimatedOutputTokens,
      requestedMaxTokens: getRequestedMaxTokens(
        estimatedOutputTokens,
        maxOutputTokens,
        budgetUtilization,
      ),
    });
    currentFields = [];
  }

  for (const field of fields) {
    const candidateFields = [...currentFields, field];
    const estimatedOutputTokens = estimateBatchOutputTokens(
      candidateFields,
      outputContract,
    );
    const exceedsBudget = estimatedOutputTokens > safeOutputTokenThreshold;
    const reachesHardCap = candidateFields.length > maxFieldsPerBatch;

    if (currentFields.length > 0 && (exceedsBudget || reachesHardCap)) {
      flushCurrentBatch();
    }

    const singleFieldEstimate = estimateBatchOutputTokens(
      [field],
      outputContract,
    );

    if (singleFieldEstimate > safeOutputTokenThreshold) {
      throw new Error(
        "A single semantic AI field exceeds the safe output token threshold.",
      );
    }

    currentFields.push(field);
  }

  flushCurrentBatch();

  return plans;
}
