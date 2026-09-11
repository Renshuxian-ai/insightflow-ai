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

const statusPresentation = {
  "ready-to-use": {
    label: "Ready to use",
    className: "bg-[#eaf8f0] text-[#27714b]",
  },
  "needs-review": {
    label: "Needs your review",
    className: "bg-[#fff6df] text-[#8a5b00]",
  },
  "meaning-unclear": {
    label: "Meaning unclear",
    className: "bg-[#fff0ef] text-[#a44848]",
  },
  "not-used": {
    label: "Not used",
    className: "bg-[#f1f3f7] text-[#657084]",
  },
} as const;

function formatPhysicalType(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
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

function getInferenceSourceLabel(
  source: SemanticFieldMapping["suggestion"] extends infer Suggestion
    ? Suggestion extends { inferenceSource: infer Source }
      ? Source
      : never
    : never,
): string {
  if (source === "ai") {
    return "AI suggestion";
  }

  if (source === "heuristic") {
    return "Deterministic heuristic";
  }

  return "Deterministic mock suggestion";
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
  physicalField,
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
  const presentation = statusPresentation[understanding.status];
  const hasReliableSuggestion = Boolean(
    suggestion && suggestion.semanticType !== SEMANTIC_TYPE_IDS.unknown,
  );
  const hasHumanDecision = mapping.resolution.status !== "suggested";
  const isHumanOverride = mapping.resolution.status === "edited";
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
            <p className="mt-1 text-xs text-[#8a94a6]">
              Detected type · {formatPhysicalType(physicalField.detectedType)}
              {understanding.isCritical ? " · Important for analysis" : ""}
            </p>
          </div>
          <span
            className={[
              "w-fit shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold",
              presentation.className,
            ].join(" ")}
          >
            {presentation.label}
          </span>
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
              Available schema information is insufficient to determine this
              field&apos;s business meaning.
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
              <>
                <p>{suggestion.explanation}</p>
                <p className="text-[#8a94a6]">
                  Source · {getInferenceSourceLabel(suggestion.inferenceSource)}
                </p>
              </>
            ) : (
              <p>No reliable field meaning was suggested.</p>
            )}

            {understanding.reasons.map((reason) => (
              <p key={reason}>{reason}</p>
            ))}

            {suggestion?.ambiguity ? (
              <p className="rounded-lg bg-[#fffaf0] px-3 py-2 text-[#765c25]">
                {suggestion.ambiguity}
              </p>
            ) : null}

            {suggestion && suggestion.alternatives.length > 0 ? (
              <div>
                <p className="font-semibold text-[#526078]">
                  Other possible meanings
                </p>
                <ul className="mt-1.5 space-y-1.5">
                  {suggestion.alternatives.map((alternative) => (
                    <li
                      key={
                        alternative.semanticRole +
                        "-" +
                        alternative.semanticType
                      }
                      className="rounded-md bg-[#f7f8fa] px-2.5 py-2"
                    >
                      {getSemanticTypeDefinition(alternative.semanticType).label}
                      {alternative.businessMeaning
                        ? " · " + alternative.businessMeaning
                        : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {understanding.conflicts.length > 0 ? (
              <div className="rounded-lg border border-[#f1dfb8] bg-[#fffaf0] px-3 py-2 text-[#765c25]">
                {understanding.conflicts.map((conflict) => (
                  <p key={conflict.id}>{conflict.message}</p>
                ))}
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

        {!readOnly && reviewMode === "none" ? (
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
                Use original suggestion again
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
