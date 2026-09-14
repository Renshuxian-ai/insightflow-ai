import "server-only";

import { DATASET_PRIMARY_ANOMALY_ID } from "../dataset-diagnostic-case";
import type { DiagnosticCase } from "../types";

type JsonRecord = Record<string, unknown>;

export class DatasetDiagnosticCaseValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatasetDiagnosticCaseValidationError";
  }
}

function invalid(path: string): never {
  throw new DatasetDiagnosticCaseValidationError(
    `${path} is not a valid Dataset DiagnosticCase value.`,
  );
}

function readRecord(
  value: unknown,
  path: string,
  allowedKeys: readonly string[],
): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    invalid(path);
  }

  const record = value as JsonRecord;

  if (Object.keys(record).some((key) => !allowedKeys.includes(key))) {
    invalid(path);
  }

  return record;
}

function readString(value: unknown, path: string, maxLength = 2_000): string {
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    value.length > maxLength
  ) {
    invalid(path);
  }

  return value;
}

function readNumber(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    invalid(path);
  }

  return value;
}

function readArray(
  value: unknown,
  path: string,
  minimumItems: number,
  maximumItems: number,
): unknown[] {
  if (
    !Array.isArray(value) ||
    value.length < minimumItems ||
    value.length > maximumItems
  ) {
    invalid(path);
  }

  return value;
}

function readStringArray(
  value: unknown,
  path: string,
  minimumItems = 0,
  maximumItems = 20,
): string[] {
  return readArray(value, path, minimumItems, maximumItems).map(
    (item, index) => readString(item, `${path}[${index}]`, 160),
  );
}

function readContextItem(value: unknown, path: string) {
  const item = readRecord(value, path, ["id", "label"]);

  return {
    id: readString(item.id, `${path}.id`, 160),
    label: readString(item.label, `${path}.label`, 500),
  };
}

function readReasoningStatement(value: unknown, path: string) {
  const item = readRecord(value, path, ["statement", "evidenceIds", "status"]);
  const status = item.status;

  if (status !== undefined && typeof status !== "string") {
    invalid(`${path}.status`);
  }

  return {
    statement: readString(item.statement, `${path}.statement`),
    evidenceIds: readStringArray(item.evidenceIds, `${path}.evidenceIds`),
    ...(status ? { status: readString(status, `${path}.status`, 240) } : {}),
  };
}

function assertUnique(values: string[], path: string): void {
  if (new Set(values).size !== values.length) {
    invalid(path);
  }
}

function assertKnownReferences(
  referenceIds: string[],
  evidenceIds: Set<string>,
  path: string,
): void {
  if (referenceIds.some((referenceId) => !evidenceIds.has(referenceId))) {
    invalid(path);
  }
}

export function parseDatasetDiagnosticCase(value: unknown): DiagnosticCase {
  const diagnosticCase = readRecord(value, "diagnosticCase", [
    "id",
    "source",
    "status",
    "severity",
    "title",
    "metric",
    "context",
    "summary",
    "evidence",
    "reasoning",
    "traceSteps",
    "nextValidations",
  ]);

  if (
    diagnosticCase.id !== DATASET_PRIMARY_ANOMALY_ID ||
    diagnosticCase.source !== "dataset" ||
    diagnosticCase.status !== "ready" ||
    (diagnosticCase.severity !== "HIGH" &&
      diagnosticCase.severity !== "MEDIUM")
  ) {
    invalid("diagnosticCase");
  }

  const metric = readRecord(diagnosticCase.metric, "diagnosticCase.metric", [
    "id",
    "label",
    "currentValue",
    "previousValue",
    "changeValue",
    "changeType",
    "comparison",
  ]);
  const previousValue = metric.previousValue;
  const changeType = metric.changeType;

  if (
    previousValue !== undefined &&
    (typeof previousValue !== "string" || previousValue.length > 160)
  ) {
    invalid("diagnosticCase.metric.previousValue");
  }

  if (
    changeType !== undefined &&
    changeType !== "relative-percent" &&
    changeType !== "percentage-points"
  ) {
    invalid("diagnosticCase.metric.changeType");
  }

  const context = readRecord(diagnosticCase.context, "diagnosticCase.context", [
    "dateRange",
    "segment",
    "platform",
    "version",
  ]);
  const summary = readRecord(diagnosticCase.summary, "diagnosticCase.summary", [
    "changed",
    "affected",
    "started",
  ]);
  const evidence = readRecord(
    diagnosticCase.evidence,
    "diagnosticCase.evidence",
    ["behaviorSignals", "feedbackSignals"],
  );

  const behaviorSignals = readArray(
    evidence.behaviorSignals,
    "diagnosticCase.evidence.behaviorSignals",
    1,
    12,
  ).map((value, index) => {
    const path = `diagnosticCase.evidence.behaviorSignals[${index}]`;
    const signal = readRecord(value, path, [
      "id",
      "label",
      "value",
      "finding",
      "detail",
      "source",
    ]);

    return {
      id: readString(signal.id, `${path}.id`, 160),
      label: readString(signal.label, `${path}.label`, 240),
      value: readString(signal.value, `${path}.value`, 240),
      finding: readString(signal.finding, `${path}.finding`),
      detail: readString(signal.detail, `${path}.detail`),
      source: readString(signal.source, `${path}.source`, 500),
    };
  });
  const feedbackSignals = readArray(
    evidence.feedbackSignals,
    "diagnosticCase.evidence.feedbackSignals",
    0,
    12,
  ).map((value, index) => {
    const path = `diagnosticCase.evidence.feedbackSignals[${index}]`;
    const signal = readRecord(value, path, [
      "id",
      "topic",
      "mentionCount",
      "change",
      "sentiment",
      "finding",
      "source",
      "snippets",
    ]);
    const mentionCount = readNumber(
      signal.mentionCount,
      `${path}.mentionCount`,
    );

    if (
      !Number.isSafeInteger(mentionCount) ||
      mentionCount < 0 ||
      (signal.sentiment !== "Negative" && signal.sentiment !== "Mixed")
    ) {
      invalid(path);
    }

    return {
      id: readString(signal.id, `${path}.id`, 160),
      topic: readString(signal.topic, `${path}.topic`, 240),
      mentionCount,
      change: readString(signal.change, `${path}.change`, 160),
      sentiment: signal.sentiment,
      finding: readString(signal.finding, `${path}.finding`),
      source: readString(signal.source, `${path}.source`, 500),
      snippets: readStringArray(signal.snippets, `${path}.snippets`, 0, 8),
    };
  });
  const evidenceIds = new Set([
    ...behaviorSignals.map((signal) => signal.id),
    ...feedbackSignals.map((signal) => signal.id),
  ]);

  assertUnique([...evidenceIds], "diagnosticCase.evidence");

  const reasoning = readRecord(
    diagnosticCase.reasoning,
    "diagnosticCase.reasoning",
    ["observation", "inference", "hypothesis"],
  );
  const parsedReasoning = {
    observation: readReasoningStatement(
      reasoning.observation,
      "diagnosticCase.reasoning.observation",
    ),
    inference: readReasoningStatement(
      reasoning.inference,
      "diagnosticCase.reasoning.inference",
    ),
    hypothesis: readReasoningStatement(
      reasoning.hypothesis,
      "diagnosticCase.reasoning.hypothesis",
    ),
  };

  for (const [key, statement] of Object.entries(parsedReasoning)) {
    assertKnownReferences(
      statement.evidenceIds,
      evidenceIds,
      `diagnosticCase.reasoning.${key}.evidenceIds`,
    );
  }

  const traceSteps = readArray(
    diagnosticCase.traceSteps,
    "diagnosticCase.traceSteps",
    1,
    12,
  ).map((value, index) => {
    const path = `diagnosticCase.traceSteps[${index}]`;
    const step = readRecord(value, path, [
      "id",
      "label",
      "description",
      "status",
      "evidenceIds",
    ]);

    if (step.status !== "dataset-calculated") {
      invalid(`${path}.status`);
    }

    const stepEvidenceIds = readStringArray(
      step.evidenceIds,
      `${path}.evidenceIds`,
    );
    assertKnownReferences(stepEvidenceIds, evidenceIds, `${path}.evidenceIds`);

    return {
      id: readString(step.id, `${path}.id`, 160),
      label: readString(step.label, `${path}.label`, 240),
      description: readString(step.description, `${path}.description`),
      status: "dataset-calculated" as const,
      evidenceIds: stepEvidenceIds,
    };
  });
  const nextValidations = readArray(
    diagnosticCase.nextValidations,
    "diagnosticCase.nextValidations",
    1,
    12,
  ).map((value, index) => {
    const path = `diagnosticCase.nextValidations[${index}]`;
    const validation = readRecord(value, path, ["id", "label", "description"]);

    return {
      id: readString(validation.id, `${path}.id`, 160),
      label: readString(validation.label, `${path}.label`, 240),
      description: readString(
        validation.description,
        `${path}.description`,
      ),
    };
  });

  assertUnique(
    behaviorSignals.map((signal) => signal.id).concat(
      feedbackSignals.map((signal) => signal.id),
    ),
    "diagnosticCase.evidence",
  );
  assertUnique(
    traceSteps.map((step) => step.id),
    "diagnosticCase.traceSteps",
  );
  assertUnique(
    nextValidations.map((validation) => validation.id),
    "diagnosticCase.nextValidations",
  );

  return {
    id: DATASET_PRIMARY_ANOMALY_ID,
    source: "dataset",
    status: "ready",
    severity: diagnosticCase.severity,
    title: readString(diagnosticCase.title, "diagnosticCase.title", 240),
    metric: {
      id: readString(metric.id, "diagnosticCase.metric.id", 160),
      label: readString(metric.label, "diagnosticCase.metric.label", 240),
      currentValue: readString(
        metric.currentValue,
        "diagnosticCase.metric.currentValue",
        160,
      ),
      ...(previousValue !== undefined ? { previousValue } : {}),
      changeValue: readNumber(
        metric.changeValue,
        "diagnosticCase.metric.changeValue",
      ),
      ...(changeType !== undefined ? { changeType } : {}),
      comparison: readString(
        metric.comparison,
        "diagnosticCase.metric.comparison",
        500,
      ),
    },
    context: {
      dateRange: readContextItem(
        context.dateRange,
        "diagnosticCase.context.dateRange",
      ),
      segment: readContextItem(
        context.segment,
        "diagnosticCase.context.segment",
      ),
      platform: readContextItem(
        context.platform,
        "diagnosticCase.context.platform",
      ),
      version: readContextItem(
        context.version,
        "diagnosticCase.context.version",
      ),
    },
    summary: {
      changed: readString(summary.changed, "diagnosticCase.summary.changed"),
      affected: readString(summary.affected, "diagnosticCase.summary.affected"),
      started: readString(summary.started, "diagnosticCase.summary.started"),
    },
    evidence: {
      behaviorSignals: behaviorSignals as DiagnosticCase["evidence"]["behaviorSignals"],
      feedbackSignals: feedbackSignals as DiagnosticCase["evidence"]["feedbackSignals"],
    },
    reasoning: parsedReasoning,
    traceSteps,
    nextValidations,
  };
}
