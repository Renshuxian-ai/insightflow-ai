export type DatasetFormat = "csv" | "xlsx";

export type DatasetCellValue = string | number | boolean | null;

export type FieldDataType =
  | "string"
  | "integer"
  | "number"
  | "boolean"
  | "date"
  | "datetime"
  | "empty"
  | "mixed";

export type DatasetWarningCode =
  | "blank-header"
  | "duplicate-header"
  | "hidden-worksheets-ignored"
  | "merged-cells-detected"
  | "multiple-worksheets"
  | "formula-result-used"
  | "formula-without-result"
  | "profile-sampled"
  | "mixed-field-values"
  | "distinct-count-limited";

export type DatasetWarning = {
  code: DatasetWarningCode;
  message: string;
};

export type FieldStatistics =
  | {
      kind: "numeric";
      min: number;
      max: number;
      mean: number;
    }
  | {
      kind: "temporal";
      earliest: string;
      latest: string;
    }
  | {
      kind: "categorical";
      topValues: Array<{
        value: DatasetCellValue;
        count: number;
      }>;
    }
  | {
      kind: "none";
    };

export type FieldProfile = {
  id: string;
  stableFieldKey: string;
  index: number;
  originalName: string;
  displayName: string;
  detectedType: FieldDataType;
  typeConfidence: number;
  nonNullCount: number;
  nullCount: number;
  nullRate: number;
  distinctCount: number;
  isDistinctCountExact: boolean;
  sampleValues: DatasetCellValue[];
  statistics: FieldStatistics;
  warnings: DatasetWarning[];
};

export type DatasetSchema = {
  datasetId: string;
  version: 1;
  schemaFingerprint: string;
  selectedSheetName: string | null;
  availableSheetNames: string[];
  headerRowIndex: number;
  fields: FieldProfile[];
  profileScope: {
    totalRows: number;
    profiledRows: number;
    isComplete: boolean;
  };
  warnings: DatasetWarning[];
};

export type DatasetPreview = {
  columns: string[];
  rows: DatasetCellValue[][];
  rowLimit: number;
};

export type DatasetFileMetadata = {
  originalFileName: string;
  mimeType: string | null;
  sizeBytes: number;
};

export type Dataset = {
  id: string;
  name: string;
  source: "file-upload";
  format: DatasetFormat;
  status: "profiled";
  retention: "session-only";
  file: DatasetFileMetadata;
  rowCount: number;
  columnCount: number;
  schema: DatasetSchema;
  preview: DatasetPreview;
  createdAt: string;
};
