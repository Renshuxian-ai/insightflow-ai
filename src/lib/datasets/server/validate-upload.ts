import "server-only";

import { DATASET_LIMITS } from "@/lib/datasets/constants";
import { DatasetError } from "@/lib/datasets/errors";
import type { DatasetFormat } from "@/lib/datasets/types";

import type { ValidatedDatasetUpload } from "./parsers/types";

type DatasetUploadFile = {
  name: string;
  size: number;
  type: string;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

function isDatasetUploadFile(value: unknown): value is DatasetUploadFile {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const file = value as Record<string, unknown>;

  return (
    typeof file.name === "string" &&
    typeof file.size === "number" &&
    typeof file.type === "string" &&
    typeof file.arrayBuffer === "function"
  );
}

function getDatasetFormat(fileName: string): DatasetFormat {
  const extension = fileName.split(".").pop()?.toLowerCase();

  if (extension === "csv" || extension === "xlsx") {
    return extension;
  }

  throw new DatasetError(
    "unsupported-format",
    "Only UTF-8 CSV and XLSX files are supported.",
  );
}

function sanitizeFileName(fileName: string): string {
  const name = fileName.split(/[\\/]/).pop()?.replace(/[\u0000-\u001F]/g, "").trim();

  return name?.slice(0, 255) || "dataset";
}

function hasZipFileSignature(bytes: Uint8Array): boolean {
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    return false;
  }

  return (
    (bytes[2] === 0x03 && bytes[3] === 0x04) ||
    (bytes[2] === 0x05 && bytes[3] === 0x06) ||
    (bytes[2] === 0x07 && bytes[3] === 0x08)
  );
}

function assertValidCsvContent(bytes: Uint8Array) {
  try {
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);

    if (decoded.includes("\u0000")) {
      throw new DatasetError(
        "invalid-file-content",
        "The CSV file contains unsupported binary content.",
      );
    }
  } catch (error) {
    if (error instanceof DatasetError) {
      throw error;
    }

    throw new DatasetError(
      "invalid-file-content",
      "CSV files must use UTF-8 encoding.",
    );
  }
}

function assertValidXlsxContent(bytes: Uint8Array) {
  if (!hasZipFileSignature(bytes)) {
    throw new DatasetError(
      "invalid-file-content",
      "The XLSX file has an invalid file signature.",
    );
  }
}

export async function validateDatasetUpload(
  value: unknown,
): Promise<ValidatedDatasetUpload> {
  if (!isDatasetUploadFile(value)) {
    throw new DatasetError("invalid-upload", "A valid dataset file is required.");
  }

  const originalFileName = sanitizeFileName(value.name);
  const format = getDatasetFormat(originalFileName);

  if (!Number.isFinite(value.size) || value.size <= 0) {
    throw new DatasetError("empty-dataset", "The uploaded file is empty.");
  }

  if (value.size > DATASET_LIMITS.maxFileSizeBytes) {
    throw new DatasetError(
      "file-too-large",
      `A dataset file can be at most ${Math.floor(
        DATASET_LIMITS.maxFileSizeBytes / (1024 * 1024),
      )} MB.`,
    );
  }

  let bytes: Uint8Array;

  try {
    bytes = new Uint8Array(await value.arrayBuffer());
  } catch {
    throw new DatasetError("invalid-upload", "The uploaded file could not be read.");
  }

  if (bytes.byteLength === 0) {
    throw new DatasetError("empty-dataset", "The uploaded file is empty.");
  }

  if (bytes.byteLength > DATASET_LIMITS.maxFileSizeBytes) {
    throw new DatasetError(
      "file-too-large",
      `A dataset file can be at most ${Math.floor(
        DATASET_LIMITS.maxFileSizeBytes / (1024 * 1024),
      )} MB.`,
    );
  }

  if (format === "csv") {
    assertValidCsvContent(bytes);
  } else {
    assertValidXlsxContent(bytes);
  }

  return {
    format,
    originalFileName,
    mimeType: value.type.trim() || null,
    sizeBytes: bytes.byteLength,
    bytes,
  };
}
