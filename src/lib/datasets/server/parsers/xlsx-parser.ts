import "server-only";

import ExcelJS, {
  type CellFormulaValue,
  type CellHyperlinkValue,
  type CellRichTextValue,
  type CellSharedFormulaValue,
  type CellValue,
} from "exceljs";

import { DATASET_LIMITS } from "@/lib/datasets/constants";
import { DatasetError, isDatasetError } from "@/lib/datasets/errors";
import type {
  DatasetCellValue,
  DatasetWarning,
} from "@/lib/datasets/types";

import {
  assertCellLimit,
  assertCellTextLength,
  assertColumnLimit,
  assertRowLimit,
  createParsedColumns,
  isEmptyRow,
  type DatasetParser,
  type DatasetParserOptions,
  type ParsedDataset,
  type ValidatedDatasetUpload,
} from "./types";

type FormulaReadState = {
  usedFormulaResult: boolean;
  missingFormulaResult: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isFormulaValue(
  value: CellValue,
): value is CellFormulaValue | CellSharedFormulaValue {
  return (
    isRecord(value) &&
    (Object.prototype.hasOwnProperty.call(value, "formula") ||
      Object.prototype.hasOwnProperty.call(value, "sharedFormula"))
  );
}

function isRichTextValue(value: CellValue): value is CellRichTextValue {
  return isRecord(value) && Array.isArray(value.richText);
}

function isHyperlinkValue(value: CellValue): value is CellHyperlinkValue {
  return isRecord(value) && typeof value.text === "string";
}

function normalizeExcelValue(
  value: CellValue,
  formulaReadState: FormulaReadState,
): DatasetCellValue {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  if (isFormulaValue(value)) {
    const result = value.result;

    if (result === undefined) {
      formulaReadState.missingFormulaResult = true;
      return null;
    }

    formulaReadState.usedFormulaResult = true;
    return normalizeExcelValue(result, formulaReadState);
  }

  if (isRichTextValue(value)) {
    return value.richText
      .map((part) => part.text)
      .join("");
  }

  if (isHyperlinkValue(value)) {
    return value.text;
  }

  return null;
}

function readWorksheetRow(
  worksheet: ExcelJS.Worksheet,
  rowNumber: number,
  columnCount: number,
  formulaReadState: FormulaReadState,
): DatasetCellValue[] {
  const row = worksheet.getRow(rowNumber);
  const values: DatasetCellValue[] = [];

  for (let columnIndex = 1; columnIndex <= columnCount; columnIndex += 1) {
    const value = normalizeExcelValue(
      row.getCell(columnIndex).value,
      formulaReadState,
    );
    assertCellTextLength(value);
    values.push(value);
  }

  return values;
}

async function parseXlsx(
  upload: ValidatedDatasetUpload,
  options: DatasetParserOptions = {},
): Promise<ParsedDataset> {
  try {
    const workbook = new ExcelJS.Workbook();
    const loadXlsx = workbook.xlsx.load.bind(workbook.xlsx) as unknown as (
      buffer: Uint8Array,
    ) => Promise<ExcelJS.Workbook>;
    await loadXlsx(Buffer.from(upload.bytes));

    if (workbook.worksheets.length > DATASET_LIMITS.maxWorksheets) {
      throw new DatasetError(
        "worksheet-limit-exceeded",
        `An XLSX file can contain at most ${DATASET_LIMITS.maxWorksheets} worksheets.`,
      );
    }

    const visibleWorksheets = workbook.worksheets.filter(
      (worksheet) => worksheet.state === "visible",
    );

    if (visibleWorksheets.length === 0) {
      throw new DatasetError(
        "no-visible-worksheet",
        "The XLSX file does not contain a visible worksheet.",
      );
    }

    const worksheet = options.sheetName
      ? visibleWorksheets.find((item) => item.name === options.sheetName)
      : visibleWorksheets[0];

    if (!worksheet) {
      throw new DatasetError(
        "worksheet-not-found",
        "The selected worksheet is not available in this workbook.",
      );
    }
    const warnings: DatasetWarning[] = [];

    if (visibleWorksheets.length > 1) {
      warnings.push({
        code: "multiple-worksheets",
        message: `${worksheet.name} is selected. You can switch between the available worksheets.`,
      });
    }

    if (visibleWorksheets.length !== workbook.worksheets.length) {
      warnings.push({
        code: "hidden-worksheets-ignored",
        message: "Hidden worksheets were not included in the dataset profile.",
      });
    }

    if (worksheet.hasMerges) {
      warnings.push({
        code: "merged-cells-detected",
        message: "Merged cells were read as worksheet values and may need review.",
      });
    }

    const columnCount = worksheet.actualColumnCount;
    assertColumnLimit(columnCount);

    const formulaReadState: FormulaReadState = {
      usedFormulaResult: false,
      missingFormulaResult: false,
    };

    let headerRowIndex = 0;
    let headerValues: DatasetCellValue[] = [];

    for (let rowNumber = 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
      const row = readWorksheetRow(
        worksheet,
        rowNumber,
        columnCount,
        formulaReadState,
      );

      if (!isEmptyRow(row)) {
        headerRowIndex = rowNumber;
        headerValues = row;
        break;
      }
    }

    if (headerRowIndex === 0) {
      throw new DatasetError(
        "empty-dataset",
        "The selected worksheet does not contain a header row.",
      );
    }

    const rawHeaders = headerValues.map((value) => (value === null ? "" : String(value)));
    const headerResult = createParsedColumns(rawHeaders);
    warnings.push(...headerResult.warnings);

    const rows: DatasetCellValue[][] = [];

    for (
      let rowNumber = headerRowIndex + 1;
      rowNumber <= worksheet.rowCount;
      rowNumber += 1
    ) {
      const row = readWorksheetRow(
        worksheet,
        rowNumber,
        columnCount,
        formulaReadState,
      );

      if (isEmptyRow(row)) {
        continue;
      }

      rows.push(row);
      assertRowLimit(rows.length);
      assertCellLimit(rows.length, headerResult.columns.length);
    }

    if (formulaReadState.usedFormulaResult) {
      warnings.push({
        code: "formula-result-used",
        message: "Cached formula results were read without executing workbook formulas.",
      });
    }

    if (formulaReadState.missingFormulaResult) {
      warnings.push({
        code: "formula-without-result",
        message: "Formula cells without cached results were treated as empty values.",
      });
    }

    return {
      columns: headerResult.columns,
      rows,
      rowCount: rows.length,
      selectedSheetName: worksheet.name,
      availableSheetNames: visibleWorksheets.map((item) => item.name),
      headerRowIndex,
      warnings,
    };
  } catch (error) {
    if (isDatasetError(error)) {
      throw error;
    }

    throw new DatasetError("parse-failed", "The XLSX file could not be parsed.");
  }
}

export const xlsxParser: DatasetParser = {
  format: "xlsx",
  parse: parseXlsx,
};
