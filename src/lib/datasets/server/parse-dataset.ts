import "server-only";

import { randomUUID } from "node:crypto";

import { DATASET_LIMITS } from "@/lib/datasets/constants";
import { DatasetError, isDatasetError } from "@/lib/datasets/errors";
import type { Dataset } from "@/lib/datasets/types";

import { getDatasetParser } from "./parsers/parser-registry";
import { profileDataset } from "./profiling/profile-dataset";
import { validateDatasetUpload } from "./validate-upload";

export type ParseDatasetOptions = {
  sheetName?: string;
};

function getDatasetName(fileName: string): string {
  const withoutExtension = fileName.replace(/\.[^.]+$/, "").trim();
  return withoutExtension || "Dataset";
}

export async function parseDataset(
  value: unknown,
  options: ParseDatasetOptions = {},
): Promise<Dataset> {
  try {
    const upload = await validateDatasetUpload(value);
    const parser = getDatasetParser(upload.format);
    const parsedDataset = await parser.parse(upload, options);
    const datasetId = randomUUID();
    const schema = profileDataset(datasetId, parsedDataset);

    return {
      id: datasetId,
      name: getDatasetName(upload.originalFileName),
      source: "file-upload",
      format: upload.format,
      status: "profiled",
      retention: "session-only",
      file: {
        originalFileName: upload.originalFileName,
        mimeType: upload.mimeType,
        sizeBytes: upload.sizeBytes,
      },
      rowCount: parsedDataset.rowCount,
      columnCount: parsedDataset.columns.length,
      schema,
      preview: {
        columns: parsedDataset.columns.map((column) => column.displayName),
        rows: parsedDataset.rows.slice(0, DATASET_LIMITS.maxPreviewRows),
        rowLimit: DATASET_LIMITS.maxPreviewRows,
      },
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    if (isDatasetError(error)) {
      throw error;
    }

    throw new DatasetError("parse-failed", "The dataset could not be parsed.");
  }
}
