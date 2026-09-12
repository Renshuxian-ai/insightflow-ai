import "server-only";

import {
  generateStructuredJson,
  type StructuredJsonGenerationRequest,
} from "@/lib/ai/structured-json";
import type { AIModelId } from "@/lib/ai/types";

import {
  SemanticAiOutputValidationError,
  stampSemanticAiSuggestions,
  unwrapSemanticAiSuggestionResponse,
  validateSemanticAiSuggestionBatchOutput,
  type SemanticAiOutputValidationDiagnostic,
} from "./ai-output-schema";
import {
  planSemanticInferenceBatches,
  SEMANTIC_AI_OUTPUT_BUDGET_UTILIZATION,
} from "./semantic-ai-batch-planner";
import { buildSemanticAiPrompt } from "./semantic-ai-prompt";
import type {
  SemanticAiSuggestionOutput,
  SemanticInferenceContext,
  SemanticSuggestion,
} from "../types";

export type SemanticAiSuggestionGenerationInput = {
  context: SemanticInferenceContext;
  modelId: AIModelId;
  datasetContext?: string | null;
  onBatchFailure?: (failure: SemanticAiBatchGenerationError) => void;
  onFieldFailure?: (failure: SemanticAiFieldValidationError) => void;
};

type StructuredJsonGenerator = (
  request: StructuredJsonGenerationRequest,
) => Promise<unknown>;

export type SemanticAiBatchTelemetry = {
  batchIndex: number;
  totalBatches: number;
  targetFieldCount: number;
  estimatedOutputTokens: number;
  requestedMaxTokens: number;
  plannedSafetyRatio: number;
};

export class SemanticAiBatchGenerationError extends Error {
  constructor(
    readonly batchTelemetry: SemanticAiBatchTelemetry,
    readonly batchCause: unknown,
  ) {
    super("Semantic AI batch generation failed.");
    this.name = "SemanticAiBatchGenerationError";
  }
}

export class SemanticAiFieldValidationError extends Error {
  constructor(
    readonly batchTelemetry: SemanticAiBatchTelemetry,
    readonly fieldDiagnostic: SemanticAiOutputValidationDiagnostic,
  ) {
    super("Semantic AI field suggestion validation failed.");
    this.name = "SemanticAiFieldValidationError";
  }
}

function createBatchContext(
  context: SemanticInferenceContext,
  targetFieldKeys: readonly string[],
): SemanticInferenceContext {
  const targetFieldKeySet = new Set(targetFieldKeys);

  return {
    physicalSchema: { ...context.physicalSchema },
    profileScope: { ...context.profileScope },
    physicalWarnings: [...context.physicalWarnings],
    fields: context.fields.filter((field) =>
      targetFieldKeySet.has(field.stableFieldKey),
    ),
  };
}

function orderValidatedOutputs(
  context: SemanticInferenceContext,
  outputs: readonly SemanticAiSuggestionOutput[],
): SemanticAiSuggestionOutput[] {
  const outputByFieldKey = new Map<string, SemanticAiSuggestionOutput>();
  const contextFieldKeys = new Set(
    context.fields.map((field) => field.stableFieldKey),
  );

  for (const output of outputs) {
    if (!contextFieldKeys.has(output.stableFieldKey)) {
      throw new SemanticAiOutputValidationError({
        path: "semanticAiSuggestions",
        reason: "unknown field reference after batch validation.",
        expected: "a stableFieldKey from the inference context",
        receivedType: "string",
        receivedSummary: "string(field not found)",
      });
    }

    if (outputByFieldKey.has(output.stableFieldKey)) {
      throw new SemanticAiOutputValidationError({
        path: "semanticAiSuggestions",
        reason: "duplicate stableFieldKey values across AI batches.",
        expected: "at most one suggestion for each inference-context field",
        receivedType: "array",
        receivedSummary: "array(contains duplicate stableFieldKey)",
      });
    }

    outputByFieldKey.set(output.stableFieldKey, output);
  }

  return context.fields.flatMap((field) => {
    const output = outputByFieldKey.get(field.stableFieldKey);
    return output ? [output] : [];
  });
}

export function createSemanticAiSuggestionGenerator(
  structuredJsonGenerator: StructuredJsonGenerator = generateStructuredJson,
) {
  return async function generateSemanticAiSuggestions({
    context,
    modelId,
    datasetContext,
    onBatchFailure,
    onFieldFailure,
  }: SemanticAiSuggestionGenerationInput): Promise<SemanticSuggestion[]> {
    const validatedOutputs: SemanticAiSuggestionOutput[] = [];
    const batchPlans = planSemanticInferenceBatches({ context });

    for (const [batchIndex, batchPlan] of batchPlans.entries()) {
      const batchTelemetry = {
        batchIndex: batchIndex + 1,
        totalBatches: batchPlans.length,
        targetFieldCount: batchPlan.targetFieldKeys.length,
        estimatedOutputTokens: batchPlan.estimatedOutputTokens,
        requestedMaxTokens: batchPlan.requestedMaxTokens,
        plannedSafetyRatio: 1 - SEMANTIC_AI_OUTPUT_BUDGET_UTILIZATION,
      } satisfies SemanticAiBatchTelemetry;

      try {
        const batchContext = createBatchContext(
          context,
          batchPlan.targetFieldKeys,
        );
        const { systemPrompt, userPrompt } = buildSemanticAiPrompt({
          context,
          targetFieldKeys: batchPlan.targetFieldKeys,
          datasetContext,
        });
        const rawResponse = await structuredJsonGenerator({
          modelId,
          systemPrompt,
          userPrompt,
          maxTokens: batchPlan.requestedMaxTokens,
        });
        const rawSuggestions = unwrapSemanticAiSuggestionResponse(rawResponse);
        const validation = validateSemanticAiSuggestionBatchOutput(
          rawSuggestions,
          batchContext,
        );

        validatedOutputs.push(...validation.validOutputs);

        for (const fieldDiagnostic of validation.invalidSuggestions) {
          onFieldFailure?.(
            new SemanticAiFieldValidationError(
              batchTelemetry,
              fieldDiagnostic,
            ),
          );
        }
      } catch (error) {
        onBatchFailure?.(
          new SemanticAiBatchGenerationError(batchTelemetry, error),
        );
      }
    }

    return stampSemanticAiSuggestions(
      orderValidatedOutputs(context, validatedOutputs),
    );
  };
}

export const generateSemanticAiSuggestions =
  createSemanticAiSuggestionGenerator();
