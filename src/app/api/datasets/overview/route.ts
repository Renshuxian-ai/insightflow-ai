import { cookies } from "next/headers";

import { buildDatasetAnalyticsContext } from "@/lib/analytics/dataset-context";
import { createDatasetContentIdentity } from "@/lib/analytics/dataset-context/dataset-identity";
import {
  DATASET_ANALYTICS_SESSION_COOKIE,
  registerDatasetAnalyticsSession,
} from "@/lib/analytics/dataset-context/session-store";
import { DATASET_LIMITS } from "@/lib/datasets/constants";
import { DATASET_MODE_COOKIE } from "@/lib/datasets/dataset-mode";
import { getRuntimeSessionId } from "@/lib/runtime-session";
import { isDatasetError, type DatasetError } from "@/lib/datasets/errors";
import {
  isSemanticRole,
  isSemanticType,
  isSemanticTypeCompatibleWithRole,
} from "@/lib/datasets/semantic/semantic-type-registry";
import type {
  SemanticFieldMapping,
  SemanticMappingValue,
  SemanticSchema,
} from "@/lib/datasets/semantic/types";
import { parseDatasetForAnalytics } from "@/lib/datasets/server/parse-dataset";
import type { ParsedDataset } from "@/lib/datasets/server/parsers/types";
import { buildOverviewActivityEvidence } from "@/lib/overview/overview-activity-builder";
import { buildOverviewRuntime } from "@/lib/overview/build-overview-runtime";

type JsonRecord = Record<string, unknown>;

type OverviewApiErrorCode =
  | "INVALID_FILE"
  | "INVALID_SEMANTIC_SCHEMA"
  | "SEMANTIC_SCHEMA_NOT_CONFIRMED"
  | "DATASET_PARSE_FAILED"
  | "OVERVIEW_ANALYTICS_FAILED";

const MAX_SEMANTIC_SCHEMA_BYTES = 512 * 1024;

const DATASET_ERROR_STATUS: Record<DatasetError["code"], number> = {
  "invalid-upload": 400,
  "unsupported-format": 415,
  "file-too-large": 413,
  "invalid-file-content": 422,
  "empty-dataset": 422,
  "worksheet-limit-exceeded": 413,
  "no-visible-worksheet": 422,
  "worksheet-not-found": 422,
  "row-limit-exceeded": 413,
  "column-limit-exceeded": 413,
  "cell-limit-exceeded": 413,
  "cell-value-too-large": 413,
  "parse-failed": 422,
};

class OverviewApiError extends Error {
  constructor(
    readonly code: OverviewApiErrorCode,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "OverviewApiError";
  }
}

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function errorResponse(
  code: OverviewApiErrorCode,
  message: string,
  status: number,
) {
  return jsonResponse({ error: { code, message } }, status);
}

function invalidSemanticSchema(message: string): never {
  throw new OverviewApiError("INVALID_SEMANTIC_SCHEMA", message, 400);
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isValidMappingValue(value: unknown): value is SemanticMappingValue {
  if (!isRecord(value)) {
    return false;
  }

  const businessMeaning = value.businessMeaning;

  return (
    isSemanticRole(value.semanticRole) &&
    isSemanticType(value.semanticType) &&
    isSemanticTypeCompatibleWithRole(value.semanticType, value.semanticRole) &&
    (businessMeaning === null ||
      (typeof businessMeaning === "string" && businessMeaning.length <= 160))
  );
}

function isValidResolution(value: unknown): boolean {
  if (!isRecord(value) || typeof value.status !== "string") {
    return false;
  }

  switch (value.status) {
    case "suggested":
      return true;
    case "accepted":
    case "edited":
      return isValidMappingValue(value.value);
    case "excluded":
    case "unresolved":
      return value.reason === null || typeof value.reason === "string";
    default:
      return false;
  }
}

function isValidSuggestion(
  value: unknown,
  stableFieldKey: string,
): boolean {
  return (
    value === null ||
    (isRecord(value) &&
      value.stableFieldKey === stableFieldKey &&
      isValidMappingValue(value))
  );
}

function readSemanticField(
  value: unknown,
  index: number,
): SemanticFieldMapping {
  if (!isRecord(value)) {
    invalidSemanticSchema(`semanticSchema.fields[${index}] must be an object.`);
  }

  const stableFieldKey = value.stableFieldKey;
  const fieldIndex = value.fieldIndex;
  const originalName = value.originalName;

  if (
    typeof stableFieldKey !== "string" ||
    stableFieldKey.length === 0 ||
    stableFieldKey.length > 256
  ) {
    invalidSemanticSchema(
      `semanticSchema.fields[${index}].stableFieldKey is invalid.`,
    );
  }

  if (
    typeof fieldIndex !== "number" ||
    !Number.isInteger(fieldIndex) ||
    fieldIndex < 0 ||
    fieldIndex >= DATASET_LIMITS.maxColumns
  ) {
    invalidSemanticSchema(
      `semanticSchema.fields[${index}].fieldIndex is invalid.`,
    );
  }

  if (
    typeof originalName !== "string" ||
    originalName.length > DATASET_LIMITS.maxCellTextLength
  ) {
    invalidSemanticSchema(
      `semanticSchema.fields[${index}].originalName is invalid.`,
    );
  }

  if (!isValidResolution(value.resolution)) {
    invalidSemanticSchema(
      `semanticSchema.fields[${index}].resolution is invalid.`,
    );
  }

  if (!isValidSuggestion(value.suggestion, stableFieldKey)) {
    invalidSemanticSchema(
      `semanticSchema.fields[${index}].suggestion is invalid.`,
    );
  }

  if (
    isRecord(value.resolution) &&
    value.resolution.status === "suggested" &&
    value.suggestion === null
  ) {
    invalidSemanticSchema(
      `semanticSchema.fields[${index}] has no resolved semantic mapping.`,
    );
  }

  return value as SemanticFieldMapping;
}

function parseSemanticSchema(value: FormDataEntryValue | null): SemanticSchema {
  if (typeof value !== "string" || value.length === 0) {
    invalidSemanticSchema(
      "Provide semanticSchema as a JSON string in multipart form data.",
    );
  }

  if (new TextEncoder().encode(value).byteLength > MAX_SEMANTIC_SCHEMA_BYTES) {
    invalidSemanticSchema("semanticSchema is too large.");
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch {
    invalidSemanticSchema("semanticSchema must contain valid JSON.");
  }

  if (!isRecord(parsed)) {
    invalidSemanticSchema("semanticSchema must be an object.");
  }

  if (parsed.status !== "confirmed") {
    throw new OverviewApiError(
      "SEMANTIC_SCHEMA_NOT_CONFIRMED",
      "Confirm the semantic schema before calculating dataset analytics.",
      409,
    );
  }

  if (!isRecord(parsed.physicalSchema)) {
    invalidSemanticSchema("semanticSchema.physicalSchema must be an object.");
  }

  const physicalSchema = parsed.physicalSchema;
  const selectedSheetName = physicalSchema.selectedSheetName;

  if (
    typeof physicalSchema.datasetId !== "string" ||
    typeof physicalSchema.physicalSchemaVersion !== "number" ||
    !Number.isInteger(physicalSchema.physicalSchemaVersion) ||
    typeof physicalSchema.schemaFingerprint !== "string" ||
    (selectedSheetName !== null && typeof selectedSheetName !== "string")
  ) {
    invalidSemanticSchema("semanticSchema.physicalSchema is invalid.");
  }

  if (
    !Array.isArray(parsed.fields) ||
    parsed.fields.length === 0 ||
    parsed.fields.length > DATASET_LIMITS.maxColumns
  ) {
    invalidSemanticSchema("semanticSchema.fields is invalid.");
  }

  const fields = parsed.fields.map(readSemanticField);
  const stableFieldKeys = new Set(fields.map((field) => field.stableFieldKey));
  const fieldIndexes = new Set(fields.map((field) => field.fieldIndex));

  if (
    stableFieldKeys.size !== fields.length ||
    fieldIndexes.size !== fields.length
  ) {
    invalidSemanticSchema(
      "semanticSchema fields must have unique stable keys and indexes.",
    );
  }

  return parsed as SemanticSchema;
}

function readOptionalSheetName(formData: FormData): string | null {
  const values = formData.getAll("sheetName");

  if (values.length === 0) {
    return null;
  }

  if (values.length !== 1 || typeof values[0] !== "string") {
    throw new OverviewApiError(
      "INVALID_FILE",
      "The worksheet selection is invalid.",
      400,
    );
  }

  const sheetName = values[0].trim();

  if (sheetName.length === 0 || sheetName.length > 31) {
    throw new OverviewApiError(
      "INVALID_FILE",
      "The worksheet selection is invalid.",
      400,
    );
  }

  return sheetName;
}

function assertSchemaMatchesParsedDataset(
  semanticSchema: SemanticSchema,
  parsedDataset: ParsedDataset,
) {
  if (
    semanticSchema.physicalSchema.selectedSheetName !==
      parsedDataset.selectedSheetName ||
    semanticSchema.fields.length !== parsedDataset.columns.length
  ) {
    invalidSemanticSchema(
      "The confirmed semantic schema does not match the parsed dataset.",
    );
  }

  for (const field of semanticSchema.fields) {
    const column = parsedDataset.columns[field.fieldIndex];

    if (
      !column ||
      column.index !== field.fieldIndex ||
      column.originalName !== field.originalName
    ) {
      invalidSemanticSchema(
        "The confirmed semantic schema does not match the parsed dataset.",
      );
    }
  }
}

function datasetErrorResponse(error: DatasetError) {
  const invalidFileCodes = new Set<DatasetError["code"]>([
    "invalid-upload",
    "unsupported-format",
    "file-too-large",
    "invalid-file-content",
    "empty-dataset",
  ]);

  return errorResponse(
    invalidFileCodes.has(error.code) ? "INVALID_FILE" : "DATASET_PARSE_FAILED",
    error.message,
    DATASET_ERROR_STATUS[error.code],
  );
}

export async function POST(request: Request) {
  const runtimeSessionId = getRuntimeSessionId(request);

  if (!runtimeSessionId) {
    return errorResponse(
      "INVALID_FILE",
      "A valid runtime session is required.",
      400,
    );
  }

  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    return errorResponse(
      "INVALID_FILE",
      "Upload one CSV or XLSX file using multipart form data.",
      400,
    );
  }

  try {
    const formData = await request.formData();
    const files = formData.getAll("file");
    const schemas = formData.getAll("semanticSchema");

    if (files.length !== 1 || typeof files[0] === "string") {
      throw new OverviewApiError(
        "INVALID_FILE",
        "Upload exactly one CSV or XLSX file.",
        400,
      );
    }

    if (schemas.length !== 1) {
      invalidSemanticSchema(
        "Provide exactly one confirmed semanticSchema value.",
      );
    }

    const semanticSchema = parseSemanticSchema(schemas[0]!);
    const requestedSheetName = readOptionalSheetName(formData);
    const schemaSheetName = semanticSchema.physicalSchema.selectedSheetName;

    if (
      requestedSheetName !== null &&
      requestedSheetName !== schemaSheetName
    ) {
      invalidSemanticSchema(
        "The requested worksheet does not match the confirmed semantic schema.",
      );
    }

    const selectedSheetName = requestedSheetName ?? schemaSheetName;
    const parsedDataset = await parseDatasetForAnalytics(files[0], {
      sheetName: selectedSheetName ?? undefined,
    });

    assertSchemaMatchesParsedDataset(semanticSchema, parsedDataset);

    const analyticsContext = buildDatasetAnalyticsContext({
      datasetId: semanticSchema.physicalSchema.datasetId,
      dataset: parsedDataset,
      semanticSchema,
    });
    const datasetIdentity = createDatasetContentIdentity(parsedDataset);
    const activityEvidence = buildOverviewActivityEvidence({
      datasetId: semanticSchema.physicalSchema.datasetId,
      dataset: parsedDataset,
      semanticSchema,
    });
    const overviewRuntime = buildOverviewRuntime({
      analyticsContext,
      activityEvidence,
    });
    const cookieStore = await cookies();
    const session = registerDatasetAnalyticsSession(
      analyticsContext,
      {
        requestedSessionId: runtimeSessionId,
        datasetIdentity,
      },
    );

    cookieStore.set(DATASET_ANALYTICS_SESSION_COOKIE, session.sessionId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 30 * 60,
    });
    cookieStore.set(DATASET_MODE_COOKIE, session.sessionId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });

    return jsonResponse(overviewRuntime);
  } catch (error) {
    if (error instanceof OverviewApiError) {
      return errorResponse(error.code, error.message, error.status);
    }

    if (isDatasetError(error)) {
      return datasetErrorResponse(error);
    }

    return errorResponse(
      "OVERVIEW_ANALYTICS_FAILED",
      "Dataset analytics could not be calculated.",
      500,
    );
  }
}
