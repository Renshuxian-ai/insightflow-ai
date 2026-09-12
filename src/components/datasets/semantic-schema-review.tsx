"use client";

import { useMemo, useState, type ReactNode } from "react";

import {
  getSemanticSchemaUnderstandings,
  isPolicyForPhysicalSchema,
} from "@/lib/datasets/semantic/auto-use-policy";
import {
  applySemanticFieldResolution,
  canConfirmSemanticSchema,
  confirmSemanticSchema,
  createAcceptedResolution,
  createEditedResolution,
  createExcludedResolution,
  createUnresolvedResolution,
  resetSemanticFieldResolution,
} from "@/lib/datasets/semantic/review-state";
import { getSemanticTypeDefinition } from "@/lib/datasets/semantic/semantic-type-registry";
import type {
  SemanticAutoUsePolicyResult,
  SemanticConflict,
  SemanticFieldMapping,
  SemanticFieldReviewEvidence,
  SemanticMappingValue,
  SemanticSchema,
} from "@/lib/datasets/semantic/types";
import type { DatasetSchema } from "@/lib/datasets/types";

import {
  SemanticReviewWorkspace,
  type SemanticReviewFilter,
} from "./semantic-review-workspace";

export type SemanticReviewStatus =
  | "idle"
  | "generating"
  | "ready"
  | "empty"
  | "error";

type SemanticSchemaReviewProps = {
  physicalSchema: DatasetSchema;
  semanticSchema: SemanticSchema | null;
  autoUsePolicy: SemanticAutoUsePolicyResult | null;
  fieldEvidence: SemanticFieldReviewEvidence[];
  status: SemanticReviewStatus;
  error: string | null;
  sessionMessage: string | null;
  datasetContext: string;
  onDatasetContextChange: (value: string) => void;
  onRetry: () => void;
  onRegenerate: (datasetContext: string) => void;
  onSchemaChange: (schema: SemanticSchema) => void;
};

function isSchemaCurrent(
  semanticSchema: SemanticSchema,
  physicalSchema: DatasetSchema,
): boolean {
  return (
    semanticSchema.physicalSchema.datasetId === physicalSchema.datasetId &&
    semanticSchema.physicalSchema.physicalSchemaVersion ===
      physicalSchema.version &&
    semanticSchema.physicalSchema.schemaFingerprint ===
      physicalSchema.schemaFingerprint &&
    semanticSchema.physicalSchema.selectedSheetName ===
      physicalSchema.selectedSheetName
  );
}

function getMeaning(field: SemanticFieldMapping): string {
  if (
    field.resolution.status === "accepted" ||
    field.resolution.status === "edited"
  ) {
    return (
      field.resolution.value.businessMeaning ??
      getSemanticTypeDefinition(field.resolution.value.semanticType).label
    );
  }

  if (field.suggestion && field.suggestion.semanticType !== "unknown") {
    return (
      field.suggestion.businessMeaning ??
      getSemanticTypeDefinition(field.suggestion.semanticType).label
    );
  }

  return "Meaning unclear";
}

export function SemanticSchemaReview({
  physicalSchema,
  semanticSchema,
  autoUsePolicy,
  fieldEvidence,
  status,
  error,
  sessionMessage,
  datasetContext,
  onDatasetContextChange,
  onRetry,
  onRegenerate,
  onSchemaChange,
}: SemanticSchemaReviewProps) {
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isReviewExpanded, setIsReviewExpanded] = useState(false);
  const [activeFieldKey, setActiveFieldKey] = useState<string | null>(null);
  const [controllerError, setControllerError] = useState<string | null>(null);
  const [isContextEditorOpen, setIsContextEditorOpen] = useState(false);
  const [contextDraft, setContextDraft] = useState(datasetContext);
  const [isConfirmSummaryOpen, setIsConfirmSummaryOpen] = useState(false);
  const [reviewFilter, setReviewFilter] =
    useState<SemanticReviewFilter>("required");

  const shell = (content: ReactNode) => (
    <section
      aria-labelledby="field-understanding-title"
      className="overflow-hidden rounded-2xl border border-[#dce3fb] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.03)]"
    >
      <div className="border-b border-[#e8ecf6] bg-[#fbfcff] px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#6072b8]">
              Data Understanding
            </p>
            <h2
              id="field-understanding-title"
              className="mt-1 text-base font-semibold text-[#172033]"
            >
              Field Understanding
            </h2>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-[#6f798b]">
              The system prepares reliable field meanings and asks for help only
              when the available evidence is not clear enough.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-md bg-[#edf1ff] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em] text-[#5269bf]">
              Mock understanding
            </span>
            <span className="rounded-md bg-[#f1f3f7] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em] text-[#778196]">
              Session only
            </span>
          </div>
        </div>
      </div>

      {sessionMessage ? (
        <p
          className="mx-5 mt-4 rounded-lg border border-[#dce3fb] bg-[#f7f9ff] px-3.5 py-2.5 text-xs leading-5 text-[#60708a] sm:mx-6"
          role="status"
        >
          {sessionMessage}
        </p>
      ) : null}

      {content}
    </section>
  );

  const policyReference = {
    datasetId: physicalSchema.datasetId,
    physicalSchemaVersion: physicalSchema.version,
    schemaFingerprint: physicalSchema.schemaFingerprint,
    selectedSheetName: physicalSchema.selectedSheetName,
  };
  const isCurrent =
    semanticSchema &&
    autoUsePolicy &&
    isSchemaCurrent(semanticSchema, physicalSchema) &&
    isPolicyForPhysicalSchema(autoUsePolicy, policyReference);
  const understandings = useMemo(
    () =>
      isCurrent
        ? getSemanticSchemaUnderstandings(semanticSchema, autoUsePolicy)
        : new Map(),
    [autoUsePolicy, isCurrent, semanticSchema],
  );
  const isRefreshing = status === "generating" && Boolean(isCurrent);

  if (status === "idle" || (status === "generating" && !isRefreshing)) {
    return shell(
      <div className="px-5 py-8 sm:px-6" aria-live="polite">
        <div className="flex items-center gap-3">
          {status === "generating" ? (
            <span
              aria-hidden="true"
              className="size-4 animate-spin rounded-full border-2 border-[#d7ddeb] border-t-[#3559e8]"
            />
          ) : null}
          <div>
            <p className="text-sm font-semibold text-[#344056]">
              {status === "generating"
                ? "Understanding field meanings..."
                : "Field understanding will start after profiling."}
            </p>
            <p className="mt-1 text-xs leading-5 text-[#7e8798]">
              {status === "generating"
                ? "The current physical profile is being checked against the auto-use policy."
                : "No field understanding is available yet."}
            </p>
          </div>
        </div>
      </div>,
    );
  }

  if (status === "error") {
    return shell(
      <div className="px-5 py-7 sm:px-6">
        <div
          className="rounded-xl border border-[#f3d6d6] bg-[#fff7f7] p-4"
          role="alert"
        >
          <p className="text-sm font-semibold text-[#a53d3d]">
            Field understanding could not be prepared
          </p>
          <p className="mt-1 text-xs leading-5 text-[#8b5a5a]">
            {error ?? "Please try again with the current data structure."}
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 rounded-lg border border-[#e2bbbb] bg-white px-3 py-2 text-xs font-semibold text-[#914747] hover:border-[#cf9f9f]"
          >
            Try again
          </button>
        </div>
      </div>,
    );
  }

  if (status === "empty") {
    return shell(
      <div className="px-5 py-8 text-center sm:px-6">
        <p className="text-sm font-semibold text-[#344056]">
          No fields to understand
        </p>
        <p className="mt-1 text-xs leading-5 text-[#7e8798]">
          The current data structure does not contain analyzable fields.
        </p>
      </div>,
    );
  }

  if (!semanticSchema || !autoUsePolicy || !isCurrent) {
    return shell(
      <div className="px-5 py-7 sm:px-6">
        <div
          className="rounded-xl border border-[#f1dfb8] bg-[#fffaf0] p-4"
          role="alert"
        >
          <p className="text-sm font-semibold text-[#765c25]">
            Field understanding does not match this data structure
          </p>
          <p className="mt-1 text-xs leading-5 text-[#8a7445]">
            Prepare a new result before reviewing field meanings.
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 rounded-lg border border-[#e5d4ad] bg-white px-3 py-2 text-xs font-semibold text-[#765c25]"
          >
            Prepare current fields
          </button>
        </div>
      </div>,
    );
  }

  const currentSemanticSchema = semanticSchema;
  const currentAutoUsePolicy = autoUsePolicy;

  const readyFields = currentSemanticSchema.fields.filter(
    (field) =>
      understandings.get(field.stableFieldKey)?.status === "ready-to-use",
  );
  const needsReviewFields = currentSemanticSchema.fields.filter(
    (field) =>
      understandings.get(field.stableFieldKey)?.status === "needs-review",
  );
  const meaningUnclearFields = currentSemanticSchema.fields.filter(
    (field) =>
      understandings.get(field.stableFieldKey)?.status === "meaning-unclear",
  );
  const notUsedFields = currentSemanticSchema.fields.filter(
    (field) =>
      understandings.get(field.stableFieldKey)?.status === "not-used",
  );
  const changedFields = currentSemanticSchema.fields.filter(
    (field) => field.resolution.status === "edited",
  );
  const unresolvedFields = currentSemanticSchema.fields.filter(
    (field) => field.resolution.status === "unresolved",
  );
  const excludedFields = currentSemanticSchema.fields.filter(
    (field) => field.resolution.status === "excluded",
  );
  const summaryReadyFields = readyFields.filter(
    (field) => field.resolution.status !== "edited",
  );
  const conflicts = [
    ...new Map<string, SemanticConflict>(
      currentSemanticSchema.fields.flatMap((field) =>
        (understandings.get(field.stableFieldKey)?.conflicts ?? []).map(
          (conflict: SemanticConflict) => [conflict.id, conflict] as const,
        ),
      ),
    ).values(),
  ];
  const reviewFields = [...needsReviewFields, ...meaningUnclearFields]
    .sort((left, right) => {
      const leftBlocking =
        understandings.get(left.stableFieldKey)?.isBlocking ?? false;
      const rightBlocking =
        understandings.get(right.stableFieldKey)?.isBlocking ?? false;

      return Number(rightBlocking) - Number(leftBlocking) ||
        left.fieldIndex - right.fieldIndex;
    });
  const blockingFields = currentSemanticSchema.fields.filter(
    (field) => understandings.get(field.stableFieldKey)?.isBlocking,
  );
  const optionalReviewFields = reviewFields.filter(
    (field) => !understandings.get(field.stableFieldKey)?.isBlocking,
  );
  const contextHelpfulFieldCount = currentSemanticSchema.fields.filter(
    (field) => {
      const understanding = understandings.get(field.stableFieldKey);

      return (
        field.resolution.status === "suggested" &&
        (understanding?.status === "needs-review" ||
          understanding?.status === "meaning-unclear")
      );
    },
  ).length;
  const canConfirm = canConfirmSemanticSchema(
    currentSemanticSchema,
    currentAutoUsePolicy,
  );
  const readOnly = currentSemanticSchema.status === "confirmed";
  const savedContext = datasetContext.trim();
  const normalizedContextDraft = contextDraft.trim();
  const canSaveContext =
    !isRefreshing && normalizedContextDraft !== savedContext;

  function openContextEditor() {
    setContextDraft(datasetContext);
    setIsContextEditorOpen(true);
  }

  function cancelContextEditor() {
    setContextDraft(datasetContext);
    setIsContextEditorOpen(false);
  }

  function saveContext() {
    if (!canSaveContext) {
      return;
    }

    onDatasetContextChange(normalizedContextDraft);
    onRegenerate(normalizedContextDraft);
    setIsContextEditorOpen(false);
  }

  function openReview(
    fieldKey?: string,
    filter: SemanticReviewFilter = "all",
  ) {
    setReviewFilter(filter);
    setActiveFieldKey(
      fieldKey ??
        reviewFields[0]?.stableFieldKey ??
        currentSemanticSchema.fields[0]?.stableFieldKey ??
        null,
    );
    setIsReviewOpen(true);
    setControllerError(null);
  }

  function updateField(
    field: SemanticFieldMapping,
    createResolution: () => SemanticFieldMapping["resolution"],
  ) {
    if (readOnly) {
      return;
    }

    try {
      onSchemaChange(
        applySemanticFieldResolution(
          currentSemanticSchema,
          field.stableFieldKey,
          createResolution(),
        ),
      );
      setControllerError(null);
    } catch (caughtError) {
      setControllerError(
        caughtError instanceof Error
          ? caughtError.message
          : "The field decision could not be saved.",
      );
    }
  }

  function handleResetDecision(field: SemanticFieldMapping) {
    if (readOnly) {
      return;
    }

    try {
      onSchemaChange(
        resetSemanticFieldResolution(
          currentSemanticSchema,
          field.stableFieldKey,
        ),
      );
      setControllerError(null);
    } catch (caughtError) {
      setControllerError(
        caughtError instanceof Error
          ? caughtError.message
          : "The field decision could not be restored.",
      );
    }
  }

  function handleConfirm() {
    if (!canConfirm || readOnly) {
      return;
    }

    try {
      onSchemaChange(
        confirmSemanticSchema(currentSemanticSchema, currentAutoUsePolicy),
      );
      setIsConfirmSummaryOpen(false);
      setIsReviewOpen(false);
      setIsReviewExpanded(false);
      setControllerError(null);
    } catch (caughtError) {
      setControllerError(
        caughtError instanceof Error
          ? caughtError.message
          : "Field understanding could not be confirmed.",
      );
    }
  }

  const content = (
    <div className="px-5 py-5 sm:px-6 sm:py-6">
      {readOnly ? (
        <div className="rounded-xl border border-[#cde8d8] bg-[#f4fbf7] p-5">
          <p className="text-base font-semibold text-[#246444]">
            Field understanding confirmed
          </p>
          <p className="mt-1 text-sm leading-6 text-[#557564]">
            Your dataset is ready.
          </p>
          <p className="mt-2 text-xs text-[#718479]">
            {readyFields.length.toLocaleString()} usable field meanings ·{" "}
            {meaningUnclearFields.length.toLocaleString()} left unsure ·{" "}
            {notUsedFields.length.toLocaleString()} not used
          </p>
          <button
            type="button"
            onClick={() => openReview(readyFields[0]?.stableFieldKey, "all")}
            className="mt-4 text-xs font-semibold text-[#526078] underline-offset-4 hover:text-[#263247] hover:underline"
          >
            View field meanings
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xl font-semibold tracking-[-0.025em] text-[#202b3c]">
                {currentSemanticSchema.fields.length.toLocaleString()} fields analyzed
              </p>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                <span className="font-medium text-[#27714b]">
                  {readyFields.length.toLocaleString()} ready to use
                </span>
                <span className="font-medium text-[#8a5b00]">
                  {needsReviewFields.length.toLocaleString()} need review
                </span>
                {meaningUnclearFields.length > 0 ? (
                  <span className="text-[#7e8798]">
                    {meaningUnclearFields.length.toLocaleString()} meaning unclear
                  </span>
                ) : null}
                {notUsedFields.length > 0 ? (
                  <span className="text-[#7e8798]">
                    {notUsedFields.length.toLocaleString()} not used
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col items-start gap-2 lg:items-end">
              {blockingFields.length > 0 ? (
                <>
                  <p className="text-sm font-semibold text-[#8a5b00]">
                    {blockingFields.length.toLocaleString()}
                    {blockingFields.length === 1
                      ? " required field needs your input"
                      : " required fields need your input"}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      openReview(blockingFields[0]?.stableFieldKey, "required")
                    }
                    className="min-h-11 w-fit rounded-lg bg-[#3559e8] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#2949ca] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3559e8]"
                  >
                    {blockingFields.length === 1
                      ? "Review required field"
                      : "Review required fields"}
                  </button>
                </>
              ) : (
                <p className="text-sm font-semibold text-[#27714b]">
                  Ready to confirm
                </p>
              )}

              {optionalReviewFields.length > 0 ? (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#7e8798] lg:justify-end">
                  <span>
                    {optionalReviewFields.length.toLocaleString()}
                    {blockingFields.length > 0
                      ? " other uncertain "
                      : " uncertain "}
                    {optionalReviewFields.length === 1 ? "field" : "fields"}
                    {blockingFields.length === 0
                      ? " can be reviewed later"
                      : ""}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      openReview(optionalReviewFields[0]?.stableFieldKey, "optional")
                    }
                    className="font-semibold text-[#6072b8] underline-offset-4 hover:text-[#3559e8] hover:underline"
                  >
                    Review optional fields
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-5 border-t border-[#edf0f4] pt-4">
            {isRefreshing ? (
              <div
                className="flex items-center gap-2 rounded-lg bg-[#f7f9ff] px-3 py-2.5 text-xs font-medium text-[#6072b8]"
                aria-live="polite"
              >
                <span
                  aria-hidden="true"
                  className="size-3.5 animate-spin rounded-full border-2 border-[#d7ddeb] border-t-[#5269bf]"
                />
                Updating field understanding…
              </div>
            ) : isContextEditorOpen ? (
              <div className="max-w-2xl rounded-xl border border-[#dfe4ec] bg-[#fafbfc] p-4">
                <label className="block text-sm font-semibold text-[#344056]">
                  What does this dataset represent?
                  <textarea
                    value={contextDraft}
                    maxLength={600}
                    rows={3}
                    onChange={(event) => setContextDraft(event.target.value)}
                    placeholder="Each row represents a user signup. The dataset tracks onboarding, retention and conversion for our mobile app."
                    className="mt-2 w-full resize-y rounded-lg border border-[#dfe4ec] bg-white px-3 py-2.5 text-sm font-normal leading-5 text-[#263247] outline-none placeholder:text-[#a1a9b7] focus:border-[#8298ef] focus:ring-2 focus:ring-[#3559e8]/10"
                  />
                </label>
                <p className="mt-1 text-xs text-[#8a94a6]">
                  Optional. A short description is enough.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!canSaveContext}
                    onClick={saveContext}
                    className="rounded-lg bg-[#3559e8] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#2949ca] disabled:cursor-not-allowed disabled:bg-[#b7c0d6]"
                  >
                    Save context and refresh suggestions
                  </button>
                  <button
                    type="button"
                    onClick={cancelContextEditor}
                    className="rounded-lg border border-[#d8deea] bg-white px-3.5 py-2 text-xs font-semibold text-[#526078]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-start gap-1.5">
                <button
                  type="button"
                  onClick={openContextEditor}
                  className="text-xs font-semibold text-[#6072b8] underline-offset-4 hover:text-[#3559e8] hover:underline"
                >
                  {savedContext
                    ? "Edit dataset context"
                    : "Help AI understand this dataset"}
                </button>
                {savedContext ? (
                  <p className="max-w-2xl truncate text-xs text-[#8a94a6]">
                    {savedContext}
                  </p>
                ) : contextHelpfulFieldCount >= 2 ? (
                  <p className="text-xs leading-5 text-[#8a7445]">
                    Adding a short description may help resolve ambiguous fields.
                  </p>
                ) : (
                  <p className="text-xs text-[#8a94a6]">
                    Optional context can improve ambiguous field suggestions.
                  </p>
                )}
              </div>
            )}
          </div>

          {readyFields.length > 0 ? (
            <details className="mt-5 rounded-xl border border-[#e4e7ee] bg-[#fafbfc]">
              <summary className="cursor-pointer list-none px-4 py-3.5 text-sm font-semibold text-[#465268] marker:hidden">
                <span className="flex items-center justify-between gap-4">
                  <span>View understood fields</span>
                  <span className="text-xs font-medium text-[#8a94a6]">
                    {readyFields.length.toLocaleString()} ready to use
                  </span>
                </span>
              </summary>
              <div className="max-h-64 overflow-y-auto border-t border-[#e4e7ee]">
                {readyFields.map((field) => (
                  <div
                    key={field.stableFieldKey}
                    className="flex items-center justify-between gap-4 border-b border-[#edf0f4] px-4 py-3 last:border-b-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs font-semibold text-[#344056]">
                        {field.originalName}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-[#7e8798]">
                        {getMeaning(field)}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-[#eaf8f0] px-2 py-1 text-[10px] font-semibold text-[#27714b]">
                      Ready to use
                    </span>
                  </div>
                ))}
              </div>
            </details>
          ) : null}

          {controllerError ? (
            <p
              className="mt-4 rounded-lg border border-[#f3d6d6] bg-[#fff7f7] px-3 py-2 text-xs text-[#a53d3d]"
              role="alert"
            >
              {controllerError}
            </p>
          ) : null}

          <div className="sticky bottom-4 z-20 mt-5 flex flex-col gap-3 rounded-xl border border-[#d9dfeb] bg-white/95 px-4 py-3 shadow-[0_8px_28px_rgba(23,32,51,0.12)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#344056]">
                {canConfirm
                  ? "Ready to confirm"
                  : blockingFields.length +
                    (blockingFields.length === 1
                      ? " required field must be reviewed before confirmation"
                      : " required fields must be reviewed before confirmation")}
              </p>
              {!canConfirm && blockingFields[0] ? (
                <button
                  type="button"
                  onClick={() =>
                    openReview(blockingFields[0].stableFieldKey, "required")
                  }
                  className="mt-0.5 text-xs font-medium text-[#6072b8] hover:text-[#3559e8]"
                >
                  Review {blockingFields[0].originalName}
                </button>
              ) : (
                <p className="mt-0.5 text-xs text-[#7e8798]">
                  Ready-to-use fields do not require individual approval.
                </p>
              )}
            </div>
            <button
              type="button"
              disabled={!canConfirm}
              onClick={() => {
                if (canConfirm) {
                  setIsConfirmSummaryOpen(true);
                }
              }}
              className="min-h-10 shrink-0 rounded-lg bg-[#3559e8] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2949ca] disabled:cursor-not-allowed disabled:bg-[#b7c0d6]"
            >
              Confirm field understanding
            </button>
          </div>
        </>
      )}
    </div>
  );

  return (
    <>
      {shell(content)}
      {isConfirmSummaryOpen && canConfirm && !readOnly ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[#172033]/35 p-4 backdrop-blur-[1px]"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsConfirmSummaryOpen(false);
            }
          }}
        >
          <section
            aria-labelledby="confirm-field-understanding-title"
            aria-modal="true"
            role="dialog"
            className="flex max-h-[min(80vh,720px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#dfe4ec] bg-white shadow-[0_24px_70px_rgba(23,32,51,0.22)]"
          >
            <div className="border-b border-[#edf0f4] px-5 py-4 sm:px-6">
              <h3
                id="confirm-field-understanding-title"
                className="text-base font-semibold text-[#202b3c]"
              >
                Confirm field understanding
              </h3>
              <p className="mt-1 text-sm leading-5 text-[#6f798b]">
                Review the exceptions below before confirming. Fields not shown
                here are ready to use.
              </p>
            </div>

            <div className="space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
              {changedFields.length > 0 ? (
                <section aria-labelledby="changed-fields-title">
                  <h4
                    id="changed-fields-title"
                    className="text-xs font-bold uppercase tracking-[0.08em] text-[#6072b8]"
                  >
                    Changed by you
                  </h4>
                  <div className="mt-2 divide-y divide-[#edf0f4] rounded-xl border border-[#e3e7ee]">
                    {changedFields.map((field) => (
                      <div
                        key={field.stableFieldKey}
                        className="grid gap-1 px-3.5 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center sm:gap-3"
                      >
                        <span className="truncate font-mono text-xs font-semibold text-[#526078]">
                          {field.originalName}
                        </span>
                        <span
                          aria-hidden="true"
                          className="hidden text-[#a1a9b7] sm:inline"
                        >
                          →
                        </span>
                        <span className="text-[#263247]">
                          {getMeaning(field)}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {unresolvedFields.length > 0 ? (
                <section aria-labelledby="unresolved-fields-title">
                  <h4
                    id="unresolved-fields-title"
                    className="text-xs font-bold uppercase tracking-[0.08em] text-[#8a5b00]"
                  >
                    Still unclear
                  </h4>
                  <p className="mt-1 text-xs leading-5 text-[#765c25]">
                    These fields will remain unused until their meaning is
                    clarified.
                  </p>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {unresolvedFields.map((field) => (
                      <li
                        key={field.stableFieldKey}
                        className="rounded-md bg-[#fff6df] px-2.5 py-1.5 font-mono text-xs font-semibold text-[#765c25]"
                      >
                        {field.originalName}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {excludedFields.length > 0 ? (
                <section aria-labelledby="excluded-fields-title">
                  <h4
                    id="excluded-fields-title"
                    className="text-xs font-bold uppercase tracking-[0.08em] text-[#657084]"
                  >
                    Not used
                  </h4>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {excludedFields.map((field) => (
                      <li
                        key={field.stableFieldKey}
                        className="rounded-md bg-[#f1f3f7] px-2.5 py-1.5 font-mono text-xs font-semibold text-[#657084]"
                      >
                        {field.originalName}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {conflicts.length > 0 ? (
                <section aria-labelledby="field-conflicts-title">
                  <h4
                    id="field-conflicts-title"
                    className="text-xs font-bold uppercase tracking-[0.08em] text-[#8a5b00]"
                  >
                    Conflicts
                  </h4>
                  <ul className="mt-2 space-y-2">
                    {conflicts.map((conflict) => (
                      <li
                        key={conflict.id}
                        className="rounded-lg border border-[#f1dfb8] bg-[#fffaf0] px-3 py-2 text-xs leading-5 text-[#765c25]"
                      >
                        {conflict.message}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <details className="rounded-xl border border-[#e4e7ee] bg-[#fafbfc]">
                <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-[#526078] marker:hidden">
                  <span className="flex items-center justify-between gap-4">
                    <span>
                      {summaryReadyFields.length.toLocaleString()} fields ready
                      to use
                    </span>
                    <span className="text-xs font-medium text-[#8a94a6]">
                      View all ready fields
                    </span>
                  </span>
                </summary>
                {summaryReadyFields.length > 0 ? (
                  <div className="max-h-56 overflow-y-auto border-t border-[#e4e7ee]">
                    {summaryReadyFields.map((field) => (
                      <div
                        key={field.stableFieldKey}
                        className="grid gap-1 border-b border-[#edf0f4] px-4 py-2.5 text-xs last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center sm:gap-3"
                      >
                        <span className="truncate font-mono font-semibold text-[#526078]">
                          {field.originalName}
                        </span>
                        <span
                          aria-hidden="true"
                          className="hidden text-[#a1a9b7] sm:inline"
                        >
                          →
                        </span>
                        <span className="truncate text-[#657084]">
                          {getMeaning(field)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </details>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-[#edf0f4] bg-[#fafbfc] px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
              <button
                type="button"
                onClick={() => setIsConfirmSummaryOpen(false)}
                className="rounded-lg border border-[#d8deea] bg-white px-4 py-2.5 text-sm font-semibold text-[#526078]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!canConfirm}
                onClick={handleConfirm}
                className="rounded-lg bg-[#3559e8] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#2949ca] disabled:cursor-not-allowed disabled:bg-[#b7c0d6]"
              >
                Confirm field understanding
              </button>
            </div>
          </section>
        </div>
      ) : null}
      <SemanticReviewWorkspace
        isOpen={isReviewOpen}
        isExpanded={isReviewExpanded}
        onExpandedChange={setIsReviewExpanded}
        onRequestClose={() => {
          setIsReviewOpen(false);
          setIsReviewExpanded(false);
        }}
        schema={currentSemanticSchema}
        physicalSchema={physicalSchema}
        autoUsePolicy={autoUsePolicy}
        fieldEvidence={fieldEvidence}
        activeFilter={reviewFilter}
        onActiveFilterChange={setReviewFilter}
        activeFieldKey={activeFieldKey}
        onActiveFieldChange={setActiveFieldKey}
        onUseSuggestion={(field) =>
          updateField(field, () => createAcceptedResolution(field))
        }
        onEdit={(field, value: SemanticMappingValue) =>
          updateField(field, () => createEditedResolution(field, value))
        }
        onExclude={(field, reason) =>
          updateField(field, () => createExcludedResolution(reason))
        }
        onMarkUnresolved={(field) =>
          updateField(field, () => createUnresolvedResolution())
        }
        onResetDecision={handleResetDecision}
      />
    </>
  );
}
