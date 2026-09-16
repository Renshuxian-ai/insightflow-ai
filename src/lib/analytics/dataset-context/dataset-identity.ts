import "server-only";

import { createHash } from "node:crypto";

import type { ParsedDataset } from "@/lib/datasets/server/parsers/types";

/**
 * A stable identity for the uploaded analytical content. The runtime dataset ID
 * is intentionally session-scoped, so it cannot be used to deduplicate a
 * repeated upload of the same file.
 */
export function createDatasetContentIdentity(dataset: ParsedDataset) {
  const hash = createHash("sha256");

  hash.update("insightflow-dataset-content-v1\n");
  hash.update(JSON.stringify({
    selectedSheetName: dataset.selectedSheetName,
    headerRowIndex: dataset.headerRowIndex,
    columns: dataset.columns.map((column) => column.originalName),
  }));
  hash.update("\n");

  for (const row of dataset.rows) {
    hash.update(JSON.stringify(row));
    hash.update("\n");
  }

  return `dataset-content-${hash.digest("hex").slice(0, 32)}`;
}
