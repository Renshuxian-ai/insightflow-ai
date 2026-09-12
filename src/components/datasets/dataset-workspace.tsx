"use client";

import { DATASET_LIMITS } from "@/lib/datasets/constants";
import {
  getSemanticSchemaUnderstandings,
  mergeSemanticAutoUsePolicy,
  rebindSemanticAutoUsePolicy,
} from "@/lib/datasets/semantic/auto-use-policy";
import {
  mergeSemanticSchemaDraft,
  rebindSemanticSchemaToPhysicalSchema,
} from "@/lib/datasets/semantic/review-state";
import type {
  SemanticAutoUsePolicyResult,
  SemanticFieldReviewEvidence,
  SemanticInferenceMode,
  SemanticSchema,
} from "@/lib/datasets/semantic/types";
import type { Dataset, DatasetSchema } from "@/lib/datasets/types";

import { DatasetPreview } from "./dataset-preview";
import { DatasetSchemaTable } from "./dataset-schema-table";
import { DatasetUpload } from "./dataset-upload";
import {
  type SemanticReviewDraft,
  useDatasetWorkspaceSession,
} from "./dataset-workspace-session";
import { SemanticSchemaReview } from "./semantic-schema-review";

type ApiErrorPayload = {
  error?: {
    message?: string;
  };
};

type SemanticApiPayload = {
  semanticSchema?: SemanticSchema;
  autoUsePolicy?: SemanticAutoUsePolicyResult;
  fieldEvidence?: SemanticFieldReviewEvidence[];
  inferenceMode?: SemanticInferenceMode;
};

const SUPPORTED_EXTENSIONS = ["csv", "xlsx"];

function isSemanticSchemaForPhysicalSchema(
  value: SemanticSchema | undefined,
  physicalSchema: DatasetSchema,
): value is SemanticSchema {
  return Boolean(
    value &&
      Array.isArray(value.fields) &&
      value.retention === "session-only" &&
      value.physicalSchema.datasetId === physicalSchema.datasetId &&
      value.physicalSchema.physicalSchemaVersion === physicalSchema.version &&
      value.physicalSchema.schemaFingerprint ===
        physicalSchema.schemaFingerprint &&
      value.physicalSchema.selectedSheetName ===
        physicalSchema.selectedSheetName,
  );
}

function isAutoUsePolicyForPhysicalSchema(
  value: SemanticAutoUsePolicyResult | undefined,
  physicalSchema: DatasetSchema,
): value is SemanticAutoUsePolicyResult {
  return Boolean(
    value &&
      value.version === 1 &&
      Array.isArray(value.assessments) &&
      value.assessments.length === physicalSchema.fields.length &&
      value.physicalSchema.datasetId === physicalSchema.datasetId &&
      value.physicalSchema.physicalSchemaVersion === physicalSchema.version &&
      value.physicalSchema.schemaFingerprint ===
        physicalSchema.schemaFingerprint &&
      value.physicalSchema.selectedSheetName ===
        physicalSchema.selectedSheetName,
  );
}

function isSafeFieldEvidence(
  value: SemanticFieldReviewEvidence[] | undefined,
  physicalSchema: DatasetSchema,
): value is SemanticFieldReviewEvidence[] {
  if (!Array.isArray(value) || value.length !== physicalSchema.fields.length) {
    return false;
  }

  const physicalFieldKeys = new Set(
    physicalSchema.fields.map((field) => field.stableFieldKey),
  );

  return value.every(
    (field) =>
      typeof field?.stableFieldKey === "string" &&
      physicalFieldKeys.has(field.stableFieldKey) &&
      Array.isArray(field.sanitizedSamples),
  );
}

function isSemanticInferenceMode(
  value: unknown,
): value is SemanticInferenceMode {
  return (
    value === "ai" ||
    value === "ai-assisted" ||
    value === "deterministic-fallback"
  );
}

function validateClientFile(file: File): string | null {
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (!extension || !SUPPORTED_EXTENSIONS.includes(extension)) {
    return "Choose a CSV or XLSX file.";
  }

  if (file.size <= 0) {
    return "The selected file is empty.";
  }

  if (file.size > DATASET_LIMITS.maxFileSizeBytes) {
    return (
      "Choose a file smaller than " +
      Math.floor(DATASET_LIMITS.maxFileSizeBytes / (1024 * 1024)) +
      " MB."
    );
  }

  return null;
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as ApiErrorPayload;
    return payload.error?.message ?? "The dataset could not be processed.";
  } catch {
    return "The dataset could not be processed. Please try again.";
  }
}

function createReviewKey(
  snapshotId: string,
  physicalSchema: DatasetSchema,
): string {
  return [
    snapshotId,
    physicalSchema.selectedSheetName ?? "default",
    physicalSchema.schemaFingerprint,
  ].join("::");
}

function getRemainingReviewCount(draft: SemanticReviewDraft): number {
  const understandings = getSemanticSchemaUnderstandings(
    draft.schema,
    draft.autoUsePolicy,
  );

  return draft.schema.fields.filter((field) => {
    const understanding = understandings.get(field.stableFieldKey);

    return Boolean(
      understanding?.isBlocking ||
        (field.resolution.status === "suggested" &&
          understanding?.status !== "ready-to-use"),
    );
  }).length;
}

function createSheetReviewStatusKey(
  snapshotId: string,
  sheetName: string | null,
): string {
  return [snapshotId, sheetName ?? "default"].join("::");
}

function getDraftReviewLabel(draft: SemanticReviewDraft): string {
  if (draft.schema.status === "confirmed") {
    return "Confirmed";
  }

  const remaining = getRemainingReviewCount(draft);
  return remaining === 0 ? "Ready" : remaining + " remaining";
}

export function DatasetWorkspace() {
  const {
    status,
    setStatus,
    dataset,
    setDataset,
    sourceFile,
    setSourceFile,
    sourceSnapshotId,
    setSourceSnapshotId,
    error,
    setError,
    semanticStatus,
    setSemanticStatus,
    semanticSchema,
    setSemanticSchema,
    autoUsePolicy,
    setAutoUsePolicy,
    fieldEvidence,
    setFieldEvidence,
    semanticInferenceMode,
    setSemanticInferenceMode,
    datasetContext,
    setDatasetContext,
    semanticError,
    setSemanticError,
    semanticSessionMessage,
    setSemanticSessionMessage,
    currentReviewKey,
    setCurrentReviewKey,
    sheetReviewLabels,
    setSheetReviewLabels,
    requestId: requestIdRef,
    activeRequest: activeRequestRef,
    semanticRequestId: semanticRequestIdRef,
    activeSemanticRequest: activeSemanticRequestRef,
    snapshotSequence: snapshotSequenceRef,
    draftUpdateSequence: draftUpdateSequenceRef,
    reviewDrafts: reviewDraftsRef,
  } = useDatasetWorkspaceSession();

  function clearCurrentSemanticView(message: string | null = null) {
    semanticRequestIdRef.current += 1;
    activeSemanticRequestRef.current?.abort();
    activeSemanticRequestRef.current = null;
    setSemanticSchema(null);
    setAutoUsePolicy(null);
    setFieldEvidence([]);
    setSemanticInferenceMode(null);
    setDatasetContext("");
    setCurrentReviewKey(null);
    setSemanticStatus("idle");
    setSemanticError(null);
    setSemanticSessionMessage(message);
  }

  function storeDraft(
    reviewKey: string,
    snapshotId: string,
    physicalSchema: DatasetSchema,
    schema: SemanticSchema,
    policy: SemanticAutoUsePolicyResult,
    evidence: SemanticFieldReviewEvidence[],
    inferenceMode: SemanticInferenceMode,
    context: string,
  ) {
    draftUpdateSequenceRef.current += 1;
    const nextDraft: SemanticReviewDraft = {
      snapshotId,
      sheetName: physicalSchema.selectedSheetName,
      schemaFingerprint: physicalSchema.schemaFingerprint,
      schema,
      autoUsePolicy: policy,
      fieldEvidence: evidence,
      inferenceMode,
      datasetContext: context,
      updateSequence: draftUpdateSequenceRef.current,
    };

    reviewDraftsRef.current.set(reviewKey, nextDraft);
    setSheetReviewLabels((currentLabels) => ({
      ...currentLabels,
      [createSheetReviewStatusKey(snapshotId, physicalSchema.selectedSheetName)]:
        getDraftReviewLabel(nextDraft),
    }));
  }

  function restoreDraft(
    draft: SemanticReviewDraft,
    reviewKey: string,
    snapshotId: string,
    physicalSchema: DatasetSchema,
  ) {
    const restoredSchema = rebindSemanticSchemaToPhysicalSchema(
      draft.schema,
      physicalSchema,
    );
    const restoredPolicy = rebindSemanticAutoUsePolicy(
      draft.autoUsePolicy,
      physicalSchema,
    );

    setSemanticSchema(restoredSchema);
    setAutoUsePolicy(restoredPolicy);
    setFieldEvidence(draft.fieldEvidence);
    setSemanticInferenceMode(draft.inferenceMode);
    setDatasetContext(draft.datasetContext);
    setCurrentReviewKey(reviewKey);
    setSemanticStatus("ready");
    setSemanticError(null);
    setSemanticSessionMessage(
      "Restored this worksheet's field review from the current session.",
    );
    storeDraft(
      reviewKey,
      snapshotId,
      physicalSchema,
      restoredSchema,
      restoredPolicy,
      draft.fieldEvidence,
      draft.inferenceMode,
      draft.datasetContext,
    );
  }

  async function generateSemanticDraft(
    physicalSchema: DatasetSchema,
    reviewKey: string,
    snapshotId: string,
    context: string,
    previousDraft?: SemanticReviewDraft,
  ) {
    const currentSemanticRequestId = semanticRequestIdRef.current + 1;
    semanticRequestIdRef.current = currentSemanticRequestId;
    activeSemanticRequestRef.current?.abort();

    if (physicalSchema.fields.length === 0) {
      setSemanticSchema(null);
      setAutoUsePolicy(null);
      setFieldEvidence([]);
      setSemanticInferenceMode(null);
      setSemanticStatus("empty");
      setSemanticError(null);
      return;
    }

    const controller = new AbortController();
    activeSemanticRequestRef.current = controller;
    setSemanticStatus("generating");
    setSemanticError(null);
    setSemanticSessionMessage(null);

    try {
      const response = await fetch("/api/datasets/semantic-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schema: physicalSchema,
          datasetContext: context.trim() || null,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const payload = (await response.json()) as SemanticApiPayload;

      if (semanticRequestIdRef.current !== currentSemanticRequestId) {
        return;
      }

      if (
        !isSemanticSchemaForPhysicalSchema(
          payload.semanticSchema,
          physicalSchema,
        ) ||
        !isAutoUsePolicyForPhysicalSchema(
          payload.autoUsePolicy,
          physicalSchema,
        ) ||
        !isSafeFieldEvidence(payload.fieldEvidence, physicalSchema) ||
        !isSemanticInferenceMode(payload.inferenceMode)
      ) {
        throw new Error(
          "The generated field understanding does not match the current dataset.",
        );
      }

      const latestDraft = reviewDraftsRef.current.get(reviewKey) ?? previousDraft;
      const nextSchema = latestDraft
        ? mergeSemanticSchemaDraft(latestDraft.schema, payload.semanticSchema)
        : payload.semanticSchema;
      const nextPolicy = latestDraft
        ? mergeSemanticAutoUsePolicy(
            latestDraft.autoUsePolicy,
            payload.autoUsePolicy,
            latestDraft.schema,
          )
        : payload.autoUsePolicy;

      setSemanticSchema(nextSchema);
      setAutoUsePolicy(nextPolicy);
      setFieldEvidence(payload.fieldEvidence);
      setSemanticInferenceMode(payload.inferenceMode);
      setDatasetContext(context);
      setCurrentReviewKey(reviewKey);
      setSemanticStatus("ready");
      setSemanticSessionMessage(
        latestDraft
          ? "Field suggestions were refreshed. Your decisions were preserved."
          : null,
      );
      storeDraft(
        reviewKey,
        snapshotId,
        physicalSchema,
        nextSchema,
        nextPolicy,
        payload.fieldEvidence,
        payload.inferenceMode,
        context,
      );
    } catch (caughtError) {
      if (
        controller.signal.aborted ||
        semanticRequestIdRef.current !== currentSemanticRequestId
      ) {
        return;
      }

      const latestDraft = reviewDraftsRef.current.get(reviewKey) ?? previousDraft;

      if (latestDraft) {
        setSemanticSchema(latestDraft.schema);
        setAutoUsePolicy(latestDraft.autoUsePolicy);
        setFieldEvidence(latestDraft.fieldEvidence);
        setSemanticInferenceMode(latestDraft.inferenceMode);
        setDatasetContext(latestDraft.datasetContext);
        setSemanticStatus("ready");
        setSemanticSessionMessage(
          "Couldn’t refresh field understanding. Your current review is unchanged.",
        );
        return;
      }

      setSemanticSchema(null);
      setAutoUsePolicy(null);
      setFieldEvidence([]);
      setSemanticInferenceMode(null);
      setSemanticStatus("error");
      setSemanticError(
        caughtError instanceof Error
          ? caughtError.message
          : "Field suggestions could not be generated. Please try again.",
      );
    }
  }

  async function parseFile(
    file: File,
    snapshotId: string,
    sheetName?: string,
  ) {
    const currentRequestId = requestIdRef.current + 1;
    requestIdRef.current = currentRequestId;
    activeRequestRef.current?.abort();

    const controller = new AbortController();
    activeRequestRef.current = controller;
    setStatus("uploading");
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    if (sheetName) {
      formData.append("sheetName", sheetName);
    }

    try {
      const response = await fetch("/api/datasets/parse", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const nextDataset = (await response.json()) as Dataset;

      if (requestIdRef.current !== currentRequestId) {
        return;
      }

      const reviewKey = createReviewKey(snapshotId, nextDataset.schema);
      const cachedDraft = reviewDraftsRef.current.get(reviewKey);
      const previousSheetDraft = [...reviewDraftsRef.current.values()]
        .filter(
          (draft) =>
            draft.snapshotId === snapshotId &&
            draft.sheetName === nextDataset.schema.selectedSheetName,
        )
        .sort(
          (left, right) => right.updateSequence - left.updateSequence,
        )[0];

      setDataset(nextDataset);
      setStatus("ready");
      setCurrentReviewKey(reviewKey);

      if (cachedDraft) {
        try {
          restoreDraft(
            cachedDraft,
            reviewKey,
            snapshotId,
            nextDataset.schema,
          );
          return;
        } catch {
          // A fingerprint/key match is still verified before a draft is reused.
        }
      }

      setSemanticSchema(null);
      setAutoUsePolicy(null);
      setFieldEvidence([]);
      setDatasetContext("");
      setSemanticSessionMessage(
        previousSheetDraft &&
          previousSheetDraft.schemaFingerprint !==
            nextDataset.schema.schemaFingerprint
          ? "The detected structure changed, so a new review was started. The earlier session draft was kept separately."
          : null,
      );
      void generateSemanticDraft(
        nextDataset.schema,
        reviewKey,
        snapshotId,
        "",
      );
    } catch (caughtError) {
      if (
        controller.signal.aborted ||
        requestIdRef.current !== currentRequestId
      ) {
        return;
      }

      setStatus("error");
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "The dataset could not be processed. Please try again.",
      );
    }
  }

  function handleFileSelected(file: File) {
    clearCurrentSemanticView(
      sourceFile ? "A new dataset has its own field understanding." : null,
    );
    const validationError = validateClientFile(file);

    if (validationError) {
      setSourceFile(null);
      setSourceSnapshotId(null);
      setDataset(null);
      setStatus("error");
      setError(validationError);
      return;
    }

    snapshotSequenceRef.current += 1;
    const snapshotId = "dataset-snapshot-" + snapshotSequenceRef.current;
    setSourceFile(file);
    setSourceSnapshotId(snapshotId);
    setDataset(null);
    void parseFile(file, snapshotId);
  }

  function handleSheetChange(sheetName: string) {
    if (
      !sourceFile ||
      !sourceSnapshotId ||
      sheetName === dataset?.schema.selectedSheetName
    ) {
      return;
    }

    semanticRequestIdRef.current += 1;
    activeSemanticRequestRef.current?.abort();
    activeSemanticRequestRef.current = null;
    setSemanticSchema(null);
    setAutoUsePolicy(null);
    setFieldEvidence([]);
    setCurrentReviewKey(null);
    setSemanticStatus("idle");
    setSemanticError(null);
    setSemanticSessionMessage("Opening the selected worksheet...");
    void parseFile(sourceFile, sourceSnapshotId, sheetName);
  }

  function handleRemoveDataset() {
    requestIdRef.current += 1;
    activeRequestRef.current?.abort();
    activeRequestRef.current = null;
    clearCurrentSemanticView(null);
    setSourceFile(null);
    setSourceSnapshotId(null);
    setDataset(null);
    setStatus("idle");
    setError(null);
  }

  function handleSemanticSchemaChange(nextSchema: SemanticSchema) {
    if (
      !dataset ||
      !autoUsePolicy ||
      !semanticInferenceMode ||
      !sourceSnapshotId ||
      !currentReviewKey ||
      !isSemanticSchemaForPhysicalSchema(nextSchema, dataset.schema)
    ) {
      clearCurrentSemanticView(
        "The saved review did not match the current data structure.",
      );
      return;
    }

    setSemanticSchema(nextSchema);
    storeDraft(
      currentReviewKey,
      sourceSnapshotId,
      dataset.schema,
      nextSchema,
      autoUsePolicy,
      fieldEvidence,
      semanticInferenceMode,
      datasetContext,
    );
  }

  function handleDatasetContextChange(value: string) {
    setDatasetContext(value);

    if (
      currentReviewKey &&
      sourceSnapshotId &&
      dataset &&
      semanticSchema &&
      autoUsePolicy &&
      semanticInferenceMode
    ) {
      storeDraft(
        currentReviewKey,
        sourceSnapshotId,
        dataset.schema,
        semanticSchema,
        autoUsePolicy,
        fieldEvidence,
        semanticInferenceMode,
        value,
      );
    }
  }

  function refreshSemanticDraft(context = datasetContext) {
    if (!dataset || !sourceSnapshotId || !currentReviewKey) {
      return;
    }

    const previousDraft = reviewDraftsRef.current.get(currentReviewKey);
    void generateSemanticDraft(
      dataset.schema,
      currentReviewKey,
      sourceSnapshotId,
      context,
      previousDraft,
    );
  }

  function getSheetReviewLabel(sheetName: string): string {
    if (!sourceSnapshotId) {
      return "Not started";
    }

    return (
      sheetReviewLabels[createSheetReviewStatusKey(sourceSnapshotId, sheetName)] ??
      "Not started"
    );
  }

  const warnings = dataset
    ? Array.from(
        new Set(dataset.schema.warnings.map((warning) => warning.message)),
      )
    : [];
  const workflowSteps = [
    "Upload Dataset",
    "Physical Profile",
    "Field Understanding",
    "Review uncertain fields",
    "Ready",
  ];
  const currentWorkflowStep =
    status === "idle"
      ? 0
      : status === "uploading" && !dataset
        ? 1
        : !dataset
          ? 0
          : semanticSchema?.status === "confirmed"
            ? 4
            : semanticStatus === "ready"
              ? 3
              : 2;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[#7e8798]">
        {workflowSteps.map((step, index, steps) => (
          <div key={step} className="flex items-center gap-2">
            <span
              className={index <= currentWorkflowStep ? "text-[#526078]" : ""}
            >
              {step}
            </span>
            {index < steps.length - 1 ? (
              <span aria-hidden="true">→</span>
            ) : null}
          </div>
        ))}
      </div>

      <DatasetUpload
        isUploading={status === "uploading"}
        fileName={sourceFile?.name}
        readyDataset={
          dataset
            ? {
                fileName: dataset.file.originalFileName,
                rowCount: dataset.rowCount,
                columnCount: dataset.columnCount,
                format: dataset.format,
              }
            : undefined
        }
        error={error ?? undefined}
        onFileSelected={handleFileSelected}
      />

      {status === "uploading" && !dataset ? (
        <div
          aria-live="polite"
          className="flex items-center gap-3 rounded-xl border border-[#dfe4ec] bg-white px-4 py-3 text-sm text-[#526078]"
        >
          <span
            className="size-4 animate-spin rounded-full border-2 border-[#d7ddeb] border-t-[#3559e8]"
            aria-hidden="true"
          />
          Processing the selected dataset on the server...
        </div>
      ) : null}

      {dataset ? (
        <>
          <div className="flex flex-col gap-3 rounded-xl border border-[#e3e7ee] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              {dataset.schema.availableSheetNames.length > 1 ? (
                <label className="flex items-center gap-2 text-xs font-medium text-[#657084]">
                  Worksheet
                  <select
                    value={dataset.schema.selectedSheetName ?? ""}
                    disabled={status === "uploading"}
                    onChange={(event) => handleSheetChange(event.target.value)}
                    className="h-9 min-w-52 rounded-lg border border-[#dfe4ec] bg-white px-3 text-sm text-[#263247] outline-none focus:border-[#8298ef] disabled:cursor-wait disabled:bg-[#f7f8fa]"
                  >
                    {dataset.schema.availableSheetNames.map((sheetName) => (
                      <option key={sheetName} value={sheetName}>
                        {sheetName + " · " + getSheetReviewLabel(sheetName)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <span className="text-xs text-[#7e8798]">
                  Profiled{" "}
                  {dataset.schema.profileScope.profiledRows.toLocaleString()} of{" "}
                  {dataset.schema.profileScope.totalRows.toLocaleString()} rows
                </span>
              )}
              {status === "uploading" ? (
                <span className="text-xs font-medium text-[#6072b8]">
                  Updating worksheet...
                </span>
              ) : null}
            </div>
            <button
              type="button"
              disabled={status === "uploading"}
              onClick={handleRemoveDataset}
              className="w-fit text-xs font-medium text-[#7e8798] underline-offset-4 hover:text-[#a44848] hover:underline disabled:cursor-wait disabled:opacity-50"
            >
              Remove dataset
            </button>
          </div>

          {warnings.length > 0 ? (
            <details className="rounded-lg border border-[#e7eaf0] bg-[#fafbfc] px-4 py-3 text-xs text-[#7e8798]">
              <summary className="cursor-pointer font-medium">
                {warnings.length} data note{warnings.length === 1 ? "" : "s"}
              </summary>
              <div className="mt-2 space-y-1 leading-5">
                {warnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            </details>
          ) : null}

          <SemanticSchemaReview
            key={currentReviewKey ?? dataset.schema.schemaFingerprint}
            physicalSchema={dataset.schema}
            semanticSchema={semanticSchema}
            autoUsePolicy={autoUsePolicy}
            fieldEvidence={fieldEvidence}
            status={semanticStatus}
            error={semanticError}
            sessionMessage={semanticSessionMessage}
            inferenceMode={semanticInferenceMode}
            datasetContext={datasetContext}
            onDatasetContextChange={handleDatasetContextChange}
            onRetry={() => refreshSemanticDraft()}
            onRegenerate={(context) => refreshSemanticDraft(context)}
            onSchemaChange={handleSemanticSchemaChange}
          />
          <DatasetSchemaTable schema={dataset.schema} />
          <DatasetPreview preview={dataset.preview} />
        </>
      ) : null}
    </div>
  );
}
