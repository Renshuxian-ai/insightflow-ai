import type {
  DatasetCellValue,
  FieldDataType,
} from "@/lib/datasets/types";

export type ObservedFieldDataType = Exclude<FieldDataType, "empty" | "mixed">;

export type FieldTypeCounts = Record<ObservedFieldDataType, number>;

const INTEGER_PATTERN = /^[+-]?(?:0|[1-9]\d*)$/;
const NUMBER_PATTERN = /^[+-]?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATETIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;

export function createFieldTypeCounts(): FieldTypeCounts {
  return {
    string: 0,
    integer: 0,
    number: 0,
    boolean: 0,
    date: 0,
    datetime: 0,
  };
}

export function isMissingDatasetValue(value: DatasetCellValue): boolean {
  return value === null || (typeof value === "string" && value.trim() === "");
}

function hasSignificantLeadingZero(value: string): boolean {
  const unsignedValue = value.replace(/^[+-]/, "");
  return /^0\d/.test(unsignedValue);
}

function isStrictIsoDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);

  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isStrictIsoDateTime(value: string): boolean {
  if (!ISO_DATETIME_PATTERN.test(value)) {
    return false;
  }

  return !Number.isNaN(Date.parse(value));
}

export function classifyDatasetValue(
  value: DatasetCellValue,
): ObservedFieldDataType | "empty" {
  if (value === null || (typeof value === "string" && value.trim() === "")) {
    return "empty";
  }

  if (typeof value === "boolean") {
    return "boolean";
  }

  if (typeof value === "number") {
    return Number.isInteger(value) ? "integer" : "number";
  }

  const normalized = value.trim();

  if (/^(true|false)$/i.test(normalized)) {
    return "boolean";
  }

  if (isStrictIsoDateTime(normalized)) {
    return "datetime";
  }

  if (isStrictIsoDate(normalized)) {
    return "date";
  }

  if (!hasSignificantLeadingZero(normalized) && INTEGER_PATTERN.test(normalized)) {
    return "integer";
  }

  if (!hasSignificantLeadingZero(normalized) && NUMBER_PATTERN.test(normalized)) {
    return "number";
  }

  return "string";
}

export function inferFieldType(typeCounts: FieldTypeCounts): FieldDataType {
  const presentTypes = (Object.keys(typeCounts) as ObservedFieldDataType[]).filter(
    (type) => typeCounts[type] > 0,
  );

  if (presentTypes.length === 0) {
    return "empty";
  }

  if (presentTypes.length === 1) {
    return presentTypes[0];
  }

  if (
    presentTypes.every((type) => type === "integer" || type === "number")
  ) {
    return "number";
  }

  if (presentTypes.every((type) => type === "date" || type === "datetime")) {
    return "datetime";
  }

  return "mixed";
}

export function toNumericValue(value: DatasetCellValue): number | null {
  const type = classifyDatasetValue(value);

  if (type !== "integer" && type !== "number") {
    return null;
  }

  if (typeof value !== "number" && typeof value !== "string") {
    return null;
  }

  const numericValue = typeof value === "number" ? value : Number(value.trim());
  return Number.isFinite(numericValue) ? numericValue : null;
}

export function toTemporalValue(value: DatasetCellValue): string | null {
  const type = classifyDatasetValue(value);

  if (type !== "date" && type !== "datetime") {
    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const text = value.trim();
  const timestamp = type === "date" ? `${text}T00:00:00.000Z` : text;
  const parsed = new Date(timestamp);

  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
