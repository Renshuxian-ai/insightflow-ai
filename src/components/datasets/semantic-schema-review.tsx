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
  SemanticFieldMapping,
  SemanticFieldReviewEvidence,
  SemanticMappingValue,
  SemanticSchema,
} from "@/lib/datasets/semantic/types";
import type { DatasetSchema } from "@/lib/datasets/types";

import { SemanticReviewWorkspace } from "./semantic-review-workspace";

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
  onRetry,
  onSchemaChange,
}: SemanticSchemaReviewProps) {
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isReviewExpanded, setIsReviewExpanded] = useState(false);
  const [activeFieldKey, setActiveFieldKey] = useState<string | null>(null);
  const [controllerError, setControllerError] = useState<string | null>(null);

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

  if (status === "idle" || status === "generating") {
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
  const meaningUnclearFields = currentSemanticSchema.fields.filter(
    (field) =>
      understandings.get(field.stableFieldKey)?.status === "meaning-unclear",
  );
  const notUsedFields = currentSemanticSchema.fields.filter(
    (field) =>
      understandings.get(field.stableFieldKey)?.status === "not-used",
  );
  const reviewFields = currentSemanticSchema.fields
    .filter((field) => {
      const understanding = understandings.get(field.stableFieldKey);

      return Boolean(
        understanding?.isBlocking ||
          (field.resolution.status === "suggested" &&
            (understanding?.status === "needs-review" ||
              understanding?.status === "meaning-unclear")),
      );
    })
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
  const hasHumanReview = currentSemanticSchema.fields.some(
    (field) => field.resolution.status !== "suggested",
  );
  const canConfirm = canConfirmSemanticSchema(
    currentSemanticSchema,
    currentAutoUsePolicy,
  );
  const readOnly = currentSemanticSchema.status === "confirmed";

  function openReview(fieldKey?: string) {
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
            onClick={() => openReview(readyFields[0]?.stableFieldKey)}
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
                {currentSemanticSchema.fields.length.toLocaleString()} fields understood
              </p>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                <span className="font-medium text-[#27714b]">
                  {readyFields.length.toLocaleString()} ready to use
                </span>
                <span className="font-medium text-[#8a5b00]">
                  {reviewFields.length.toLocaleString()} need your review
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

            <button
              type="button"
              onClick={() => openReview()}
              className="min-h-11 w-fit rounded-lg bg-[#3559e8] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#2949ca] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3559e8]"
            >
              {reviewFields.length > 0
                ? hasHumanReview
                  ? "Continue review"
                  : "Review " +
                    reviewFields.length +
                    (reviewFields.length === 1 ? " field" : " fields")
                : "Review field meanings"}
            </button>
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
                      ? " field still needs your review"
                      : " fields still need your review")}
              </p>
              {!canConfirm && blockingFields[0] ? (
                <button
                  type="button"
                  onClick={() => openReview(blockingFields[0].stableFieldKey)}
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
              onClick={handleConfirm}
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
