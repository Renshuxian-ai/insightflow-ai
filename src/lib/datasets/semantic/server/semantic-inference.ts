import "server-only";

import type { AIModelId } from "@/lib/ai/types";
import {
  ProviderRequestError,
  ProviderUnavailableError,
} from "@/lib/ai/provider";
import type { StructuredJsonParseDiagnostic } from "@/lib/ai/provider";

import { SemanticAiOutputValidationError } from "./ai-output-schema";
import { generateDeterministicSemanticSuggestions } from "./deterministic-suggestion-generator";
import {
  generateSemanticAiSuggestions,
  SemanticAiBatchGenerationError,
  SemanticAiFieldValidationError,
  type SemanticAiBatchTelemetry,
} from "./semantic-ai-generator";
import type {
  SemanticInferenceContext,
  SemanticInferenceMode,
  SemanticSuggestion,
  SemanticSuggestionBatch,
} from "../types";

export type SemanticAiFallbackReason =
  | "provider-failure"
  | "structured-json-failure"
  | "semantic-validation-failure";

export type SemanticInferenceResult = {
  suggestionBatch: SemanticSuggestionBatch;
  inferenceMode: SemanticInferenceMode;
  fallbackReason: SemanticAiFallbackReason | null;
};

type SemanticAiGenerator = (input: {
  context: SemanticInferenceContext;
  modelId: AIModelId;
  datasetContext?: string | null;
  onBatchFailure?: (failure: SemanticAiBatchGenerationError) => void;
  onFieldFailure?: (failure: SemanticAiFieldValidationError) => void;
}) => Promise<SemanticSuggestion[]>;

type DeterministicSuggestionGenerator = (
  context: SemanticInferenceContext,
) => SemanticSuggestionBatch;

type SemanticInferenceDependencies = {
  generateDeterministicSuggestions?: DeterministicSuggestionGenerator;
  generateAiSuggestions?: SemanticAiGenerator;
  isDevelopment?: () => boolean;
  logDiagnostic?: (message: string) => void;
};

type SemanticStructuredGenerationStage =
  | "provider-response"
  | "json-parse"
  | "structured-envelope"
  | "semantic-validation";

type SemanticStructuredGenerationDiagnostic = {
  stage: SemanticStructuredGenerationStage;
  path?: string;
  reason: string;
  expected: string;
  receivedType: string;
  receivedSummary: string;
  parseMetadata?: StructuredJsonParseDiagnostic;
};

function getBatchFailure(error: unknown): {
  cause: unknown;
  telemetry?: SemanticAiBatchTelemetry;
} {
  if (error instanceof SemanticAiBatchGenerationError) {
    return {
      cause: error.batchCause,
      telemetry: error.batchTelemetry,
    };
  }

  if (error instanceof SemanticAiFieldValidationError) {
    return {
      cause: new SemanticAiOutputValidationError(error.fieldDiagnostic),
      telemetry: error.batchTelemetry,
    };
  }

  return { cause: error };
}

function getFallbackReason(error: unknown): SemanticAiFallbackReason {
  const { cause } = getBatchFailure(error);

  if (cause instanceof SemanticAiOutputValidationError) {
    return "semantic-validation-failure";
  }

  if (
    cause instanceof ProviderRequestError &&
    cause.code === "invalid-json"
  ) {
    return "structured-json-failure";
  }

  return "provider-failure";
}

function getProviderRequestDiagnostic(
  error: ProviderRequestError,
): SemanticStructuredGenerationDiagnostic {
  if (error.code === "invalid-json") {
    return {
      stage: "json-parse",
      reason: "provider content was not valid JSON.",
      expected: "valid JSON object",
      receivedType: "string",
      receivedSummary: "non-empty string(content omitted)",
      parseMetadata: error.structuredJsonParseDiagnostic,
    };
  }

  if (error.code === "invalid-response") {
    return {
      stage: "provider-response",
      reason: "provider response did not contain usable structured content.",
      expected: "response envelope with non-empty message content",
      receivedType: "unknown",
      receivedSummary: "provider-response(code=invalid-response; details omitted)",
    };
  }

  if (error.code === "http-error") {
    return {
      stage: "provider-response",
      reason: "provider returned an unsuccessful HTTP response.",
      expected: "successful provider response",
      receivedType: "response",
      receivedSummary: Number.isInteger(error.status)
        ? `http-status(${error.status})`
        : "http-status(unavailable)",
    };
  }

  return {
    stage: "provider-response",
    reason:
      error.code === "timeout"
        ? "provider request timed out."
        : "provider request could not be completed.",
    expected: "successful provider response",
    receivedType: "none",
    receivedSummary: `provider-error(code=${error.code}; no content)`,
  };
}

function getStructuredGenerationDiagnostic(
  error: unknown,
): SemanticStructuredGenerationDiagnostic {
  if (error instanceof SemanticAiOutputValidationError) {
    const stage = error.diagnostic.path.startsWith("semanticAiResponse")
      ? "structured-envelope"
      : "semantic-validation";

    return {
      stage,
      path: error.diagnostic.path,
      reason: error.diagnostic.reason,
      expected: error.diagnostic.expected,
      receivedType: error.diagnostic.receivedType,
      receivedSummary: error.diagnostic.receivedSummary,
    };
  }

  if (error instanceof ProviderRequestError) {
    return getProviderRequestDiagnostic(error);
  }

  if (error instanceof ProviderUnavailableError) {
    return {
      stage: "provider-response",
      reason: "structured JSON provider was unavailable.",
      expected: "available structured JSON provider",
      receivedType: "none",
      receivedSummary: "no provider response",
    };
  }

  return {
    stage: "provider-response",
    reason: "structured generation failed before validated output was available.",
    expected: "validated structured JSON output",
    receivedType: "unknown",
    receivedSummary: "error(details omitted)",
  };
}

function formatStructuredGenerationDiagnostic(
  diagnostic: SemanticStructuredGenerationDiagnostic,
  fallbackReason: SemanticAiFallbackReason,
  failureScope: "batch" | "field" | "inference",
  batchTelemetry?: SemanticAiBatchTelemetry,
): string {
  return [
    "Semantic AI structured generation failed:",
    `stage=${diagnostic.stage}`,
    `failureStage=${diagnostic.stage}`,
    `failureScope=${failureScope}`,
    ...(diagnostic.path ? [`path=${diagnostic.path}`] : []),
    ...(diagnostic.path ? [`validationPath=${diagnostic.path}`] : []),
    ...(batchTelemetry
      ? [
          `batchIndex=${batchTelemetry.batchIndex}`,
          `totalBatches=${batchTelemetry.totalBatches}`,
          `targetFieldCount=${batchTelemetry.targetFieldCount}`,
          `estimatedOutputTokens=${batchTelemetry.estimatedOutputTokens}`,
          `requestedMaxTokens=${batchTelemetry.requestedMaxTokens}`,
          `plannedSafetyRatio=${batchTelemetry.plannedSafetyRatio.toFixed(2)}`,
        ]
      : []),
    `reason=${diagnostic.reason}`,
    `expected=${diagnostic.expected}`,
    `receivedType=${diagnostic.receivedType}`,
    `receivedSummary=${diagnostic.receivedSummary}`,
    ...(diagnostic.parseMetadata
      ? [
          `contentLength=${diagnostic.parseMetadata.contentLength}`,
          `startsWithCodeFence=${diagnostic.parseMetadata.startsWithCodeFence}`,
          `startsWithObject=${diagnostic.parseMetadata.startsWithObject}`,
          `endsWithObject=${diagnostic.parseMetadata.endsWithObject}`,
          `hasLeadingText=${diagnostic.parseMetadata.hasLeadingText}`,
          `finishReason=${diagnostic.parseMetadata.finishReason ?? "unavailable"}`,
          `usagePresent=${diagnostic.parseMetadata.usagePresent}`,
          `completionTokens=${diagnostic.parseMetadata.completionTokens ?? "unavailable"}`,
          ...(!batchTelemetry
            ? [`requestedMaxTokens=${diagnostic.parseMetadata.requestedMaxTokens}`]
            : []),
          `possiblyTruncated=${diagnostic.parseMetadata.possiblyTruncated}`,
        ]
      : []),
    `fallbackCategory=${fallbackReason}`,
  ].join("\n");
}

function logFallbackDiagnostic(
  error: unknown,
  fallbackReason: SemanticAiFallbackReason,
  failureScope: "batch" | "field" | "inference",
  isDevelopment: boolean,
  logDiagnostic: (message: string) => void,
) {
  if (!isDevelopment) {
    return;
  }

  const batchFailure = getBatchFailure(error);
  const diagnostic = getStructuredGenerationDiagnostic(batchFailure.cause);

  logDiagnostic(
    formatStructuredGenerationDiagnostic(
      diagnostic,
      fallbackReason,
      failureScope,
      batchFailure.telemetry,
    ),
  );
}

function getInferenceMode(
  suggestions: readonly SemanticSuggestion[],
  targetFieldCount: number,
): SemanticInferenceMode {
  const aiSuggestionCount = suggestions.filter(
    (suggestion) => suggestion.inferenceSource === "ai",
  ).length;

  if (targetFieldCount > 0 && aiSuggestionCount === targetFieldCount) {
    return "ai";
  }

  return aiSuggestionCount > 0 ? "ai-assisted" : "deterministic-fallback";
}

function logInferenceTelemetry(
  suggestions: readonly SemanticSuggestion[],
  failedBatchCount: number,
  failedFieldCount: number,
  isDevelopment: boolean,
  logDiagnostic: (message: string) => void,
) {
  if (!isDevelopment) {
    return;
  }

  const aiSuggestionCount = suggestions.filter(
    (suggestion) => suggestion.inferenceSource === "ai",
  ).length;

  logDiagnostic(
    [
      "Semantic inference resilience summary:",
      `aiSuggestionCount=${aiSuggestionCount}`,
      `deterministicFallbackFieldCount=${suggestions.length - aiSuggestionCount}`,
      `failedBatchCount=${failedBatchCount}`,
      `failedFieldCount=${failedFieldCount}`,
    ].join("\n"),
  );
}

export function mergeSemanticAiSuggestions(
  context: SemanticInferenceContext,
  deterministicSuggestionBatch: SemanticSuggestionBatch,
  aiSuggestions: readonly SemanticSuggestion[],
): SemanticSuggestionBatch {
  const deterministicByFieldKey = new Map(
    deterministicSuggestionBatch.suggestions.map((suggestion) => [
      suggestion.stableFieldKey,
      suggestion,
    ]),
  );
  const aiByFieldKey = new Map(
    aiSuggestions.map((suggestion) => [suggestion.stableFieldKey, suggestion]),
  );

  return {
    physicalSchema: { ...context.physicalSchema },
    suggestions: context.fields.flatMap((field) => {
      const suggestion =
        aiByFieldKey.get(field.stableFieldKey) ??
        deterministicByFieldKey.get(field.stableFieldKey);

      return suggestion ? [suggestion] : [];
    }),
  };
}

export function createSemanticInference(
  {
    generateDeterministicSuggestions = generateDeterministicSemanticSuggestions,
    generateAiSuggestions = generateSemanticAiSuggestions,
    isDevelopment = () => process.env.NODE_ENV === "development",
    logDiagnostic = (message) => console.error(message),
  }: SemanticInferenceDependencies = {},
) {
  return async function generateSemanticInference({
    context,
    modelId,
    datasetContext,
  }: {
    context: SemanticInferenceContext;
    modelId: AIModelId;
    datasetContext?: string | null;
  }): Promise<SemanticInferenceResult> {
    const deterministicSuggestionBatch = generateDeterministicSuggestions(context);
    const batchFailures: SemanticAiBatchGenerationError[] = [];
    const fieldFailures: SemanticAiFieldValidationError[] = [];
    const development = isDevelopment();

    try {
      const aiSuggestions = await generateAiSuggestions({
        context,
        modelId,
        datasetContext,
        onBatchFailure(failure) {
          batchFailures.push(failure);
        },
        onFieldFailure(failure) {
          fieldFailures.push(failure);
        },
      });
      const suggestionBatch = mergeSemanticAiSuggestions(
        context,
        deterministicSuggestionBatch,
        aiSuggestions,
      );

      for (const failure of batchFailures) {
        logFallbackDiagnostic(
          failure,
          getFallbackReason(failure),
          "batch",
          development,
          logDiagnostic,
        );
      }

      for (const failure of fieldFailures) {
        logFallbackDiagnostic(
          failure,
          "semantic-validation-failure",
          "field",
          development,
          logDiagnostic,
        );
      }

      logInferenceTelemetry(
        suggestionBatch.suggestions,
        batchFailures.length,
        fieldFailures.length,
        development,
        logDiagnostic,
      );

      const firstFailure = batchFailures[0] ?? fieldFailures[0];

      return {
        suggestionBatch,
        inferenceMode: getInferenceMode(
          suggestionBatch.suggestions,
          context.fields.length,
        ),
        fallbackReason: firstFailure ? getFallbackReason(firstFailure) : null,
      };
    } catch (error) {
      const fallbackReason = getFallbackReason(error);
      logFallbackDiagnostic(
        error,
        fallbackReason,
        "inference",
        development,
        logDiagnostic,
      );
      logInferenceTelemetry(
        deterministicSuggestionBatch.suggestions,
        1,
        0,
        development,
        logDiagnostic,
      );

      return {
        suggestionBatch: deterministicSuggestionBatch,
        inferenceMode: "deterministic-fallback",
        fallbackReason,
      };
    }
  };
}

export const generateSemanticInference = createSemanticInference();
