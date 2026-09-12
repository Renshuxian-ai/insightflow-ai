import "server-only";

import {
  ProviderRequestError,
  ProviderUnavailableError,
} from "@/lib/ai/provider";
import {
  createAcceptedResolution,
  mergeSemanticSchemaDraft,
} from "@/lib/datasets/semantic/review-state";
import { createSemanticAutoUsePolicy } from "@/lib/datasets/semantic/auto-use-policy";

import { SemanticAiOutputValidationError } from "./ai-output-schema";
import {
  SemanticAiBatchGenerationError,
  SemanticAiFieldValidationError,
} from "./semantic-ai-generator";
import { createSemanticInference } from "./semantic-inference";
import type {
  SemanticInferenceContext,
  SemanticSchema,
  SemanticSuggestion,
  SemanticSuggestionBatch,
} from "../types";

const fixtureContext: SemanticInferenceContext = {
  physicalSchema: {
    datasetId: "semantic-inference-fixture",
    physicalSchemaVersion: 1,
    schemaFingerprint: "semantic-inference-fixture-v1",
    selectedSheetName: null,
  },
  profileScope: {
    totalRows: 4,
    profiledRows: 4,
    isComplete: true,
  },
  physicalWarnings: [],
  fields: [
    {
      stableFieldKey: "field_event_name",
      fieldName: "event_name",
      detectedPhysicalType: "string",
      physicalTypeConfidence: 1,
      nullRate: 0,
      distinctCount: 3,
      isDistinctCountExact: true,
      distinctRate: 0.75,
      safeStatistics: { kind: "none", valuesRedacted: false },
      sanitizedSamples: ["page_view", "purchase"],
      sampleSummary: {
        observedSampleCount: 2,
        includedSampleCount: 2,
        redactedSampleCount: 0,
        minimumTextLength: 8,
        maximumTextLength: 9,
        policy: "included",
      },
      neighboringFieldNames: ["session_id"],
      heuristicCandidates: [
        {
          semanticRole: "dimension",
          semanticType: "event-name",
          businessMeaning: "Tracked product event name",
          semanticConfidence: 0.9,
          reason: "Fixture deterministic evidence.",
        },
      ],
      physicalWarnings: [],
    },
    {
      stableFieldKey: "field_mystery_value",
      fieldName: "mystery_value",
      detectedPhysicalType: "number",
      physicalTypeConfidence: 1,
      nullRate: 0,
      distinctCount: 4,
      isDistinctCountExact: true,
      distinctRate: 1,
      safeStatistics: { kind: "numeric", min: 1, max: 4, mean: 2.5 },
      sanitizedSamples: [1, 2, 3],
      sampleSummary: {
        observedSampleCount: 3,
        includedSampleCount: 3,
        redactedSampleCount: 0,
        minimumTextLength: null,
        maximumTextLength: null,
        policy: "included",
      },
      neighboringFieldNames: ["event_name"],
      heuristicCandidates: [
        {
          semanticRole: "unknown",
          semanticType: "unknown",
          businessMeaning: null,
          semanticConfidence: 0.4,
          reason: "Fixture deterministic ambiguity.",
        },
      ],
      physicalWarnings: [],
    },
  ],
};

function createSuggestion(
  stableFieldKey: string,
  inferenceSource: SemanticSuggestion["inferenceSource"],
): SemanticSuggestion {
  const isAi = inferenceSource === "ai";

  return {
    id: `semantic-suggestion_${stableFieldKey}_${inferenceSource}-v1`,
    stableFieldKey,
    semanticRole: isAi ? "dimension" : "unknown",
    semanticType: isAi ? "event-name" : "unknown",
    businessMeaning: isAi ? "Tracked product event name" : null,
    semanticConfidence: isAi ? 0.96 : 0.4,
    inferenceSource,
    explanation: isAi
      ? "The field name and samples identify product event names."
      : "The deterministic profile cannot identify a specific business meaning.",
    alternatives: [],
    ambiguity: isAi ? null : "This field needs review.",
  };
}

function createDeterministicBatch(): SemanticSuggestionBatch {
  return {
    physicalSchema: { ...fixtureContext.physicalSchema },
    suggestions: fixtureContext.fields.map((field) =>
      createSuggestion(field.stableFieldKey, "heuristic"),
    ),
  };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function assertSuccessfulMerge() {
  const deterministicContexts: SemanticInferenceContext[] = [];
  const aiInputs: Array<{
    context: SemanticInferenceContext;
    modelId: string;
    datasetContext?: string | null;
  }> = [];
  const inference = createSemanticInference({
    generateDeterministicSuggestions(context) {
      deterministicContexts.push(context);
      return createDeterministicBatch();
    },
    async generateAiSuggestions(input) {
      aiInputs.push(input);
      return [createSuggestion("field_event_name", "ai")];
    },
    isDevelopment: () => false,
  });
  const result = await inference({
    context: fixtureContext,
    modelId: "deepseek-v3",
    datasetContext: "Product event data.",
  });

  assert(result.inferenceMode === "ai-assisted", "A partial AI result must have mixed top-level provenance.");
  assert(result.fallbackReason === null, "A valid AI result must not have a fallback reason.");
  assert(deterministicContexts[0] === fixtureContext, "Deterministic inference must use the original safe context.");
  assert(aiInputs[0]?.context === fixtureContext, "AI inference must use the original safe context, not deterministic output.");
  assert(aiInputs[0]?.modelId === "deepseek-v3", "Expected the configured semantic model ID.");
  assert(aiInputs[0]?.datasetContext === "Product event data.", "Expected dataset context to be forwarded only to AI inference.");
  assert(result.suggestionBatch.suggestions.length === 2, "Missing AI fields must retain deterministic suggestions.");
  assert(result.suggestionBatch.suggestions[0]?.inferenceSource === "ai", "A valid AI field suggestion must win the merge.");
  assert(result.suggestionBatch.suggestions[1]?.inferenceSource === "heuristic", "An omitted AI field must use deterministic evidence.");

  const policy = createSemanticAutoUsePolicy(
    fixtureContext,
    result.suggestionBatch,
    "Product event data.",
  );
  assert(policy.assessments.length === fixtureContext.fields.length, "Mixed provenance must not bypass or alter Auto-use assessment coverage.");
  assert(policy.assessments[0]?.baseStatus === "needs-review", "Mixed provenance must continue using the existing Auto-use thresholds.");
}

async function assertAllAiProvenance() {
  const inference = createSemanticInference({
    generateDeterministicSuggestions: createDeterministicBatch,
    async generateAiSuggestions() {
      return fixtureContext.fields.map((field) =>
        createSuggestion(field.stableFieldKey, "ai"),
      );
    },
    isDevelopment: () => false,
  });
  const result = await inference({
    context: fixtureContext,
    modelId: "deepseek-v3",
  });

  assert(result.inferenceMode === "ai", "Only an all-field AI result may claim AI provenance.");
  assert(result.fallbackReason === null, "An all-field AI result must not report fallback.");
}

async function assertContainedFailureTelemetry() {
  const diagnostics: string[] = [];
  const inference = createSemanticInference({
    generateDeterministicSuggestions: createDeterministicBatch,
    async generateAiSuggestions(input) {
      input.onBatchFailure?.(
        new SemanticAiBatchGenerationError(
          {
            batchIndex: 2,
            totalBatches: 3,
            targetFieldCount: 1,
            estimatedOutputTokens: 400,
            requestedMaxTokens: 800,
            plannedSafetyRatio: 0.3,
          },
          new ProviderRequestError(
            "deepseek",
            "invalid-json",
            "Raw invalid JSON is intentionally omitted.",
          ),
        ),
      );
      input.onFieldFailure?.(
        new SemanticAiFieldValidationError(
          {
            batchIndex: 1,
            totalBatches: 3,
            targetFieldCount: 1,
            estimatedOutputTokens: 400,
            requestedMaxTokens: 800,
            plannedSafetyRatio: 0.3,
          },
          {
            path: "semanticAiSuggestions[0].alternatives[0].semanticType",
            reason: "invalid semantic type.",
            expected: "a registered SemanticType",
            receivedType: "string",
            receivedSummary: "string(length=14)",
          },
        ),
      );

      return [createSuggestion("field_event_name", "ai")];
    },
    isDevelopment: () => true,
    logDiagnostic(message) {
      diagnostics.push(message);
    },
  });
  const result = await inference({
    context: fixtureContext,
    modelId: "deepseek-v3",
  });
  const summary = diagnostics.at(-1);

  assert(result.inferenceMode === "ai-assisted", "Contained failures must produce mixed top-level provenance when AI fields survive.");
  assert(result.suggestionBatch.suggestions[0]?.inferenceSource === "ai", "A valid AI field must survive another field or batch failure.");
  assert(result.suggestionBatch.suggestions[1]?.inferenceSource === "heuristic", "The affected field must retain deterministic provenance.");
  assert(diagnostics.length === 3, "Contained failures must emit two safe diagnostics and one summary in development.");
  assert(diagnostics[0]?.includes("failureScope=batch"), "A structural/provider batch failure must be identified as batch-scoped.");
  assert(diagnostics[1]?.includes("failureScope=field"), "A suggestion validation failure must be identified as field-scoped.");
  assert(summary?.includes("aiSuggestionCount=1"), "Telemetry must count retained AI suggestions.");
  assert(summary?.includes("deterministicFallbackFieldCount=1"), "Telemetry must count deterministic fallback fields.");
  assert(summary?.includes("failedBatchCount=1"), "Telemetry must count failed batches.");
  assert(summary?.includes("failedFieldCount=1"), "Telemetry must count failed field suggestions.");
  assert(!diagnostics.join("\n").includes("Raw invalid JSON"), "Telemetry and diagnostics must not expose raw model output.");
}

async function assertFailureFallbacks() {
  const failures = [
    {
      error: new ProviderUnavailableError("deepseek"),
      fallbackReason: "provider-failure",
      stage: "provider-response",
      receivedType: "none",
    },
    {
      error: new ProviderRequestError(
        "deepseek",
        "invalid-response",
        "Raw provider response must never be logged.",
      ),
      fallbackReason: "provider-failure",
      stage: "provider-response",
      receivedType: "unknown",
    },
    {
      error: new ProviderRequestError(
        "deepseek",
        "invalid-json",
        "Raw model output must never be logged.",
        undefined,
        {
          contentLength: 842,
          startsWithCodeFence: true,
          startsWithObject: false,
          endsWithObject: false,
          hasLeadingText: false,
          finishReason: "stop",
          usagePresent: true,
          completionTokens: 291,
          requestedMaxTokens: 4_200,
          possiblyTruncated: false,
        },
      ),
      fallbackReason: "structured-json-failure",
      stage: "json-parse",
      receivedType: "string",
    },
    {
      error: new SemanticAiOutputValidationError({
        path: "semanticAiResponse.suggestions",
        reason: "missing field.",
        expected: "array",
        receivedType: "undefined",
        receivedSummary: "missing",
      }),
      fallbackReason: "semantic-validation-failure",
      stage: "structured-envelope",
      receivedType: "undefined",
    },
    {
      error: new SemanticAiOutputValidationError({
        path: "semanticAiSuggestions[0].semanticType",
        reason: "invalid semantic type.",
        expected: "a registered SemanticType",
        receivedType: "string",
        receivedSummary: "string(length=14)",
      }),
      fallbackReason: "semantic-validation-failure",
      stage: "semantic-validation",
      receivedType: "string",
    },
  ] as const;

  for (const failure of failures) {
    const diagnostics: string[] = [];
    const inference = createSemanticInference({
      generateDeterministicSuggestions: createDeterministicBatch,
      async generateAiSuggestions() {
        throw new SemanticAiBatchGenerationError(
          {
            batchIndex: 2,
            totalBatches: 3,
            targetFieldCount: 8,
            estimatedOutputTokens: 2_940,
            requestedMaxTokens: 4_200,
            plannedSafetyRatio: 0.3,
          },
          failure.error,
        );
      },
      isDevelopment: () => true,
      logDiagnostic(message) {
        diagnostics.push(message);
      },
    });
    const result = await inference({
      context: fixtureContext,
      modelId: "deepseek-v3",
    });

    assert(result.inferenceMode === "deterministic-fallback", "Every AI failure must retain a usable deterministic result.");
    assert(result.fallbackReason === failure.fallbackReason, "AI failures must retain their safe failure category.");
    assert(result.suggestionBatch.suggestions.every((suggestion) => suggestion.inferenceSource === "heuristic"), "Production fallback must never emit mock suggestions.");
    assert(diagnostics.length === 2, "Development fallback diagnostics should contain one safe failure message and one summary.");
    assert(!diagnostics[0]?.includes("Raw model output"), "Fallback diagnostics must not include provider error content.");
    assert(!diagnostics[0]?.includes("Raw provider response"), "Fallback diagnostics must not include provider response content.");
    assert(diagnostics[0]?.includes("Semantic AI structured generation failed:"), "Fallback diagnostics must have a stable structured-generation heading.");
    assert(diagnostics[0]?.includes(`stage=${failure.stage}`), "Fallback diagnostics must identify the failure stage.");
    assert(diagnostics[0]?.includes(`failureStage=${failure.stage}`), "Batch diagnostics must identify the failure stage explicitly.");
    assert(diagnostics[0]?.includes("failureScope=inference"), "Unexpected whole-generator failures must remain inference-scoped.");
    assert(diagnostics[0]?.includes("batchIndex=2"), "Batch diagnostics must include a safe one-based batch index.");
    assert(diagnostics[0]?.includes("totalBatches=3"), "Batch diagnostics must include the total batch count.");
    assert(diagnostics[0]?.includes("targetFieldCount=8"), "Batch diagnostics must include only the target field count, not keys.");
    assert(diagnostics[0]?.includes("estimatedOutputTokens=2940"), "Batch diagnostics must include the planned output estimate.");
    assert(diagnostics[0]?.includes("requestedMaxTokens=4200"), "Batch diagnostics must include the bounded request limit.");
    assert(diagnostics[0]?.includes("plannedSafetyRatio=0.30"), "Batch diagnostics must include the planned safety ratio.");
    assert(diagnostics[0]?.includes("reason="), "Fallback diagnostics must include a safe reason.");
    assert(diagnostics[0]?.includes("expected="), "Fallback diagnostics must include the expected structure.");
    assert(diagnostics[0]?.includes(`receivedType=${failure.receivedType}`), "Fallback diagnostics must include the safe received type.");
    assert(diagnostics[0]?.includes("receivedSummary="), "Fallback diagnostics must include a bounded received summary.");
    assert(diagnostics[0]?.includes(`fallbackCategory=${failure.fallbackReason}`), "Diagnostics must retain the unchanged fallback category.");

    if (failure.error instanceof SemanticAiOutputValidationError) {
      assert(
        diagnostics[0]?.includes(
          `validationPath=${failure.error.diagnostic.path}`,
        ),
        "Semantic validation diagnostics must include the safe validation path.",
      );
    }

    if (failure.stage === "json-parse") {
      assert(diagnostics[0]?.includes("contentLength=842"), "JSON parse diagnostics must include content length without content.");
      assert(diagnostics[0]?.includes("startsWithCodeFence=true"), "JSON parse diagnostics must include the code-fence shape flag.");
      assert(diagnostics[0]?.includes("finishReason=stop"), "JSON parse diagnostics must include the safe finish reason.");
      assert(diagnostics[0]?.includes("possiblyTruncated=false"), "JSON parse diagnostics must include the truncation signal.");
    }

    assert(diagnostics[1]?.includes("aiSuggestionCount=0"), "Whole fallback telemetry must report zero AI suggestions.");
    assert(diagnostics[1]?.includes("deterministicFallbackFieldCount=2"), "Whole fallback telemetry must report all deterministic fields.");
    assert(diagnostics[1]?.includes("failedBatchCount=1"), "Whole fallback telemetry must count the failed generation boundary.");
    assert(diagnostics[1]?.includes("failedFieldCount=0"), "Whole fallback telemetry must not invent field failures.");
  }
}

function assertHumanResolutionIsPreserved() {
  const previousSuggestion = {
    ...createSuggestion("field_event_name", "ai"),
    explanation: "The original AI explanation was accepted by the user.",
  };
  const previousField = {
    fieldId: "fixture-field-event-name",
    stableFieldKey: "field_event_name",
    fieldIndex: 0,
    originalName: "event_name",
    suggestion: previousSuggestion,
    resolution: { status: "suggested" as const },
  };
  const previousSchema: SemanticSchema = {
    id: "semantic-schema_human-resolution-fixture",
    physicalSchema: { ...fixtureContext.physicalSchema },
    semanticSchemaVersion: 1,
    status: "in-review",
    retention: "session-only",
    fields: [
      {
        ...previousField,
        resolution: createAcceptedResolution(previousField),
      },
    ],
  };
  const refreshedSchema: SemanticSchema = {
    ...previousSchema,
    semanticSchemaVersion: 1,
    fields: [
      {
        ...previousField,
        suggestion: {
          ...previousSuggestion,
          explanation: "A regenerated AI explanation that must not overwrite the accepted review.",
        },
        resolution: { status: "suggested" },
      },
    ],
  };
  const mergedSchema = mergeSemanticSchemaDraft(previousSchema, refreshedSchema);
  const mergedField = mergedSchema.fields[0];

  assert(mergedField?.resolution.status === "accepted", "Regeneration must preserve an accepted human resolution.");
  assert(mergedField?.suggestion?.explanation === previousSuggestion.explanation, "Regeneration must not replace the suggestion associated with a human decision.");
}

export async function runSemanticInferenceFixtures() {
  await assertSuccessfulMerge();
  await assertAllAiProvenance();
  await assertContainedFailureTelemetry();
  await assertFailureFallbacks();
  assertHumanResolutionIsPreserved();
}
