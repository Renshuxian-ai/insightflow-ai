import type { DatasetSchema } from "@/lib/datasets/types";

import type {
  SemanticFieldMapping,
  SemanticSchema,
  SemanticSuggestion,
  SemanticSuggestionBatch,
} from "./types";

function cloneSuggestion(
  suggestion: SemanticSuggestion,
): SemanticSuggestion {
  return {
    ...suggestion,
    alternatives: suggestion.alternatives.map((alternative) => ({
      ...alternative,
    })),
  };
}

export function buildSemanticSchemaDraft(
  physicalSchema: DatasetSchema,
  suggestionBatch: SemanticSuggestionBatch,
): SemanticSchema {
  const suggestionSource = suggestionBatch.physicalSchema;

  if (
    suggestionSource.datasetId !== physicalSchema.datasetId ||
    suggestionSource.physicalSchemaVersion !== physicalSchema.version ||
    suggestionSource.schemaFingerprint !== physicalSchema.schemaFingerprint ||
    suggestionSource.selectedSheetName !== physicalSchema.selectedSheetName
  ) {
    throw new Error(
      "Semantic suggestions do not belong to the current physical schema.",
    );
  }

  const suggestionByFieldKey = new Map<string, SemanticSuggestion>();
  const availableFieldKeys = new Set(
    physicalSchema.fields.map((field) => field.stableFieldKey),
  );

  for (const suggestion of suggestionBatch.suggestions) {
    if (!availableFieldKeys.has(suggestion.stableFieldKey)) {
      throw new Error(
        `Semantic suggestion references an unknown field: ${suggestion.stableFieldKey}.`,
      );
    }

    if (suggestionByFieldKey.has(suggestion.stableFieldKey)) {
      throw new Error(
        `Semantic suggestion is duplicated for field: ${suggestion.stableFieldKey}.`,
      );
    }

    suggestionByFieldKey.set(
      suggestion.stableFieldKey,
      cloneSuggestion(suggestion),
    );
  }

  const fields: SemanticFieldMapping[] = physicalSchema.fields.map((field) => {
    const suggestion = suggestionByFieldKey.get(field.stableFieldKey) ?? null;

    return {
      fieldId: field.id,
      stableFieldKey: field.stableFieldKey,
      fieldIndex: field.index,
      originalName: field.originalName,
      suggestion,
      resolution: suggestion
        ? { status: "suggested" }
        : {
            status: "unresolved",
            reason: "No semantic suggestion was generated for this field.",
          },
    };
  });

  return {
    id: `semantic-schema_${physicalSchema.datasetId}_${physicalSchema.schemaFingerprint}`,
    physicalSchema: {
      datasetId: physicalSchema.datasetId,
      physicalSchemaVersion: physicalSchema.version,
      schemaFingerprint: physicalSchema.schemaFingerprint,
      selectedSheetName: physicalSchema.selectedSheetName,
    },
    semanticSchemaVersion: 1,
    status: "draft",
    retention: "session-only",
    fields,
  };
}
