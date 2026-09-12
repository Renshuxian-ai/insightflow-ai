"use client";

import { useEffect, useMemo, useState } from "react";

import type { SemanticFieldUnderstanding } from "@/lib/datasets/semantic/auto-use-policy";
import {
  getSemanticTypeDefinition,
  SEMANTIC_TYPE_IDS,
  semanticTypeRegistry,
} from "@/lib/datasets/semantic/semantic-type-registry";
import type {
  SemanticFieldMapping,
  SemanticFieldReviewEvidence,
  SemanticMappingValue,
  SemanticType,
} from "@/lib/datasets/semantic/types";
import type { FieldProfile } from "@/lib/datasets/types";

type SemanticFieldReviewProps = {
  mapping: SemanticFieldMapping;
  physicalField: FieldProfile;
  understanding: SemanticFieldUnderstanding;
  evidence: SemanticFieldReviewEvidence | null;
  readOnly: boolean;
  onUseSuggestion: () => void;
  onEdit: (value: SemanticMappingValue) => void;
  onExclude: (reason: string) => void;
  onMarkUnresolved: () => void;
  onResetDecision: () => void;
  onDirtyChange: (isDirty: boolean) => void;
};

type ReviewMode = "none" | "edit";

type ClarificationCandidate = {
  id: string;
  label: string;
  value: SemanticMappingValue;
};

function capitalizeLabel(value: string): string {
  const trimmedValue = value.trim();

  return trimmedValue
    ? trimmedValue.charAt(0).toUpperCase() + trimmedValue.slice(1)
    : trimmedValue;
}

function getCompositeMeaningParts(value: string | null): string[] {
  if (!value) {
    return [];
  }

  const parts = value
    .split(/\s+(?:or|and\/or)\s+|\s*\/\s*/i)
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.length >= 2 && parts.length <= 4 ? parts : [];
}

function getClarificationCandidates(
  suggestion: NonNullable<SemanticFieldMapping["suggestion"]>,
): ClarificationCandidate[] {
  const candidates: ClarificationCandidate[] = [];
  const compositeMeaningParts = getCompositeMeaningParts(
    suggestion.businessMeaning,
  );

  if (suggestion.semanticType !== SEMANTIC_TYPE_IDS.unknown) {
    const definition = getSemanticTypeDefinition(suggestion.semanticType);

    if (compositeMeaningParts.length > 0) {
      candidates.push({
        id: `primary-${suggestion.semanticRole}-${suggestion.semanticType}`,
        label: definition.label,
        value: {
          semanticRole: suggestion.semanticRole,
          semanticType: suggestion.semanticType,
          businessMeaning: definition.label,
        },
      });

      for (const [index, part] of compositeMeaningParts.slice(1).entries()) {
        const label = capitalizeLabel(part);
        candidates.push({
          id: `meaning-${index}-${label.toLowerCase()}`,
          label,
          value: {
            semanticRole: suggestion.semanticRole,
            semanticType: suggestion.semanticType,
            businessMeaning: label,
          },
        });
      }
    } else {
      const label = suggestion.businessMeaning ?? definition.label;
      candidates.push({
        id: `primary-${suggestion.semanticRole}-${suggestion.semanticType}`,
        label,
        value: {
          semanticRole: suggestion.semanticRole,
          semanticType: suggestion.semanticType,
          businessMeaning: suggestion.businessMeaning,
        },
      });
    }
  }

  for (const [index, alternative] of suggestion.alternatives.entries()) {
    if (alternative.semanticType === SEMANTIC_TYPE_IDS.unknown) {
      continue;
    }

    candidates.push({
      id: `alternative-${index}-${alternative.semanticRole}-${alternative.semanticType}`,
      label:
        alternative.businessMeaning ??
        getSemanticTypeDefinition(alternative.semanticType).label,
      value: {
        semanticRole: alternative.semanticRole,
        semanticType: alternative.semanticType,
        businessMeaning: alternative.businessMeaning,
      },
    });
  }

  const uniqueCandidates = new Map<string, ClarificationCandidate>();

  for (const candidate of candidates) {
    const key = [
      candidate.value.semanticRole,
      candidate.value.semanticType,
      candidate.value.businessMeaning?.trim().toLowerCase() ?? "",
    ].join(":");

    if (!uniqueCandidates.has(key)) {
      uniqueCandidates.set(key, candidate);
    }
  }

  return [...uniqueCandidates.values()];
}

function getStatusPresentation(
  mapping: SemanticFieldMapping,
  understanding: SemanticFieldUnderstanding,
): { label: string; className: string } {
  if (mapping.resolution.status === "edited") {
    return {
      label: "Changed by you",
      className: "bg-[#edf1ff] text-[#5269bf]",
    };
  }

  if (mapping.resolution.status === "unresolved") {
    return {
      label: "Unresolved",
      className: "bg-[#fff6df] text-[#8a5b00]",
    };
  }

  if (
    mapping.resolution.status === "excluded" ||
    understanding.status === "not-used"
  ) {
    return {
      label: "Not used",
      className: "bg-[#f1f3f7] text-[#657084]",
    };
  }

  if (understanding.isBlocking) {
    return {
      label: "Required",
      className: "bg-[#fff0ef] text-[#a44848]",
    };
  }

  if (
    understanding.status === "needs-review" ||
    understanding.status === "meaning-unclear"
  ) {
    return {
      label: "Optional review",
      className: "bg-[#fff6df] text-[#8a5b00]",
    };
  }

  return {
    label: "Ready to use",
    className: "bg-[#eaf8f0] text-[#27714b]",
  };
}

function formatPercent(value: number): string {
  return (value * 100).toFixed(1) + "%";
}

function getEditableValue(
  mapping: SemanticFieldMapping,
  understanding: SemanticFieldUnderstanding,
): SemanticMappingValue {
  if (understanding.effectiveMapping) {
    return understanding.effectiveMapping;
  }

  if (mapping.suggestion) {
    return {
      semanticRole: mapping.suggestion.semanticRole,
      semanticType: mapping.suggestion.semanticType,
      businessMeaning: mapping.suggestion.businessMeaning,
    };
  }

  return {
    semanticRole: "unknown",
    semanticType: SEMANTIC_TYPE_IDS.unknown,
    businessMeaning: null,
  };
}

function getMeaningLabel(
  mapping: SemanticFieldMapping,
  understanding: SemanticFieldUnderstanding,
): string {
  if (understanding.status === "not-used") {
    return "This field will not be used";
  }

  if (understanding.status === "meaning-unclear") {
    return "Meaning unclear";
  }

  const value = understanding.effectiveMapping ?? mapping.suggestion;

  if (!value || value.semanticType === SEMANTIC_TYPE_IDS.unknown) {
    return "Meaning unclear";
  }

  return (
    value.businessMeaning ?? getSemanticTypeDefinition(value.semanticType).label
  );
}

function getAnalysisArea(
  suggestion: SemanticFieldMapping["suggestion"],
): string {
  switch (suggestion?.semanticRole) {
    case "time":
      return "time-based analysis";
    case "identifier":
      return "user or session analysis";
    case "measure":
    case "outcome":
      return "metric analysis";
    case "dimension":
    case "classification":
      return "segmentation and comparison";
    case "text":
      return "feedback analysis";
    default:
      return "future analysis";
  }
}

function getFieldSummary(
  mapping: SemanticFieldMapping,
  understanding: SemanticFieldUnderstanding,
  requiresClarification: boolean,
): string {
  const analysisArea = getAnalysisArea(mapping.suggestion);

  if (understanding.isBlocking) {
    return requiresClarification
      ? "This field may be used for " +
          analysisArea +
          ", but its exact meaning is unclear."
      : "This field may affect " +
          analysisArea +
          ", but it needs your input before it can be used safely.";
  }

  if (understanding.status === "meaning-unclear") {
    return "The available information does not point to one reliable field meaning.";
  }

  if (understanding.status === "needs-review") {
    return "The system found a possible meaning. You can review it if this field matters to your analysis.";
  }

  if (understanding.status === "not-used") {
    return "This field will not be used in future analysis.";
  }

  return "The system has enough evidence to use this field meaning.";
}

function getWhyInput(
  understanding: SemanticFieldUnderstanding,
  requiresClarification: boolean,
): string {
  if (requiresClarification) {
    return "The available data cannot reliably distinguish between the suggested meanings.";
  }

  if (understanding.conflicts.length > 0) {
    return "Another field may serve the same analytical purpose, so the intended field needs confirmation.";
  }

  if (understanding.status === "meaning-unclear") {
    return "The field name and available examples are not enough to determine a reliable meaning.";
  }

  return "The available evidence is not strong enough to use this meaning without your input.";
}

function SafeStatistics({
  evidence,
}: {
  evidence: SemanticFieldReviewEvidence;
}) {
  const statistics = evidence.safeStatistics;

  if (statistics.kind === "numeric") {
    return (
      <p>
        Numeric range · {statistics.min.toLocaleString()} to{" "}
        {statistics.max.toLocaleString()}
      </p>
    );
  }

  if (statistics.kind === "temporal") {
    return (
      <p>
        Observed range · {statistics.earliest} to {statistics.latest}
      </p>
    );
  }

  if (statistics.kind === "categorical" && statistics.topValues.length > 0) {
    return (
      <div>
        <p className="font-medium text-[#526078]">Top observed values</p>
        <ul className="mt-1.5 flex flex-wrap gap-1.5">
          {statistics.topValues.map(({ value, count }) => (
            <li
              key={String(value) + "-" + count}
              className="max-w-full truncate rounded-md bg-[#f1f3f7] px-2 py-1 font-mono text-[11px] text-[#526078]"
            >
              {String(value)} · {count.toLocaleString()}
            </li>
          ))}
        </ul>
        {statistics.valuesRedacted ? (
          <p className="mt-2 text-[#8a94a6]">
            Some values were hidden by the data protection policy.
          </p>
        ) : null}
      </div>
    );
  }

  return statistics.valuesRedacted ? (
    <p className="rounded-lg bg-[#f7f8fa] px-3 py-2 text-[#718099]">
      Detailed values are hidden by the data protection policy.
    </p>
  ) : null;
}

export function SemanticFieldReview({
  mapping,
  understanding,
  evidence,
  readOnly,
  onUseSuggestion,
  onEdit,
  onExclude,
  onMarkUnresolved,
  onResetDecision,
  onDirtyChange,
}: SemanticFieldReviewProps) {
  const initialValue = getEditableValue(mapping, understanding);
  const [reviewMode, setReviewMode] = useState<ReviewMode>("none");
  const [editType, setEditType] = useState<SemanticType>(
    initialValue.semanticType,
  );
  const [description, setDescription] = useState(
    initialValue.businessMeaning ?? "",
  );
  const suggestion = mapping.suggestion;
  const presentation = getStatusPresentation(mapping, understanding);
  const hasReliableSuggestion = Boolean(
    suggestion && suggestion.semanticType !== SEMANTIC_TYPE_IDS.unknown,
  );
  const hasHumanDecision = mapping.resolution.status !== "suggested";
  const isHumanOverride = mapping.resolution.status === "edited";
  const compositeMeaningParts = getCompositeMeaningParts(
    suggestion?.businessMeaning ?? null,
  );
  const requiresClarification = Boolean(
    understanding.isBlocking &&
      mapping.resolution.status === "suggested" &&
      suggestion &&
      (suggestion.ambiguity ||
        suggestion.alternatives.length > 0 ||
        compositeMeaningParts.length > 0),
  );
  const clarificationCandidates = suggestion
    ? getClarificationCandidates(suggestion)
    : [];
  const hasClarificationChoices =
    requiresClarification && clarificationCandidates.length >= 2;
  const fieldSummary = getFieldSummary(
    mapping,
    understanding,
    requiresClarification,
  );
  const availableMeanings = useMemo(
    () =>
      Object.values(semanticTypeRegistry).filter(
        (definition) => definition.id !== SEMANTIC_TYPE_IDS.unknown,
      ),
    [],
  );
  const isDirty =
    reviewMode === "edit" &&
    (editType !== initialValue.semanticType ||
      description !== (initialValue.businessMeaning ?? ""));
  const canSave =
    editType !== SEMANTIC_TYPE_IDS.unknown &&
    semanticTypeRegistry[editType] !== undefined;

  useEffect(() => {
    onDirtyChange(isDirty);

    return () => onDirtyChange(false);
  }, [isDirty, onDirtyChange]);

  function openEditor() {
    const value = getEditableValue(mapping, understanding);
    setEditType(value.semanticType);
    setDescription(value.businessMeaning ?? "");
    setReviewMode("edit");
  }

  function closeEditor() {
    setReviewMode("none");
    onDirtyChange(false);
  }

  function handleMeaningChange(nextType: SemanticType) {
    setEditType(nextType);

    if (
      nextType !== SEMANTIC_TYPE_IDS.unknown &&
      !description.trim()
    ) {
      setDescription(getSemanticTypeDefinition(nextType).description);
    }
  }

  function saveMeaning() {
    if (!canSave) {
      return;
    }

    const definition = getSemanticTypeDefinition(editType);
    onEdit({
      semanticRole: definition.role,
      semanticType: editType,
      businessMeaning: description.trim() || definition.label,
    });
    closeEditor();
  }

  return (
    <article className="overflow-hidden rounded-xl border border-[#e3e7ee] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
      <div className="border-b border-[#edf0f4] px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#8a94a6]">
              Original field
            </p>
            <h3 className="mt-1 break-all font-mono text-lg font-semibold text-[#202b3c]">
              {mapping.originalName}
            </h3>
            <p className="mt-1 max-w-xl text-xs leading-5 text-[#657084]">
              {fieldSummary}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-1.5">
            <span
              className={[
                "w-fit rounded-full px-2.5 py-1 text-xs font-semibold",
                presentation.className,
              ].join(" ")}
            >
              {presentation.label}
            </span>
            {understanding.isBlocking && presentation.label !== "Required" ? (
              <span className="w-fit rounded-full bg-[#fff0ef] px-2.5 py-1 text-xs font-semibold text-[#a44848]">
                Required
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="px-5 py-5 sm:px-6">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#8a94a6]">
            Field meaning
          </p>
          <p className="mt-1.5 text-lg font-semibold tracking-[-0.02em] text-[#263247]">
            {getMeaningLabel(mapping, understanding)}
          </p>
          {understanding.origin === "system-auto-use" ? (
            <p className="mt-1 text-xs leading-5 text-[#657084]">
              The system can use this meaning without another approval step.
            </p>
          ) : understanding.status === "meaning-unclear" ? (
            <p className="mt-1 max-w-xl text-xs leading-5 text-[#765c25]">
              The field name and available examples are not enough to determine
              a reliable meaning.
            </p>
          ) : null}
        </div>

        {isHumanOverride ? (
          <div className="mt-4 rounded-lg border border-[#dce3fb] bg-[#f7f9ff] px-3.5 py-3">
            <p className="text-xs font-semibold text-[#5269bf]">
              Your meaning is currently in use
            </p>
            <p className="mt-1 text-xs leading-5 text-[#657084]">
              The original system suggestion is preserved separately.
            </p>
          </div>
        ) : null}

        <details className="mt-5 border-t border-[#edf0f4] py-3">
          <summary className="cursor-pointer list-none text-xs font-semibold text-[#526078] marker:hidden">
            Why this suggestion? <span aria-hidden="true">⌄</span>
          </summary>
          <div className="mt-3 space-y-3 text-xs leading-5 text-[#657084]">
            {suggestion ? (
              <div>
                <p className="font-semibold text-[#526078]">
                  Why AI thinks this
                </p>
                <p className="mt-1">
                  The field name <code>{mapping.originalName}</code> and the
                  available examples suggest &ldquo;
                  {suggestion.businessMeaning ??
                    getSemanticTypeDefinition(suggestion.semanticType).label}
                  &rdquo;.
                </p>
              </div>
            ) : (
              <div>
                <p className="font-semibold text-[#526078]">
                  Why AI thinks this
                </p>
                <p className="mt-1">
                  The field name and available examples do not point to one
                  reliable business meaning.
                </p>
              </div>
            )}

            {understanding.isBlocking ? (
              <div>
                <p className="font-semibold text-[#526078]">
                  Why we need your input
                </p>
                <p className="mt-1">
                  {getWhyInput(understanding, requiresClarification)}
                </p>
              </div>
            ) : null}

            {understanding.isCritical || understanding.isBlocking ? (
              <div>
                <p className="font-semibold text-[#526078]">
                  Why it matters
                </p>
                <p className="mt-1">
                  Getting this field right affects {getAnalysisArea(suggestion)}.
                </p>
              </div>
            ) : null}
          </div>
        </details>

        <details className="border-t border-[#edf0f4] py-3">
          <summary className="cursor-pointer list-none text-xs font-semibold text-[#526078] marker:hidden">
            View data examples <span aria-hidden="true">⌄</span>
          </summary>
          <div className="mt-3 space-y-3 text-xs leading-5 text-[#657084]">
            {evidence ? (
              <>
                <div className="flex flex-wrap gap-x-5 gap-y-1">
                  <span>Null rate · {formatPercent(evidence.nullRate)}</span>
                  <span>
                    Distinct values ·{" "}
                    {evidence.isDistinctCountExact ? "" : "at least "}
                    {evidence.distinctCount.toLocaleString()}
                  </span>
                </div>

                {evidence.sanitizedSamples.length > 0 ? (
                  <ul className="flex flex-wrap gap-1.5">
                    {evidence.sanitizedSamples.map((sample, index) => (
                      <li
                        key={String(sample) + "-" + index}
                        className="max-w-full truncate rounded-md bg-[#f1f3f7] px-2 py-1 font-mono text-[11px] text-[#526078]"
                      >
                        {String(sample)}
                      </li>
                    ))}
                  </ul>
                ) : evidence.sampleSummary.policy ===
                  "redacted-sensitive-field" ? (
                  <p className="rounded-lg bg-[#f7f8fa] px-3 py-2 text-[#718099]">
                    Example values are hidden because this field may contain
                    identifiers, sensitive text, or high-cardinality values.
                  </p>
                ) : (
                  <p>No safe sample values are available.</p>
                )}

                <SafeStatistics evidence={evidence} />
              </>
            ) : (
              <p>Safe field examples are not available for this result.</p>
            )}
          </div>
        </details>

        {!readOnly && reviewMode === "none" && requiresClarification ? (
          <div className="mt-4 border-t border-[#edf0f4] pt-4">
            {hasClarificationChoices ? (
              <>
                <p className="text-sm font-semibold text-[#263247]">
                  What does <code>{mapping.originalName}</code> represent?
                </p>
                <div className="mt-3 grid gap-2 sm:max-w-xl">
                  {clarificationCandidates.map((candidate) => (
                    <button
                      key={candidate.id}
                      type="button"
                      onClick={() => onEdit(candidate.value)}
                      className="flex min-h-10 items-center rounded-lg border border-[#d8deea] bg-white px-3.5 py-2.5 text-left text-sm font-medium text-[#344056] transition-colors hover:border-[#8298ef] hover:bg-[#f7f9ff]"
                    >
                      <span
                        aria-hidden="true"
                        className="mr-2.5 h-3.5 w-3.5 shrink-0 rounded-full border border-[#aab4c5]"
                      />
                      {candidate.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={openEditor}
                    className="flex min-h-10 items-center rounded-lg border border-[#d8deea] bg-white px-3.5 py-2.5 text-left text-sm font-medium text-[#526078] transition-colors hover:border-[#8298ef] hover:bg-[#f7f9ff] hover:text-[#263247]"
                  >
                    <span
                      aria-hidden="true"
                      className="mr-2.5 h-3.5 w-3.5 shrink-0 rounded-full border border-[#aab4c5]"
                    />
                    Something else
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-[#263247]">
                  This required field needs a clearer meaning.
                </p>
                <button
                  type="button"
                  onClick={openEditor}
                  className="mt-3 rounded-lg bg-[#3559e8] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#2949ca]"
                >
                  Define meaning
                </button>
              </>
            )}

            <details className="relative mt-3 w-fit">
              <summary className="cursor-pointer list-none px-2 py-2 text-xs font-semibold text-[#7e8798] marker:hidden hover:text-[#263247]">
                More actions
              </summary>
              <div className="absolute left-0 z-10 mt-1 w-48 rounded-lg border border-[#dfe4ec] bg-white p-1.5 shadow-lg">
                <button
                  type="button"
                  onClick={onMarkUnresolved}
                  className="w-full rounded-md px-2.5 py-2 text-left text-xs font-medium text-[#526078] hover:bg-[#f6f7f9]"
                >
                  I&apos;m not sure yet
                </button>
                <button
                  type="button"
                  onClick={() => onExclude("")}
                  className="w-full rounded-md px-2.5 py-2 text-left text-xs font-medium text-[#526078] hover:bg-[#f6f7f9]"
                >
                  Don&apos;t use this field
                </button>
              </div>
            </details>
          </div>
        ) : null}

        {!readOnly && reviewMode === "none" && !requiresClarification ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#edf0f4] pt-4">
            {understanding.status === "needs-review" &&
            hasReliableSuggestion ? (
              <button
                type="button"
                onClick={onUseSuggestion}
                className="rounded-lg bg-[#3559e8] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#2949ca]"
              >
                Use this meaning
              </button>
            ) : null}

            <button
              type="button"
              onClick={openEditor}
              className={
                understanding.status === "meaning-unclear"
                  ? "rounded-lg bg-[#3559e8] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#2949ca]"
                  : "rounded-lg border border-[#d8deea] bg-white px-3.5 py-2 text-xs font-semibold text-[#526078] transition-colors hover:border-[#b9c4d8] hover:text-[#263247]"
              }
            >
              {understanding.status === "meaning-unclear"
                ? "Define meaning"
                : "Change meaning"}
            </button>

            {understanding.status === "meaning-unclear" &&
            mapping.resolution.status !== "unresolved" ? (
              <button
                type="button"
                onClick={onMarkUnresolved}
                className="px-2 py-2 text-xs font-semibold text-[#657084] hover:text-[#263247]"
              >
                I&apos;m not sure yet
              </button>
            ) : null}

            {understanding.status !== "ready-to-use" ? (
              <details className="relative ml-auto">
                <summary className="cursor-pointer list-none px-2 py-2 text-xs font-semibold text-[#7e8798] marker:hidden hover:text-[#263247]">
                  More actions
                </summary>
                <div className="absolute right-0 z-10 mt-1 w-48 rounded-lg border border-[#dfe4ec] bg-white p-1.5 shadow-lg">
                  {understanding.status !== "meaning-unclear" ? (
                    <button
                      type="button"
                      onClick={onMarkUnresolved}
                      className="w-full rounded-md px-2.5 py-2 text-left text-xs font-medium text-[#526078] hover:bg-[#f6f7f9]"
                    >
                      I&apos;m not sure yet
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => onExclude("")}
                    className="w-full rounded-md px-2.5 py-2 text-left text-xs font-medium text-[#526078] hover:bg-[#f6f7f9]"
                  >
                    Don&apos;t use this field
                  </button>
                </div>
              </details>
            ) : null}

            {hasHumanDecision && hasReliableSuggestion ? (
              <button
                type="button"
                onClick={onResetDecision}
                className="w-full pt-1 text-left text-xs font-medium text-[#7e8798] underline-offset-4 hover:text-[#526078] hover:underline"
              >
                Undo my change
              </button>
            ) : null}
          </div>
        ) : null}

        {!readOnly && reviewMode === "edit" ? (
          <div className="mt-4 rounded-xl border border-[#dce3fb] bg-[#fafbff] p-4">
            <label className="block text-xs font-semibold text-[#344056]">
              What does this field mean?
              <span className="mt-3 block font-medium text-[#526078]">
                Meaning
              </span>
              <select
                value={editType}
                onChange={(event) =>
                  handleMeaningChange(event.target.value as SemanticType)
                }
                className="mt-1.5 h-10 w-full rounded-lg border border-[#dfe4ec] bg-white px-3 text-sm font-normal text-[#263247] outline-none focus:border-[#8298ef] focus:ring-2 focus:ring-[#3559e8]/10"
              >
                <option value={SEMANTIC_TYPE_IDS.unknown}>
                  Choose a field meaning
                </option>
                {availableMeanings.map((definition) => (
                  <option key={definition.id} value={definition.id}>
                    {definition.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="mt-4 block text-xs font-semibold text-[#344056]">
              Description
              <input
                value={description}
                maxLength={160}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Describe what this field represents in the product."
                className="mt-1.5 h-10 w-full rounded-lg border border-[#dfe4ec] bg-white px-3 text-sm font-normal text-[#263247] outline-none placeholder:text-[#a1a9b7] focus:border-[#8298ef] focus:ring-2 focus:ring-[#3559e8]/10"
              />
            </label>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={!canSave}
                onClick={saveMeaning}
                className="rounded-lg bg-[#3559e8] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#2949ca] disabled:cursor-not-allowed disabled:bg-[#b7c0d6]"
              >
                Save meaning
              </button>
              <button
                type="button"
                onClick={closeEditor}
                className="rounded-lg border border-[#d8deea] bg-white px-3.5 py-2 text-xs font-semibold text-[#526078]"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </article>
  );
}
