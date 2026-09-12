import { SEMANTIC_TYPE_IDS } from "../semantic-type-registry";
import type {
  SemanticInferenceContext,
  SemanticInferenceField,
} from "../types";
import {
  getSemanticAiOutputSafetyThreshold,
  MAX_FIELDS_PER_SEMANTIC_AI_BATCH,
  planSemanticInferenceBatches,
  SEMANTIC_AI_MAX_OUTPUT_TOKENS,
  SEMANTIC_AI_OUTPUT_BUDGET_UTILIZATION,
  SEMANTIC_AI_OUTPUT_TOKENS_PER_CHARACTER,
} from "./semantic-ai-batch-planner";
import { SEMANTIC_AI_OUTPUT_CONTRACT } from "./semantic-ai-output-contract";

function createField(
  index: number,
  { complex = false, chinese = false } = {},
): SemanticInferenceField {
  return {
    stableFieldKey: `field_${index + 1}`,
    fieldName: chinese ? `业务字段 ${index + 1}` : `field ${index + 1}`,
    detectedPhysicalType: complex ? "mixed" : "string",
    physicalTypeConfidence: complex ? 0.65 : 1,
    nullRate: complex ? 0.25 : 0,
    distinctCount: 4,
    isDistinctCountExact: true,
    distinctRate: 0.33,
    safeStatistics: complex
      ? { kind: "none", valuesRedacted: true }
      : {
          kind: "categorical",
          topValues: [{ value: chinese ? "注册" : "signup", count: 5 }],
          valuesRedacted: false,
        },
    sanitizedSamples: complex ? [] : [chinese ? "注册" : "signup"],
    sampleSummary: {
      observedSampleCount: 1,
      includedSampleCount: complex ? 0 : 1,
      redactedSampleCount: complex ? 1 : 0,
      minimumTextLength: 2,
      maximumTextLength: 6,
      policy: complex ? "redacted-sensitive-field" : "included",
    },
    neighboringFieldNames: [],
    heuristicCandidates: [{
      semanticRole: "unknown",
      semanticType: SEMANTIC_TYPE_IDS.unknown,
      businessMeaning: null,
      semanticConfidence: 0.4,
      reason: "Planner fixture heuristic that must never enter an AI prompt.",
    }],
    physicalWarnings: [],
  };
}

function createContext(
  fieldCount: number,
  options?: { complex?: boolean; chinese?: boolean },
): SemanticInferenceContext {
  return {
    physicalSchema: {
      datasetId: "semantic-ai-capacity-fixture",
      physicalSchemaVersion: 1,
      schemaFingerprint: "semantic-ai-capacity-fixture-schema",
      selectedSheetName: null,
    },
    profileScope: {
      totalRows: 12,
      profiledRows: 12,
      isComplete: true,
    },
    physicalWarnings: [],
    fields: Array.from({ length: fieldCount }, (_, index) =>
      createField(index, options),
    ),
  };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertCoverage(
  context: SemanticInferenceContext,
  targetFieldKeys: readonly string[],
) {
  const expectedKeys = context.fields.map((field) => field.stableFieldKey);

  assert(
    targetFieldKeys.join("|") === expectedKeys.join("|"),
    "Every field must be covered exactly once in physical field order.",
  );
  assert(
    new Set(targetFieldKeys).size === targetFieldKeys.length,
    "Batch plans must not duplicate stableFieldKey values.",
  );
}

export function getSemanticAi24FieldCapacityFixturePlan() {
  return planSemanticInferenceBatches({ context: createContext(24) });
}

export function runSemanticAiBatchPlannerFixtures(): void {
  const simpleContext = createContext(24);
  const complexContext = createContext(24, { complex: true });
  const simplePlans = getSemanticAi24FieldCapacityFixturePlan();
  const complexPlans = planSemanticInferenceBatches({ context: complexContext });
  const safeThreshold = getSemanticAiOutputSafetyThreshold();
  const plannedKeys = simplePlans.flatMap((plan) => plan.targetFieldKeys);

  assert(
    simplePlans.length === 3,
    "The final compact contract should plan twenty-four simple fields into three batches.",
  );
  assert(
    simplePlans.every((plan) => plan.targetFieldKeys.length === 8),
    "The twenty-four-field fixture should produce three balanced eight-field batches.",
  );
  assertCoverage(simpleContext, plannedKeys);
  assert(
    simplePlans[0]!.targetFieldKeys.length >
      complexPlans[0]!.targetFieldKeys.length,
    "Simple fields should fit more targets than ambiguity-prone fields.",
  );
  assert(
    [...simplePlans, ...complexPlans].every(
      (plan) => plan.estimatedOutputTokens <= safeThreshold,
    ),
    "No planned batch may exceed the safe output threshold.",
  );

  const expandedContractPlans = planSemanticInferenceBatches({
    context: simpleContext,
    outputContract: {
      ...SEMANTIC_AI_OUTPUT_CONTRACT,
      businessMeaning: {
        ...SEMANTIC_AI_OUTPUT_CONTRACT.businessMeaning,
        generationTarget: 140,
        hardMax: 180,
      },
      explanation: {
        ...SEMANTIC_AI_OUTPUT_CONTRACT.explanation,
        generationTarget: 320,
        hardMax: 400,
      },
    },
  });

  assert(
    expandedContractPlans[0]!.targetFieldKeys.length <
      simplePlans[0]!.targetFieldKeys.length,
    "A larger output contract must reduce the planned batch size.",
  );

  const hardCappedPlans = planSemanticInferenceBatches({
    context: simpleContext,
    maxOutputTokens: 100_000,
    maxFieldsPerBatch: 3,
  });

  assert(
    hardCappedPlans.every((plan) => plan.targetFieldKeys.length <= 3),
    "The batch hard cap must remain effective above the budget calculation.",
  );

  const chineseContext = createContext(24, { chinese: true });
  const chinesePlans = planSemanticInferenceBatches({ context: chineseContext });

  assert(
    SEMANTIC_AI_OUTPUT_TOKENS_PER_CHARACTER > 1,
    "The planner must apply a conservative Unicode token multiplier.",
  );
  assert(
    chinesePlans.every(
      (plan) => plan.estimatedOutputTokens <= safeThreshold,
    ),
    "Chinese-context batches must remain below the conservative threshold.",
  );
  assertCoverage(
    chineseContext,
    chinesePlans.flatMap((plan) => plan.targetFieldKeys),
  );

  assert(
    safeThreshold ===
      Math.floor(
        SEMANTIC_AI_MAX_OUTPUT_TOKENS *
          SEMANTIC_AI_OUTPUT_BUDGET_UTILIZATION,
      ),
    "The safe threshold must retain the configured output safety margin.",
  );
  assert(
    [
      SEMANTIC_AI_OUTPUT_CONTRACT.businessMeaning,
      SEMANTIC_AI_OUTPUT_CONTRACT.explanation,
      SEMANTIC_AI_OUTPUT_CONTRACT.ambiguity,
      SEMANTIC_AI_OUTPUT_CONTRACT.alternativeReason,
    ].every(
      (constraint) => constraint.generationTarget < constraint.hardMax,
    ),
    "Every text contract must keep generationTarget below hardMax.",
  );
  assert(
    simplePlans.every(
      (plan) =>
        plan.targetFieldKeys.length <= MAX_FIELDS_PER_SEMANTIC_AI_BATCH &&
        plan.requestedMaxTokens <= SEMANTIC_AI_MAX_OUTPUT_TOKENS &&
        plan.estimatedOutputTokens <=
          Math.floor(
            plan.requestedMaxTokens *
              SEMANTIC_AI_OUTPUT_BUDGET_UTILIZATION,
          ),
    ),
    "Each planned request must preserve its per-batch safety reserve and hard caps.",
  );
}
