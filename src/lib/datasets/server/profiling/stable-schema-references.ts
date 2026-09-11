import "server-only";

import { createHash } from "node:crypto";

import type { FieldDataType } from "@/lib/datasets/types";

type StableSchemaField = {
  index: number;
  originalName: string;
  detectedType: FieldDataType;
};

function hashStableValue(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function normalizeSchemaLabel(value: string | null): string | null {
  if (value === null) {
    return null;
  }

  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

export function createStableFieldKey(
  selectedSheetName: string | null,
  fieldIndex: number,
  originalName: string,
): string {
  const fingerprintInput = {
    algorithmVersion: 1,
    selectedSheetName: normalizeSchemaLabel(selectedSheetName),
    fieldIndex,
    normalizedHeader: normalizeSchemaLabel(originalName),
  };

  return `field_${hashStableValue(fingerprintInput)}`;
}

export function createSchemaFingerprint(
  selectedSheetName: string | null,
  fields: readonly StableSchemaField[],
): string {
  const fingerprintInput = {
    algorithmVersion: 1,
    selectedSheetName: normalizeSchemaLabel(selectedSheetName),
    fields: fields.map((field) => ({
      index: field.index,
      normalizedHeader: normalizeSchemaLabel(field.originalName),
      detectedType: field.detectedType,
    })),
  };

  return `schema_${hashStableValue(fingerprintInput)}`;
}
