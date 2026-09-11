import "server-only";

import type { DatasetFormat } from "@/lib/datasets/types";

import { csvParser } from "./csv-parser";
import type { DatasetParser } from "./types";
import { xlsxParser } from "./xlsx-parser";

const datasetParsers: Record<DatasetFormat, DatasetParser> = {
  csv: csvParser,
  xlsx: xlsxParser,
};

export function getDatasetParser(format: DatasetFormat): DatasetParser {
  return datasetParsers[format];
}
