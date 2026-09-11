export const DATASET_LIMITS = {
  maxFileSizeBytes: 5 * 1024 * 1024,
  maxRows: 50_000,
  maxColumns: 100,
  maxCells: 1_000_000,
  maxWorksheets: 10,
  maxProfileRows: 10_000,
  maxPreviewRows: 20,
  maxFieldSampleValues: 5,
  maxDistinctValuesTracked: 10_000,
  maxCellTextLength: 10_000,
  maxCsvRecordSize: 1_000_000,
} as const;

export const SUPPORTED_DATASET_FORMATS = ["csv", "xlsx"] as const;
