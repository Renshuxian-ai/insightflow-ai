import { DATASET_LIMITS } from "@/lib/datasets/constants";
import { DatasetError } from "@/lib/datasets/errors";
import type {
  DatasetCellValue,
  DatasetFormat,
  DatasetWarning,
} from "@/lib/datasets/types";

export type ValidatedDatasetUpload = {
  format: DatasetFormat;
  originalFileName: string;
  mimeType: string | null;
  sizeBytes: number;
  bytes: Uint8Array;
};

export type ParsedDatasetColumn = {
  index: number;
  originalName: string;
  displayName: string;
};

export type ParsedDataset = {
  columns: ParsedDatasetColumn[];
  rows: DatasetCellValue[][];
  rowCount: number;
  selectedSheetName: string | null;
  availableSheetNames: string[];
  headerRowIndex: number;
  warnings: DatasetWarning[];
};

export type DatasetParser = {
  format: DatasetFormat;
  parse(upload: ValidatedDatasetUpload): Promise<ParsedDataset>;
};

export function createParsedColumns(rawHeaders: string[]): {
  columns: ParsedDatasetColumn[];
  warnings: DatasetWarning[];
} {
  assertColumnLimit(rawHeaders.length);

  const duplicateCounts = new Map<string, number>();
  const warnings: DatasetWarning[] = [];

  const columns = rawHeaders.map((rawHeader, index) => {
    const originalName = rawHeader;
    const trimmedName = rawHeader.trim();

    if (!trimmedName) {
      const displayName = `Column ${index + 1}`;
      warnings.push({
        code: "blank-header",
        message: `Column ${index + 1} has a blank header and is displayed as ${displayName}.`,
      });

      return {
        index,
        originalName,
        displayName,
      };
    }

    const duplicateCount = duplicateCounts.get(trimmedName) ?? 0;
    duplicateCounts.set(trimmedName, duplicateCount + 1);

    if (duplicateCount === 0) {
      return {
        index,
        originalName,
        displayName: trimmedName,
      };
    }

    const displayName = `${trimmedName} (${duplicateCount + 1})`;
    warnings.push({
      code: "duplicate-header",
      message: `Duplicate header ${trimmedName} is displayed as ${displayName}.`,
    });

    return {
      index,
      originalName,
      displayName,
    };
  });

  return { columns, warnings };
}

export function assertRowLimit(rowCount: number) {
  if (rowCount > DATASET_LIMITS.maxRows) {
    throw new DatasetError(
      "row-limit-exceeded",
      `A dataset can contain at most ${DATASET_LIMITS.maxRows.toLocaleString()} rows.`,
    );
  }
}

export function assertColumnLimit(columnCount: number) {
  if (columnCount === 0) {
    throw new DatasetError("empty-dataset", "The dataset does not contain a header row.");
  }

  if (columnCount > DATASET_LIMITS.maxColumns) {
    throw new DatasetError(
      "column-limit-exceeded",
      `A dataset can contain at most ${DATASET_LIMITS.maxColumns} columns.`,
    );
  }
}

export function assertCellLimit(rowCount: number, columnCount: number) {
  if (rowCount * columnCount > DATASET_LIMITS.maxCells) {
    throw new DatasetError(
      "cell-limit-exceeded",
      `A dataset can contain at most ${DATASET_LIMITS.maxCells.toLocaleString()} cells.`,
    );
  }
}

export function assertCellTextLength(value: DatasetCellValue) {
  if (
    typeof value === "string" &&
    value.length > DATASET_LIMITS.maxCellTextLength
  ) {
    throw new DatasetError(
      "cell-value-too-large",
      `A cell can contain at most ${DATASET_LIMITS.maxCellTextLength.toLocaleString()} characters.`,
    );
  }
}

export function isEmptyRow(row: DatasetCellValue[]): boolean {
  return row.every(
    (value) => value === null || (typeof value === "string" && value.trim() === ""),
  );
}
