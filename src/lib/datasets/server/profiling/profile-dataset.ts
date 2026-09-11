import "server-only";

import { DATASET_LIMITS } from "@/lib/datasets/constants";
import type { DatasetSchema, DatasetWarning } from "@/lib/datasets/types";

import type { ParsedDataset } from "../parsers/types";
import { FieldProfileAccumulator } from "./profile-accumulator";
import {
  createSchemaFingerprint,
  createStableFieldKey,
} from "./stable-schema-references";

export function profileDataset(
  datasetId: string,
  parsedDataset: ParsedDataset,
): DatasetSchema {
  const profiledRows = parsedDataset.rows.slice(0, DATASET_LIMITS.maxProfileRows);
  const accumulators = parsedDataset.columns.map(
    (column) =>
      new FieldProfileAccumulator(
        `${datasetId}:field:${column.index}`,
        createStableFieldKey(
          parsedDataset.selectedSheetName,
          column.index,
          column.originalName,
        ),
        column.index,
        column.originalName,
        column.displayName,
      ),
  );

  for (const row of profiledRows) {
    accumulators.forEach((accumulator, index) => {
      accumulator.observe(row[index] ?? null);
    });
  }

  const warnings: DatasetWarning[] = [...parsedDataset.warnings];
  const isComplete = profiledRows.length === parsedDataset.rowCount;

  if (!isComplete) {
    warnings.push({
      code: "profile-sampled",
      message: `The profile uses the first ${DATASET_LIMITS.maxProfileRows.toLocaleString()} rows.`,
    });
  }

  const fields = accumulators.map((accumulator) =>
    accumulator.toFieldProfile(profiledRows.length),
  );

  return {
    datasetId,
    version: 1,
    schemaFingerprint: createSchemaFingerprint(
      parsedDataset.selectedSheetName,
      fields,
    ),
    selectedSheetName: parsedDataset.selectedSheetName,
    availableSheetNames: parsedDataset.availableSheetNames,
    headerRowIndex: parsedDataset.headerRowIndex,
    fields,
    profileScope: {
      totalRows: parsedDataset.rowCount,
      profiledRows: profiledRows.length,
      isComplete,
    },
    warnings,
  };
}
