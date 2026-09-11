import "server-only";

import { parse } from "csv-parse/sync";

import { DATASET_LIMITS } from "@/lib/datasets/constants";
import { DatasetError, isDatasetError } from "@/lib/datasets/errors";
import type { DatasetCellValue } from "@/lib/datasets/types";

import {
  assertCellLimit,
  assertCellTextLength,
  assertColumnLimit,
  assertRowLimit,
  createParsedColumns,
  type DatasetParser,
  type ParsedDataset,
  type ValidatedDatasetUpload,
} from "./types";

function parseCsvRows(bytes: Uint8Array): string[][] {
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);

    return parse(text, {
      bom: true,
      skip_empty_lines: true,
      relax_column_count: false,
      max_record_size: DATASET_LIMITS.maxCsvRecordSize,
    });
  } catch (error) {
    if (isDatasetError(error)) {
      throw error;
    }

    throw new DatasetError("parse-failed", "The CSV file could not be parsed.");
  }
}

function normalizeCsvRow(row: string[], columnCount: number): DatasetCellValue[] {
  if (row.length !== columnCount) {
    throw new DatasetError(
      "parse-failed",
      "Every CSV row must contain the same number of columns as the header.",
    );
  }

  return row.map((value) => {
    assertCellTextLength(value);
    return value;
  });
}

async function parseCsv(upload: ValidatedDatasetUpload): Promise<ParsedDataset> {
  const records = parseCsvRows(upload.bytes);

  if (records.length === 0) {
    throw new DatasetError("empty-dataset", "The CSV file does not contain a header row.");
  }

  const [rawHeaders, ...rawRows] = records;
  assertColumnLimit(rawHeaders.length);
  rawHeaders.forEach((header) => assertCellTextLength(header));

  const { columns, warnings } = createParsedColumns(rawHeaders);
  const rows: DatasetCellValue[][] = [];

  for (const rawRow of rawRows) {
    const row = normalizeCsvRow(rawRow, columns.length);
    rows.push(row);
    assertRowLimit(rows.length);
    assertCellLimit(rows.length, columns.length);
  }

  return {
    columns,
    rows,
    rowCount: rows.length,
    selectedSheetName: null,
    availableSheetNames: [],
    headerRowIndex: 1,
    warnings,
  };
}

export const csvParser: DatasetParser = {
  format: "csv",
  parse: parseCsv,
};
