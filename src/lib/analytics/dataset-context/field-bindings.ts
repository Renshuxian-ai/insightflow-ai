import { SEMANTIC_TYPE_IDS } from "@/lib/datasets/semantic/semantic-type-registry";
import type {
  SemanticFieldMapping,
  SemanticMappingValue,
  SemanticType,
} from "@/lib/datasets/semantic/types";
import type { DatasetCellValue } from "@/lib/datasets/types";

import type {
  DatasetAnalyticsBuilderInput,
  DatasetAnalyticsFieldBinding,
} from "./types";

export function normalizeFieldName(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getEffectiveMapping(
  field: SemanticFieldMapping,
): SemanticMappingValue | null {
  if (
    field.resolution.status === "accepted" ||
    field.resolution.status === "edited"
  ) {
    return field.resolution.value;
  }

  if (field.resolution.status === "suggested") {
    return field.suggestion;
  }

  return null;
}

function isFieldBoundToDataset(
  input: DatasetAnalyticsBuilderInput,
  field: SemanticFieldMapping,
): boolean {
  const column = input.dataset.columns[field.fieldIndex];

  return Boolean(
    column &&
      column.index === field.fieldIndex &&
      column.originalName === field.originalName,
  );
}

function toBinding(field: SemanticFieldMapping): DatasetAnalyticsFieldBinding {
  return {
    stableFieldKey: field.stableFieldKey,
    originalName: field.originalName,
    fieldIndex: field.fieldIndex,
  };
}

export function findAnalyticsField(
  input: DatasetAnalyticsBuilderInput,
  options: {
    names?: readonly string[];
    semanticTypes?: readonly SemanticType[];
  },
): DatasetAnalyticsFieldBinding | null {
  const fields = input.semanticSchema.fields.filter(
    (field) => isFieldBoundToDataset(input, field) && getEffectiveMapping(field),
  );
  const requestedNames = new Set(
    (options.names ?? []).map(normalizeFieldName),
  );
  const exactNameMatch = fields.find((field) =>
    requestedNames.has(normalizeFieldName(field.originalName)),
  );

  if (exactNameMatch) {
    return toBinding(exactNameMatch);
  }

  const requestedTypes = new Set(options.semanticTypes ?? []);
  const semanticMatches = fields.filter((field) => {
    const mapping = getEffectiveMapping(field);

    return mapping ? requestedTypes.has(mapping.semanticType) : false;
  });

  return semanticMatches.length === 1 ? toBinding(semanticMatches[0]!) : null;
}

export function readCell(
  row: readonly DatasetCellValue[],
  field: DatasetAnalyticsFieldBinding,
): DatasetCellValue {
  return row[field.fieldIndex] ?? null;
}

export function toCellText(value: DatasetCellValue): string | null {
  if (value === null) {
    return null;
  }

  const text = String(value).trim();
  return text || null;
}

export function toFiniteNumber(value: DatasetCellValue): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const number = Number(value.trim());
  return Number.isFinite(number) ? number : null;
}

export function toAnalyticsDateKey(value: DatasetCellValue): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const match = value
    .trim()
    .match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T].*)?$/);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(0);

  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(0, 0, 0, 0);

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return [
    String(year).padStart(4, "0"),
    String(month).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
}

export function getPercentageScale(values: readonly number[]): 1 | 100 {
  return values.length > 0 && values.every((value) => value >= 0 && value <= 1)
    ? 100
    : 1;
}

export function toPercentage(value: number, scale: 1 | 100): number | null {
  const percentage = value * scale;

  return percentage >= 0 && percentage <= 100 ? percentage : null;
}

export function roundAnalyticsValue(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export const DATASET_ANALYTICS_SEMANTIC_TYPES = SEMANTIC_TYPE_IDS;
