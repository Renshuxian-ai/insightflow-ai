export type DatasetErrorCode =
  | "invalid-upload"
  | "unsupported-format"
  | "file-too-large"
  | "invalid-file-content"
  | "empty-dataset"
  | "worksheet-limit-exceeded"
  | "no-visible-worksheet"
  | "worksheet-not-found"
  | "row-limit-exceeded"
  | "column-limit-exceeded"
  | "cell-limit-exceeded"
  | "cell-value-too-large"
  | "parse-failed";

export class DatasetError extends Error {
  constructor(
    public readonly code: DatasetErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "DatasetError";
  }
}

export function isDatasetError(error: unknown): error is DatasetError {
  return error instanceof DatasetError;
}
