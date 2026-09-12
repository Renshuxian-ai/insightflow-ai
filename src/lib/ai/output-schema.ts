import type { DiagnosticCase } from "@/lib/diagnostics/types";
import type {
  ConfidenceLevel,
  EvidenceReference,
  InvestigationResult,
} from "@/lib/investigations/types";

type JsonRecord = Record<string, unknown>;

export type InvestigationValidationDiagnostic = {
  path: string;
  issue: string;
  expected: string;
  receivedType: string;
  received: string;
};

export class InvestigationOutputValidationError extends Error {
  constructor(readonly diagnostic: InvestigationValidationDiagnostic) {
    super(
      `${diagnostic.path}: ${diagnostic.issue} Expected ${diagnostic.expected}; received ${diagnostic.received}.`,
    );
    this.name = "InvestigationOutputValidationError";
  }
}

function describeReceived(value: unknown): string {
  if (value === undefined) {
    return "missing";
  }

  if (value === null) {
    return "null";
  }

  if (Array.isArray(value)) {
    return `array(length=${value.length})`;
  }

  if (typeof value === "string") {
    return `string(length=${value.length})`;
  }

  return typeof value;
}

function getReceivedType(value: unknown): string {
  if (value === null) {
    return "null";
  }

  return Array.isArray(value) ? "array" : typeof value;
}

function failValidation(
  path: string,
  issue: string,
  expected: string,
  value: unknown,
  received = describeReceived(value),
): never {
  throw new InvestigationOutputValidationError({
    path,
    issue,
    expected,
    receivedType: getReceivedType(value),
    received,
  });
}

function readRecord(value: unknown, path: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    failValidation(
      path,
      value === undefined ? "missing field." : "type mismatch.",
      "object",
      value,
    );
  }

  return value as JsonRecord;
}

function readString(value: unknown, path: string, maxLength = 2_000): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    failValidation(
      path,
      value === undefined ? "missing field." : "invalid string.",
      "non-empty string",
      value,
    );
  }

  const normalized = value.trim();

  if (normalized.length > maxLength) {
    failValidation(
      path,
      "text exceeds the allowed length.",
      `string no longer than ${maxLength} characters`,
      value,
    );
  }

  return normalized;
}

function readArray(
  value: unknown,
  path: string,
  minimumItems = 1,
  maximumItems = 20,
): unknown[] {
  if (!Array.isArray(value)) {
    failValidation(
      path,
      value === undefined ? "missing field." : "type mismatch.",
      "array",
      value,
    );
  }

  if (value.length < minimumItems || value.length > maximumItems) {
    failValidation(
      path,
      "array length is outside the allowed bounds.",
      `${minimumItems}-${maximumItems} items`,
      value,
    );
  }

  return value;
}

function readStringArray(
  value: unknown,
  path: string,
  minimumItems = 1,
  maximumItems = 20,
): string[] {
  return readArray(value, path, minimumItems, maximumItems).map((item, index) =>
    readString(item, `${path}[${index}]`, 120),
  );
}

function readEnum<T extends string>(
  value: unknown,
  allowedValues: readonly T[],
  path: string,
): T {
  if (typeof value !== "string" || !allowedValues.includes(value as T)) {
    failValidation(
      path,
      value === undefined ? "missing field." : "invalid enum value.",
      `one of: ${allowedValues.join(", ")}`,
      value,
    );
  }

  return value as T;
}

function ensureUnique(values: string[], path: string) {
  if (new Set(values).size !== values.length) {
    failValidation(
      path,
      "duplicate IDs.",
      "an array of unique IDs",
      values,
      `array(length=${values.length}, contains duplicates)`,
    );
  }
}

function ensureReferencesExist(
  referenceIds: string[],
  availableIds: Set<string>,
  path: string,
) {
  const invalidReference = referenceIds.find(
    (referenceId) => !availableIds.has(referenceId),
  );

  if (invalidReference) {
    failValidation(
      path,
      "unknown evidence reference.",
      "IDs declared in investigationResult.evidenceUsed",
      invalidReference,
      "string(reference not found)",
    );
  }
}

function isValidDiagnosticSource(
  reference: EvidenceReference,
  diagnosticCase: DiagnosticCase,
): boolean {
  if (reference.sourceType === "metric") {
    return reference.sourceId === diagnosticCase.metric.id;
  }

  if (reference.sourceType === "context") {
    return Object.values(diagnosticCase.context).some(
      (contextItem) => contextItem.id === reference.sourceId,
    );
  }

  if (reference.sourceType === "behavior-signal") {
    return diagnosticCase.evidence.behaviorSignals.some(
      (signal) => signal.id === reference.sourceId,
    );
  }

  return diagnosticCase.evidence.feedbackSignals.some(
    (signal) => signal.id === reference.sourceId,
  );
}

function parseEvidenceReference(
  value: unknown,
  path: string,
  diagnosticCase: DiagnosticCase,
): EvidenceReference {
  const item = readRecord(value, path);
  const reference: EvidenceReference = {
    id: readString(item.id, `${path}.id`, 120),
    sourceType: readEnum(
      item.sourceType,
      ["metric", "context", "behavior-signal", "feedback-signal"] as const,
      `${path}.sourceType`,
    ),
    sourceId: readString(item.sourceId, `${path}.sourceId`, 120),
    relevance: readString(item.relevance, `${path}.relevance`, 800),
  };

  if (!isValidDiagnosticSource(reference, diagnosticCase)) {
    failValidation(
      `${path}.sourceId`,
      "ungrounded source reference.",
      "an existing source ID from the requested DiagnosticCase",
      reference.sourceId,
      "string(reference not found)",
    );
  }

  return reference;
}

export function parseInvestigationResult(
  value: unknown,
  diagnosticCase: DiagnosticCase,
): InvestigationResult {
  const output = readRecord(value, "investigationResult");
  const evidenceUsed = readArray(
    output.evidenceUsed,
    "investigationResult.evidenceUsed",
    1,
    12,
  ).map((item, index) =>
    parseEvidenceReference(
      item,
      `investigationResult.evidenceUsed[${index}]`,
      diagnosticCase,
    ),
  );
  const evidenceReferenceIds = evidenceUsed.map((reference) => reference.id);
  const evidenceReferenceIdSet = new Set(evidenceReferenceIds);
  ensureUnique(evidenceReferenceIds, "investigationResult.evidenceUsed");

  const focus = readRecord(output.focus, "investigationResult.focus");
  const summary = readRecord(output.summary, "investigationResult.summary");
  const summaryReferenceIds = readStringArray(
    summary.evidenceReferenceIds,
    "investigationResult.summary.evidenceReferenceIds",
  );
  ensureReferencesExist(
    summaryReferenceIds,
    evidenceReferenceIdSet,
    "investigationResult.summary.evidenceReferenceIds",
  );

  const possibleExplanations = readArray(
    output.possibleExplanations,
    "investigationResult.possibleExplanations",
    1,
    6,
  ).map((value, index) => {
    const path = `investigationResult.possibleExplanations[${index}]`;
    const item = readRecord(value, path);
    const itemReferenceIds = readStringArray(
      item.evidenceReferenceIds,
      `${path}.evidenceReferenceIds`,
    );
    ensureReferencesExist(itemReferenceIds, evidenceReferenceIdSet, path);

    return {
      id: readString(item.id, `${path}.id`, 120),
      statement: readString(item.statement, `${path}.statement`),
      qualification: readEnum(
        item.qualification,
        ["possible-not-confirmed", "alternative-to-rule-out"] as const,
        `${path}.qualification`,
      ),
      evidenceRelationship: readEnum(
        item.evidenceRelationship,
        ["supporting", "context-only"] as const,
        `${path}.evidenceRelationship`,
      ),
      confidence: readEnum<ConfidenceLevel>(
        item.confidence,
        ["low", "medium", "high"] as const,
        `${path}.confidence`,
      ),
      confidenceRationale: readString(
        item.confidenceRationale,
        `${path}.confidenceRationale`,
      ),
      evidenceReferenceIds: itemReferenceIds,
      uncertainty: readString(item.uncertainty, `${path}.uncertainty`),
    };
  });
  ensureUnique(
    possibleExplanations.map((explanation) => explanation.id),
    "investigationResult.possibleExplanations",
  );

  const workingHypothesis = readRecord(
    output.workingHypothesis,
    "investigationResult.workingHypothesis",
  );
  const hypothesisReferenceIds = readStringArray(
    workingHypothesis.evidenceReferenceIds,
    "investigationResult.workingHypothesis.evidenceReferenceIds",
  );
  ensureReferencesExist(
    hypothesisReferenceIds,
    evidenceReferenceIdSet,
    "investigationResult.workingHypothesis.evidenceReferenceIds",
  );

  const availableValidationIds = new Set(
    diagnosticCase.nextValidations.map((validation) => validation.id),
  );
  const recommendedValidations = readArray(
    output.recommendedValidations,
    "investigationResult.recommendedValidations",
    1,
    diagnosticCase.nextValidations.length,
  ).map((value, index) => {
    const path = `investigationResult.recommendedValidations[${index}]`;
    const item = readRecord(value, path);
    const validationId = readString(
      item.validationId,
      `${path}.validationId`,
      120,
    );

    if (!availableValidationIds.has(validationId)) {
      failValidation(
        `${path}.validationId`,
        "unknown validation reference.",
        "an existing nextValidation ID from the requested DiagnosticCase",
        validationId,
        "string(reference not found)",
      );
    }

    return {
      validationId,
      priority: readEnum(
        item.priority,
        ["primary", "supporting"] as const,
        `${path}.priority`,
      ),
      rationale: readString(item.rationale, `${path}.rationale`, 800),
    };
  });
  ensureUnique(
    recommendedValidations.map((validation) => validation.validationId),
    "investigationResult.recommendedValidations",
  );

  const result: InvestigationResult = {
    id: readString(output.id, "investigationResult.id", 160),
    diagnosticCaseId: readString(
      output.diagnosticCaseId,
      "investigationResult.diagnosticCaseId",
      120,
    ),
    source: readEnum(
      output.source,
      ["mock", "deepseek"] as const,
      "investigationResult.source",
    ),
    status: readEnum(
      output.status,
      ["prototype-draft", "generated-draft"] as const,
      "investigationResult.status",
    ),
    focus: {
      title: readString(focus.title, "investigationResult.focus.title", 240),
      description: readString(
        focus.description,
        "investigationResult.focus.description",
      ),
    },
    summary: {
      text: readString(summary.text, "investigationResult.summary.text"),
      evidenceReferenceIds: summaryReferenceIds,
    },
    evidenceUsed,
    possibleExplanations,
    workingHypothesis: {
      id: readString(
        workingHypothesis.id,
        "investigationResult.workingHypothesis.id",
        160,
      ),
      statement: readString(
        workingHypothesis.statement,
        "investigationResult.workingHypothesis.statement",
      ),
      status: readEnum(
        workingHypothesis.status,
        ["unvalidated"] as const,
        "investigationResult.workingHypothesis.status",
      ),
      evidenceReferenceIds: hypothesisReferenceIds,
    },
    recommendedValidations,
    limitations: readStringArray(
      output.limitations,
      "investigationResult.limitations",
      1,
      8,
    ),
  };

  if (result.diagnosticCaseId !== diagnosticCase.id) {
    failValidation(
      "investigationResult.diagnosticCaseId",
      "case identity mismatch.",
      "the requested DiagnosticCase ID",
      result.diagnosticCaseId,
      "string(non-matching value)",
    );
  }

  return result;
}
