import "server-only";

import type { DatasetSchema } from "@/lib/datasets/types";

import { getHeuristicSemanticCandidates } from "../heuristics";
import type { SemanticInferenceContext } from "../types";
import {
  sanitizeFieldName,
  sanitizeFieldSamples,
  sanitizeFieldStatistics,
} from "./sanitize-context";

function getDistinctRate(distinctCount: number, profiledRows: number): number {
  if (profiledRows === 0) {
    return 0;
  }

  return Math.min(1, distinctCount / profiledRows);
}

function getNeighboringFieldNames(
  schema: DatasetSchema,
  fieldIndex: number,
): string[] {
  return schema.fields
    .filter((field) => Math.abs(field.index - fieldIndex) === 1)
    .sort((left, right) => left.index - right.index)
    .map((field) => sanitizeFieldName(field.displayName));
}

export function buildSemanticInferenceContext(
  schema: DatasetSchema,
): SemanticInferenceContext {
  return {
    physicalSchema: {
      datasetId: schema.datasetId,
      physicalSchemaVersion: schema.version,
      schemaFingerprint: schema.schemaFingerprint,
      selectedSheetName: schema.selectedSheetName,
    },
    profileScope: { ...schema.profileScope },
    physicalWarnings: schema.warnings.map((warning) => warning.code),
    fields: schema.fields.map((field) => {
      const distinctRate = getDistinctRate(
        field.distinctCount,
        schema.profileScope.profiledRows,
      );
      const heuristicCandidates = getHeuristicSemanticCandidates(field);
      const samples = sanitizeFieldSamples(
        field,
        heuristicCandidates,
        distinctRate,
      );

      return {
        stableFieldKey: field.stableFieldKey,
        fieldName: sanitizeFieldName(field.displayName),
        detectedPhysicalType: field.detectedType,
        physicalTypeConfidence: field.typeConfidence,
        nullRate: field.nullRate,
        distinctCount: field.distinctCount,
        isDistinctCountExact: field.isDistinctCountExact,
        distinctRate,
        safeStatistics: sanitizeFieldStatistics(field, samples),
        sanitizedSamples: samples.values,
        sampleSummary: samples.summary,
        neighboringFieldNames: getNeighboringFieldNames(schema, field.index),
        heuristicCandidates,
        physicalWarnings: field.warnings.map((warning) => warning.code),
      };
    }),
  };
}
