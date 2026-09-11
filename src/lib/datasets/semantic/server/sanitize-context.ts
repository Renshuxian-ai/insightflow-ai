import "server-only";

import type { FieldProfile } from "@/lib/datasets/types";

import { SEMANTIC_TYPE_IDS } from "../semantic-type-registry";
import type {
  HeuristicSemanticCandidate,
  SanitizedSampleValue,
  SemanticSafeStatistics,
  SemanticSampleSummary,
} from "../types";

const MAX_CONTEXT_SAMPLES = 3;
const MAX_SAMPLE_TEXT_LENGTH = 80;
const MAX_FIELD_NAME_LENGTH = 120;

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE_PATTERN = /(?:\+?\d[\d\s().-]{6,}\d)/;
const IPV4_PATTERN = /\b(?:\d{1,3}\.){3}\d{1,3}\b/;
const IPV6_PATTERN = /\b(?:[A-F0-9]{1,4}:){2,7}[A-F0-9]{1,4}\b/i;
const URL_PATTERN = /\bhttps?:\/\/\S+/i;
const SECRET_PATTERN =
  /(?:\b(?:api[_-]?key|access[_-]?token|secret|bearer)\b\s*[:=]?\s*\S+)|(?:\b(?:sk|pk|rk)-[A-Z0-9_-]{12,})|(?:\beyJ[A-Z0-9_-]+\.[A-Z0-9_-]+\.[A-Z0-9_-]+\b)/i;
const HIGH_ENTROPY_TOKEN_PATTERN =
  /^(?=.{24,}$)(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d_-]+$/;
const ADDRESS_PATTERN =
  /\b\d{1,6}\s+[\p{L}\d.'-]+(?:\s+[\p{L}\d.'-]+){0,5}\s+(?:street|st|road|rd|avenue|ave|boulevard|blvd|lane|ln|drive|dr|路|街|道|巷)\b/iu;
const IDENTIFIER_NAME_PATTERN =
  /(?:^|_)(?:id|uuid|guid|device_id|account_id|customer_id|token|key)$/;

type SanitizedSamples = {
  values: SanitizedSampleValue[];
  summary: SemanticSampleSummary;
  sensitiveField: boolean;
};

export function sanitizeFieldName(value: string): string {
  const sanitized = value
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_FIELD_NAME_LENGTH);

  return sanitized || "Unnamed field";
}

function isSensitiveText(value: string): boolean {
  return (
    EMAIL_PATTERN.test(value) ||
    PHONE_PATTERN.test(value) ||
    IPV4_PATTERN.test(value) ||
    IPV6_PATTERN.test(value) ||
    URL_PATTERN.test(value) ||
    SECRET_PATTERN.test(value) ||
    HIGH_ENTROPY_TOKEN_PATTERN.test(value) ||
    ADDRESS_PATTERN.test(value) ||
    value.length > MAX_SAMPLE_TEXT_LENGTH
  );
}

function sanitizeSampleValue(value: unknown): SanitizedSampleValue | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized || isSensitiveText(normalized)) {
    return null;
  }

  return normalized;
}

function hasSensitiveSemanticCandidate(
  candidates: readonly HeuristicSemanticCandidate[],
): boolean {
  return candidates.some(
    (candidate) =>
      candidate.semanticType === SEMANTIC_TYPE_IDS.userId ||
      candidate.semanticType === SEMANTIC_TYPE_IDS.sessionId ||
      candidate.semanticType === SEMANTIC_TYPE_IDS.feedbackText,
  );
}

function isSensitiveField(
  field: FieldProfile,
  candidates: readonly HeuristicSemanticCandidate[],
  distinctRate: number,
): boolean {
  const normalizedName = field.originalName
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_");
  const compactHighCardinalitySamples = field.sampleValues.some(
    (value) =>
      typeof value === "string" &&
      value.length >= 12 &&
      /^[A-Za-z\d_-]+$/.test(value),
  );

  return (
    hasSensitiveSemanticCandidate(candidates) ||
    (distinctRate >= 0.8 &&
      (IDENTIFIER_NAME_PATTERN.test(normalizedName) ||
        compactHighCardinalitySamples))
  );
}

function getTextLength(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  return String(value).length;
}

export function sanitizeFieldSamples(
  field: FieldProfile,
  candidates: readonly HeuristicSemanticCandidate[],
  distinctRate: number,
): SanitizedSamples {
  const lengths = field.sampleValues
    .map((value) => getTextLength(value))
    .filter((value): value is number => value !== null);
  const sensitiveField = isSensitiveField(field, candidates, distinctRate);
  const values = sensitiveField
    ? []
    : field.sampleValues
        .map((value) => sanitizeSampleValue(value))
        .filter((value): value is SanitizedSampleValue => value !== null)
        .slice(0, MAX_CONTEXT_SAMPLES);
  const redactedSampleCount = field.sampleValues.length - values.length;

  return {
    values,
    sensitiveField,
    summary: {
      observedSampleCount: field.sampleValues.length,
      includedSampleCount: values.length,
      redactedSampleCount,
      minimumTextLength: lengths.length > 0 ? Math.min(...lengths) : null,
      maximumTextLength: lengths.length > 0 ? Math.max(...lengths) : null,
      policy:
        field.sampleValues.length === 0
          ? "no-samples"
          : sensitiveField
            ? "redacted-sensitive-field"
            : redactedSampleCount > 0
              ? "partially-redacted"
              : "included",
    },
  };
}

export function sanitizeFieldStatistics(
  field: FieldProfile,
  samples: SanitizedSamples,
): SemanticSafeStatistics {
  if (samples.sensitiveField) {
    return { kind: "none", valuesRedacted: true };
  }

  if (field.statistics.kind === "numeric") {
    return {
      kind: "numeric",
      min: field.statistics.min,
      max: field.statistics.max,
      mean: field.statistics.mean,
    };
  }

  if (field.statistics.kind === "temporal") {
    return {
      kind: "temporal",
      earliest: field.statistics.earliest,
      latest: field.statistics.latest,
    };
  }

  if (field.statistics.kind === "categorical") {
    const topValues = field.statistics.topValues
      .map(({ value, count }) => {
        const sanitizedValue = sanitizeSampleValue(value);

        return sanitizedValue === null
          ? null
          : { value: sanitizedValue, count };
      })
      .filter(
        (
          value,
        ): value is { value: SanitizedSampleValue; count: number } =>
          value !== null,
      )
      .slice(0, MAX_CONTEXT_SAMPLES);

    return {
      kind: "categorical",
      topValues,
      valuesRedacted: topValues.length < field.statistics.topValues.length,
    };
  }

  return { kind: "none", valuesRedacted: false };
}
