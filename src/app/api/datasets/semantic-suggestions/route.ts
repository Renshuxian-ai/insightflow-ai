import { DATASET_LIMITS } from "@/lib/datasets/constants";
import { buildSemanticSchemaDraft } from "@/lib/datasets/semantic/build-semantic-schema-draft";
import { createSemanticAutoUsePolicy } from "@/lib/datasets/semantic/auto-use-policy";
import { buildSemanticInferenceContext } from "@/lib/datasets/semantic/server/build-inference-context";
import { generateSemanticInference } from "@/lib/datasets/semantic/server/semantic-inference";
import { defaultSemanticAiModelId } from "@/lib/ai/model-registry";
import {
  createSchemaFingerprint,
  createStableFieldKey,
} from "@/lib/datasets/server/profiling/stable-schema-references";
import type {
  DatasetCellValue,
  DatasetSchema,
  DatasetWarning,
  DatasetWarningCode,
  FieldDataType,
  FieldProfile,
  FieldStatistics,
} from "@/lib/datasets/types";

type JsonRecord = Record<string, unknown>;

const MAX_REQUEST_BYTES = 12 * 1024 * 1024;
const MAX_WARNING_COUNT = 32;
const MAX_WARNING_MESSAGE_LENGTH = 500;
const MAX_DATASET_CONTEXT_LENGTH = 600;

const FIELD_DATA_TYPES = new Set<FieldDataType>([
  "string",
  "integer",
  "number",
  "boolean",
  "date",
  "datetime",
  "empty",
  "mixed",
]);

const DATASET_WARNING_CODES = new Set<DatasetWarningCode>([
  "blank-header",
  "duplicate-header",
  "hidden-worksheets-ignored",
  "merged-cells-detected",
  "multiple-worksheets",
  "formula-result-used",
  "formula-without-result",
  "profile-sampled",
  "mixed-field-values",
  "distinct-count-limited",
]);

class SemanticRequestError extends Error {
  constructor(
    readonly code: "invalid-request" | "schema-mismatch" | "no-analyzable-fields",
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "SemanticRequestError";
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

function requestError(error: SemanticRequestError) {
  return jsonResponse(
    {
      error: {
        code: error.code,
        message: error.message,
      },
    },
    error.status,
  );
}

function invalidRequest(message: string): never {
  throw new SemanticRequestError("invalid-request", message, 400);
}

function readRecord(value: unknown, path: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    invalidRequest(`${path} must be an object.`);
  }

  return value as JsonRecord;
}

function assertAllowedKeys(
  value: JsonRecord,
  allowedKeys: readonly string[],
  path: string,
) {
  const unexpectedKey = Object.keys(value).find(
    (key) => !allowedKeys.includes(key),
  );

  if (unexpectedKey) {
    invalidRequest(`${path}.${unexpectedKey} is not allowed.`);
  }
}

function readString(
  value: unknown,
  path: string,
  maximumLength: number,
  allowEmpty = false,
): string {
  if (typeof value !== "string" || (!allowEmpty && value.length === 0)) {
    invalidRequest(`${path} must be a string.`);
  }

  if (value.length > maximumLength) {
    invalidRequest(`${path} is too long.`);
  }

  return value;
}

function readNullableString(
  value: unknown,
  path: string,
  maximumLength: number,
): string | null {
  if (value === null) {
    return null;
  }

  return readString(value, path, maximumLength);
}

function readDatasetContext(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const context = readString(
    value,
    "request.datasetContext",
    MAX_DATASET_CONTEXT_LENGTH,
    true,
  ).trim();

  return context || null;
}

function readFiniteNumber(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    invalidRequest(`${path} must be a finite number.`);
  }

  return value;
}

function readRatio(value: unknown, path: string): number {
  const ratio = readFiniteNumber(value, path);

  if (ratio < 0 || ratio > 1) {
    invalidRequest(`${path} must be between 0 and 1.`);
  }

  return ratio;
}

function readInteger(
  value: unknown,
  path: string,
  maximum: number,
): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > maximum
  ) {
    invalidRequest(`${path} must be a non-negative integer within its limit.`);
  }

  return value;
}

function readBoolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") {
    invalidRequest(`${path} must be a boolean.`);
  }

  return value;
}

function readCellValue(value: unknown, path: string): DatasetCellValue {
  if (value === null || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return readFiniteNumber(value, path);
  }

  if (typeof value === "string") {
    return readString(value, path, DATASET_LIMITS.maxCellTextLength, true);
  }

  return invalidRequest(`${path} must be a JSON-safe dataset value.`);
}

function readWarning(value: unknown, path: string): DatasetWarning {
  const warning = readRecord(value, path);
  assertAllowedKeys(warning, ["code", "message"], path);

  if (!DATASET_WARNING_CODES.has(warning.code as DatasetWarningCode)) {
    invalidRequest(`${path}.code is not a supported dataset warning.`);
  }

  return {
    code: warning.code as DatasetWarningCode,
    message: readString(
      warning.message,
      `${path}.message`,
      MAX_WARNING_MESSAGE_LENGTH,
    ),
  };
}

function readWarnings(value: unknown, path: string): DatasetWarning[] {
  if (!Array.isArray(value) || value.length > MAX_WARNING_COUNT) {
    invalidRequest(`${path} must be a bounded warning array.`);
  }

  return value.map((warning, index) =>
    readWarning(warning, `${path}[${index}]`),
  );
}

function readStatistics(value: unknown, path: string): FieldStatistics {
  const statistics = readRecord(value, path);
  const kind = statistics.kind;

  if (kind === "numeric") {
    assertAllowedKeys(statistics, ["kind", "min", "max", "mean"], path);
    const min = readFiniteNumber(statistics.min, `${path}.min`);
    const max = readFiniteNumber(statistics.max, `${path}.max`);
    const mean = readFiniteNumber(statistics.mean, `${path}.mean`);

    if (min > max || mean < min || mean > max) {
      invalidRequest(`${path} contains inconsistent numeric statistics.`);
    }

    return { kind, min, max, mean };
  }

  if (kind === "temporal") {
    assertAllowedKeys(statistics, ["kind", "earliest", "latest"], path);
    const earliest = readString(statistics.earliest, `${path}.earliest`, 64);
    const latest = readString(statistics.latest, `${path}.latest`, 64);

    if (earliest > latest) {
      invalidRequest(`${path} contains inconsistent temporal statistics.`);
    }

    return { kind, earliest, latest };
  }

  if (kind === "categorical") {
    assertAllowedKeys(statistics, ["kind", "topValues"], path);

    if (!Array.isArray(statistics.topValues) || statistics.topValues.length > 5) {
      invalidRequest(`${path}.topValues must contain at most 5 items.`);
    }

    return {
      kind,
      topValues: statistics.topValues.map((item, index) => {
        const entryPath = `${path}.topValues[${index}]`;
        const entry = readRecord(item, entryPath);
        assertAllowedKeys(entry, ["value", "count"], entryPath);

        return {
          value: readCellValue(entry.value, `${entryPath}.value`),
          count: readInteger(
            entry.count,
            `${entryPath}.count`,
            DATASET_LIMITS.maxProfileRows,
          ),
        };
      }),
    };
  }

  if (kind === "none") {
    assertAllowedKeys(statistics, ["kind"], path);
    return { kind };
  }

  return invalidRequest(`${path}.kind is not supported.`);
}

function readFieldProfile(
  value: unknown,
  path: string,
  expectedIndex: number,
  profiledRows: number,
  selectedSheetName: string | null,
): FieldProfile {
  const field = readRecord(value, path);
  assertAllowedKeys(
    field,
    [
      "id",
      "stableFieldKey",
      "index",
      "originalName",
      "displayName",
      "detectedType",
      "typeConfidence",
      "nonNullCount",
      "nullCount",
      "nullRate",
      "distinctCount",
      "isDistinctCountExact",
      "sampleValues",
      "statistics",
      "warnings",
    ],
    path,
  );

  const index = readInteger(field.index, `${path}.index`, DATASET_LIMITS.maxColumns);
  const originalName = readString(
    field.originalName,
    `${path}.originalName`,
    DATASET_LIMITS.maxCellTextLength,
    true,
  );
  const stableFieldKey = readString(
    field.stableFieldKey,
    `${path}.stableFieldKey`,
    80,
  );
  const detectedType = field.detectedType;

  if (index !== expectedIndex) {
    invalidRequest(`${path}.index does not match the physical field order.`);
  }

  if (!FIELD_DATA_TYPES.has(detectedType as FieldDataType)) {
    invalidRequest(`${path}.detectedType is not supported.`);
  }

  if (
    stableFieldKey !==
    createStableFieldKey(selectedSheetName, index, originalName)
  ) {
    throw new SemanticRequestError(
      "schema-mismatch",
      "The physical schema field references are no longer current.",
      409,
    );
  }

  const nonNullCount = readInteger(
    field.nonNullCount,
    `${path}.nonNullCount`,
    DATASET_LIMITS.maxProfileRows,
  );
  const nullCount = readInteger(
    field.nullCount,
    `${path}.nullCount`,
    DATASET_LIMITS.maxProfileRows,
  );
  const distinctCount = readInteger(
    field.distinctCount,
    `${path}.distinctCount`,
    DATASET_LIMITS.maxDistinctValuesTracked,
  );

  if (nonNullCount + nullCount !== profiledRows || distinctCount > nonNullCount) {
    invalidRequest(`${path} contains inconsistent profile counts.`);
  }

  if (
    !Array.isArray(field.sampleValues) ||
    field.sampleValues.length > DATASET_LIMITS.maxFieldSampleValues
  ) {
    invalidRequest(`${path}.sampleValues exceeds its allowed size.`);
  }

  return {
    id: readString(field.id, `${path}.id`, 300),
    stableFieldKey,
    index,
    originalName,
    displayName: readString(
      field.displayName,
      `${path}.displayName`,
      DATASET_LIMITS.maxCellTextLength,
    ),
    detectedType: detectedType as FieldDataType,
    typeConfidence: readRatio(field.typeConfidence, `${path}.typeConfidence`),
    nonNullCount,
    nullCount,
    nullRate: readRatio(field.nullRate, `${path}.nullRate`),
    distinctCount,
    isDistinctCountExact: readBoolean(
      field.isDistinctCountExact,
      `${path}.isDistinctCountExact`,
    ),
    sampleValues: field.sampleValues.map((sample, index) =>
      readCellValue(sample, `${path}.sampleValues[${index}]`),
    ),
    statistics: readStatistics(field.statistics, `${path}.statistics`),
    warnings: readWarnings(field.warnings, `${path}.warnings`),
  };
}

function readDatasetSchema(value: unknown): DatasetSchema {
  const schema = readRecord(value, "schema");
  assertAllowedKeys(
    schema,
    [
      "datasetId",
      "version",
      "schemaFingerprint",
      "selectedSheetName",
      "availableSheetNames",
      "headerRowIndex",
      "fields",
      "profileScope",
      "warnings",
    ],
    "schema",
  );

  const datasetId = readString(schema.datasetId, "schema.datasetId", 200);

  if (schema.version !== 1) {
    invalidRequest("schema.version is not supported.");
  }

  const selectedSheetName = readNullableString(
    schema.selectedSheetName,
    "schema.selectedSheetName",
    31,
  );

  if (
    !Array.isArray(schema.availableSheetNames) ||
    schema.availableSheetNames.length > DATASET_LIMITS.maxWorksheets
  ) {
    invalidRequest("schema.availableSheetNames exceeds its allowed size.");
  }

  const availableSheetNames = schema.availableSheetNames.map((sheetName, index) =>
    readString(sheetName, `schema.availableSheetNames[${index}]`, 31),
  );

  if (
    selectedSheetName !== null &&
    !availableSheetNames.includes(selectedSheetName)
  ) {
    invalidRequest("schema.selectedSheetName is not an available worksheet.");
  }

  const profileScope = readRecord(schema.profileScope, "schema.profileScope");
  assertAllowedKeys(
    profileScope,
    ["totalRows", "profiledRows", "isComplete"],
    "schema.profileScope",
  );
  const totalRows = readInteger(
    profileScope.totalRows,
    "schema.profileScope.totalRows",
    DATASET_LIMITS.maxRows,
  );
  const profiledRows = readInteger(
    profileScope.profiledRows,
    "schema.profileScope.profiledRows",
    DATASET_LIMITS.maxProfileRows,
  );
  const isComplete = readBoolean(
    profileScope.isComplete,
    "schema.profileScope.isComplete",
  );

  if (profiledRows > totalRows || isComplete !== (profiledRows === totalRows)) {
    invalidRequest("schema.profileScope is inconsistent.");
  }

  if (!Array.isArray(schema.fields)) {
    invalidRequest("schema.fields must be an array.");
  }

  if (schema.fields.length === 0) {
    throw new SemanticRequestError(
      "no-analyzable-fields",
      "The dataset does not contain fields that can be analyzed.",
      422,
    );
  }

  if (schema.fields.length > DATASET_LIMITS.maxColumns) {
    invalidRequest("schema.fields exceeds the dataset column limit.");
  }

  const fields = schema.fields.map((field, index) =>
    readFieldProfile(
      field,
      `schema.fields[${index}]`,
      index,
      profiledRows,
      selectedSheetName,
    ),
  );
  const schemaFingerprint = readString(
    schema.schemaFingerprint,
    "schema.schemaFingerprint",
    80,
  );

  if (schemaFingerprint !== createSchemaFingerprint(selectedSheetName, fields)) {
    throw new SemanticRequestError(
      "schema-mismatch",
      "The physical schema fingerprint is no longer current.",
      409,
    );
  }

  return {
    datasetId,
    version: 1,
    schemaFingerprint,
    selectedSheetName,
    availableSheetNames,
    headerRowIndex: readInteger(
      schema.headerRowIndex,
      "schema.headerRowIndex",
      DATASET_LIMITS.maxRows,
    ),
    fields,
    profileScope: {
      totalRows,
      profiledRows,
      isComplete,
    },
    warnings: readWarnings(schema.warnings, "schema.warnings"),
  };
}

async function readRequestBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.toLowerCase().includes("application/json")) {
    throw new SemanticRequestError(
      "invalid-request",
      "Submit the physical schema as JSON.",
      415,
    );
  }

  const declaredLength = Number(request.headers.get("content-length"));

  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
    throw new SemanticRequestError(
      "invalid-request",
      "The physical schema request is too large.",
      413,
    );
  }

  const body = await request.text();

  if (new TextEncoder().encode(body).byteLength > MAX_REQUEST_BYTES) {
    throw new SemanticRequestError(
      "invalid-request",
      "The physical schema request is too large.",
      413,
    );
  }

  try {
    return JSON.parse(body) as unknown;
  } catch {
    return invalidRequest("The request body contains invalid JSON.");
  }
}

export async function POST(request: Request) {
  try {
    const requestBody = readRecord(await readRequestBody(request), "request");
    assertAllowedKeys(requestBody, ["schema", "datasetContext"], "request");
    const schema = readDatasetSchema(requestBody.schema);
    const datasetContext = readDatasetContext(requestBody.datasetContext);
    const inferenceContext = buildSemanticInferenceContext(schema);
    const semanticInference = await generateSemanticInference({
      context: inferenceContext,
      modelId: defaultSemanticAiModelId,
      datasetContext,
    });
    const suggestionBatch = semanticInference.suggestionBatch;
    const semanticSchema = buildSemanticSchemaDraft(schema, suggestionBatch);
    const autoUsePolicy = createSemanticAutoUsePolicy(
      inferenceContext,
      suggestionBatch,
      datasetContext,
    );
    const fieldEvidence = inferenceContext.fields.map((field) => ({
      stableFieldKey: field.stableFieldKey,
      sanitizedSamples: field.sanitizedSamples,
      sampleSummary: field.sampleSummary,
      safeStatistics: field.safeStatistics,
      nullRate: field.nullRate,
      distinctCount: field.distinctCount,
      isDistinctCountExact: field.isDistinctCountExact,
    }));

    return jsonResponse({
      semanticSchema,
      autoUsePolicy,
      fieldEvidence,
      inferenceMode: semanticInference.inferenceMode,
    });
  } catch (error) {
    if (error instanceof SemanticRequestError) {
      return requestError(error);
    }

    return jsonResponse(
      {
        error: {
          code: "suggestion-generation-failed",
          message: "Semantic suggestions could not be generated for this dataset.",
        },
      },
      500,
    );
  }
}
