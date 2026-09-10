import type { DiagnosticCase } from "@/lib/diagnostics/types";
import type {
  ConfidenceLevel,
  EvidenceReference,
  InvestigationResult,
} from "@/lib/investigations/types";

type JsonRecord = Record<string, unknown>;

export class InvestigationOutputValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvestigationOutputValidationError";
  }
}

function readRecord(value: unknown, path: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new InvestigationOutputValidationError(`${path} must be an object.`);
  }

  return value as JsonRecord;
}

function readString(value: unknown, path: string, maxLength = 2_000): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new InvestigationOutputValidationError(`${path} must be a non-empty string.`);
  }

  const normalized = value.trim();

  if (normalized.length > maxLength) {
    throw new InvestigationOutputValidationError(`${path} is too long.`);
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
    throw new InvestigationOutputValidationError(`${path} must be an array.`);
  }

  if (value.length < minimumItems || value.length > maximumItems) {
    throw new InvestigationOutputValidationError(
      `${path} must contain between ${minimumItems} and ${maximumItems} items.`,
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
    throw new InvestigationOutputValidationError(
      `${path} must be one of: ${allowedValues.join(", ")}.`,
    );
  }

  return value as T;
}

function ensureUnique(values: string[], path: string) {
  if (new Set(values).size !== values.length) {
    throw new InvestigationOutputValidationError(`${path} contains duplicate IDs.`);
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
    throw new InvestigationOutputValidationError(
      `${path} references unknown evidence ID: ${invalidReference}.`,
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
    throw new InvestigationOutputValidationError(
      `${path}.sourceId is not grounded in this DiagnosticCase.`,
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
      throw new InvestigationOutputValidationError(
        `${path}.validationId is not available in this DiagnosticCase.`,
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
    throw new InvestigationOutputValidationError(
      "investigationResult.diagnosticCaseId does not match the requested case.",
    );
  }

  return result;
}
