import "server-only";

import { DATASET_LIMITS } from "@/lib/datasets/constants";
import type {
  DatasetCellValue,
  DatasetWarning,
  FieldProfile,
  FieldStatistics,
} from "@/lib/datasets/types";

import {
  classifyDatasetValue,
  createFieldTypeCounts,
  inferFieldType,
  isMissingDatasetValue,
  toNumericValue,
  toTemporalValue,
  type FieldTypeCounts,
} from "./infer-field-type";

type FrequencyEntry = {
  value: DatasetCellValue;
  count: number;
};

function valueKey(value: DatasetCellValue): string {
  return `${typeof value}:${String(value)}`;
}

export class FieldProfileAccumulator {
  private readonly typeCounts: FieldTypeCounts = createFieldTypeCounts();
  private readonly sampleValues: DatasetCellValue[] = [];
  private readonly frequencies = new Map<string, FrequencyEntry>();
  private nullCount = 0;
  private nonNullCount = 0;
  private numericCount = 0;
  private numericSum = 0;
  private numericMin = Number.POSITIVE_INFINITY;
  private numericMax = Number.NEGATIVE_INFINITY;
  private earliest: string | null = null;
  private latest: string | null = null;
  private distinctCountIsExact = true;

  constructor(
    private readonly id: string,
    private readonly index: number,
    private readonly originalName: string,
    private readonly displayName: string,
  ) {}

  observe(value: DatasetCellValue) {
    if (isMissingDatasetValue(value)) {
      this.nullCount += 1;
      return;
    }

    this.nonNullCount += 1;

    if (this.sampleValues.length < DATASET_LIMITS.maxFieldSampleValues) {
      this.sampleValues.push(value);
    }

    const detectedValueType = classifyDatasetValue(value);

    if (detectedValueType !== "empty") {
      this.typeCounts[detectedValueType] += 1;
    }

    this.observeDistinctValue(value);
    this.observeNumericValue(value);
    this.observeTemporalValue(value);
  }

  toFieldProfile(profiledRows: number): FieldProfile {
    const detectedType = inferFieldType(this.typeCounts);
    const warnings = this.createWarnings(detectedType);

    return {
      id: this.id,
      index: this.index,
      originalName: this.originalName,
      displayName: this.displayName,
      detectedType,
      nonNullCount: this.nonNullCount,
      nullCount: this.nullCount,
      nullRate: profiledRows === 0 ? 0 : this.nullCount / profiledRows,
      distinctCount: this.frequencies.size,
      isDistinctCountExact: this.distinctCountIsExact,
      sampleValues: this.sampleValues,
      statistics: this.createStatistics(detectedType),
      warnings,
    };
  }

  private observeDistinctValue(value: DatasetCellValue) {
    const key = valueKey(value);
    const existing = this.frequencies.get(key);

    if (existing) {
      existing.count += 1;
      return;
    }

    if (this.frequencies.size >= DATASET_LIMITS.maxDistinctValuesTracked) {
      this.distinctCountIsExact = false;
      return;
    }

    this.frequencies.set(key, { value, count: 1 });
  }

  private observeNumericValue(value: DatasetCellValue) {
    const numericValue = toNumericValue(value);

    if (numericValue === null) {
      return;
    }

    this.numericCount += 1;
    this.numericSum += numericValue;
    this.numericMin = Math.min(this.numericMin, numericValue);
    this.numericMax = Math.max(this.numericMax, numericValue);
  }

  private observeTemporalValue(value: DatasetCellValue) {
    const temporalValue = toTemporalValue(value);

    if (!temporalValue) {
      return;
    }

    if (!this.earliest || temporalValue < this.earliest) {
      this.earliest = temporalValue;
    }

    if (!this.latest || temporalValue > this.latest) {
      this.latest = temporalValue;
    }
  }

  private createStatistics(detectedType: FieldProfile["detectedType"]): FieldStatistics {
    if (
      (detectedType === "integer" || detectedType === "number") &&
      this.numericCount > 0
    ) {
      return {
        kind: "numeric",
        min: this.numericMin,
        max: this.numericMax,
        mean: this.numericSum / this.numericCount,
      };
    }

    if (
      (detectedType === "date" || detectedType === "datetime") &&
      this.earliest &&
      this.latest
    ) {
      return {
        kind: "temporal",
        earliest: this.earliest,
        latest: this.latest,
      };
    }

    if (this.nonNullCount > 0) {
      return {
        kind: "categorical",
        topValues: [...this.frequencies.values()]
          .sort((left, right) => right.count - left.count)
          .slice(0, 5),
      };
    }

    return { kind: "none" };
  }

  private createWarnings(
    detectedType: FieldProfile["detectedType"],
  ): DatasetWarning[] {
    const warnings: DatasetWarning[] = [];

    if (detectedType === "mixed") {
      warnings.push({
        code: "mixed-field-values",
        message: "The profiled values contain multiple physical data types.",
      });
    }

    if (!this.distinctCountIsExact) {
      warnings.push({
        code: "distinct-count-limited",
        message: "Distinct values exceeded the profiling limit, so the count is a lower bound.",
      });
    }

    return warnings;
  }
}
