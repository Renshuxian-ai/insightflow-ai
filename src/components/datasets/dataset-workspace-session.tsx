"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useEffect,
  useTransition,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { useRouter } from "next/navigation";

import type {
  SemanticAutoUsePolicyResult,
  SemanticFieldReviewEvidence,
  SemanticInferenceMode,
  SemanticSchema,
} from "@/lib/datasets/semantic/types";
import type { Dataset } from "@/lib/datasets/types";
import type { OverviewRuntime } from "@/lib/overview/overview-runtime";
import { RUNTIME_SESSION_HEADER } from "@/lib/runtime-session";

export type WorkspaceStatus = "idle" | "uploading" | "ready" | "error";

export type DatasetSemanticReviewStatus =
  | "idle"
  | "generating"
  | "ready"
  | "empty"
  | "error";

export type DatasetOverviewStatus = "idle" | "loading" | "ready" | "error";

export type SemanticReviewDraft = {
  snapshotId: string;
  sheetName: string | null;
  schemaFingerprint: string;
  schema: SemanticSchema;
  autoUsePolicy: SemanticAutoUsePolicyResult;
  fieldEvidence: SemanticFieldReviewEvidence[];
  inferenceMode: SemanticInferenceMode;
  datasetContext: string;
  updateSequence: number;
};

type SessionRef<T> = {
  current: T;
};

type DatasetOverviewRequest = {
  sourceFile: File;
  dataset: Dataset;
  semanticSchema: SemanticSchema;
};

type DatasetWorkspaceSession = {
  runtimeSessionId: string;
  status: WorkspaceStatus;
  setStatus: Dispatch<SetStateAction<WorkspaceStatus>>;
  dataset: Dataset | null;
  setDataset: Dispatch<SetStateAction<Dataset | null>>;
  sourceFile: File | null;
  setSourceFile: Dispatch<SetStateAction<File | null>>;
  sourceSnapshotId: string | null;
  setSourceSnapshotId: Dispatch<SetStateAction<string | null>>;
  error: string | null;
  setError: Dispatch<SetStateAction<string | null>>;
  semanticStatus: DatasetSemanticReviewStatus;
  setSemanticStatus: Dispatch<SetStateAction<DatasetSemanticReviewStatus>>;
  semanticSchema: SemanticSchema | null;
  setSemanticSchema: Dispatch<SetStateAction<SemanticSchema | null>>;
  autoUsePolicy: SemanticAutoUsePolicyResult | null;
  setAutoUsePolicy: Dispatch<
    SetStateAction<SemanticAutoUsePolicyResult | null>
  >;
  fieldEvidence: SemanticFieldReviewEvidence[];
  setFieldEvidence: Dispatch<
    SetStateAction<SemanticFieldReviewEvidence[]>
  >;
  semanticInferenceMode: SemanticInferenceMode | null;
  setSemanticInferenceMode: Dispatch<
    SetStateAction<SemanticInferenceMode | null>
  >;
  datasetContext: string;
  setDatasetContext: Dispatch<SetStateAction<string>>;
  semanticError: string | null;
  setSemanticError: Dispatch<SetStateAction<string | null>>;
  semanticSessionMessage: string | null;
  setSemanticSessionMessage: Dispatch<SetStateAction<string | null>>;
  currentReviewKey: string | null;
  setCurrentReviewKey: Dispatch<SetStateAction<string | null>>;
  sheetReviewLabels: Record<string, string>;
  setSheetReviewLabels: Dispatch<SetStateAction<Record<string, string>>>;
  overviewRuntime: OverviewRuntime | null;
  overviewStatus: DatasetOverviewStatus;
  overviewError: string | null;
  requestDatasetOverview: (
    request: DatasetOverviewRequest,
  ) => Promise<void>;
  retryDatasetOverview: () => void;
  clearDatasetOverview: () => void;
  requestId: SessionRef<number>;
  activeRequest: SessionRef<AbortController | null>;
  semanticRequestId: SessionRef<number>;
  activeSemanticRequest: SessionRef<AbortController | null>;
  snapshotSequence: SessionRef<number>;
  draftUpdateSequence: SessionRef<number>;
  reviewDrafts: SessionRef<Map<string, SemanticReviewDraft>>;
};

type OverviewApiErrorPayload = {
  error?: {
    message?: string;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isOverviewRuntime(
  value: unknown,
): value is OverviewRuntime {
  if (!isRecord(value) || value.version !== 1 || value.source !== "dataset") {
    return false;
  }

  if (
    !isRecord(value.metrics) ||
    !isRecord(value.dailyDau) ||
    !isRecord(value.trends) ||
    !isRecord(value.analytics) ||
    !isRecord(value.feedbackTopics) ||
    !isRecord(value.userSegments)
  ) {
    return false;
  }

  return (
    isRecord(value.metrics.dau) &&
    isRecord(value.metrics.d1Retention) &&
    isRecord(value.metrics.coreConversion) &&
    isRecord(value.metrics.feedback) &&
    (value.primaryAnomaly === null || isRecord(value.primaryAnomaly))
  );
}

async function readOverviewError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as OverviewApiErrorPayload;
    return payload.error?.message ?? "Dataset analytics could not be prepared.";
  } catch {
    return "Dataset analytics could not be prepared. Please try again.";
  }
}

const DatasetWorkspaceSessionContext =
  createContext<DatasetWorkspaceSession | null>(null);

export function DatasetWorkspaceSessionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const [runtimeSessionId, setRuntimeSessionId] = useState<string | null>(null);
  const [runtimeReady, setRuntimeReady] = useState(false);
  const [runtimeBootstrapError, setRuntimeBootstrapError] = useState(false);
  const [isRuntimeTransitionPending, startRuntimeTransition] = useTransition();
  const [status, setStatus] = useState<WorkspaceStatus>("idle");
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourceSnapshotId, setSourceSnapshotId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [semanticStatus, setSemanticStatus] =
    useState<DatasetSemanticReviewStatus>("idle");
  const [semanticSchema, setSemanticSchema] =
    useState<SemanticSchema | null>(null);
  const [autoUsePolicy, setAutoUsePolicy] =
    useState<SemanticAutoUsePolicyResult | null>(null);
  const [fieldEvidence, setFieldEvidence] = useState<
    SemanticFieldReviewEvidence[]
  >([]);
  const [semanticInferenceMode, setSemanticInferenceMode] =
    useState<SemanticInferenceMode | null>(null);
  const [datasetContext, setDatasetContext] = useState("");
  const [semanticError, setSemanticError] = useState<string | null>(null);
  const [semanticSessionMessage, setSemanticSessionMessage] =
    useState<string | null>(null);
  const [currentReviewKey, setCurrentReviewKey] = useState<string | null>(null);
  const [sheetReviewLabels, setSheetReviewLabels] = useState<
    Record<string, string>
  >({});
  const [overviewRuntime, setOverviewRuntime] =
    useState<OverviewRuntime | null>(null);
  const [overviewStatus, setOverviewStatus] =
    useState<DatasetOverviewStatus>("idle");
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const requestId = useRef(0);
  const activeRequest = useRef<AbortController | null>(null);
  const semanticRequestId = useRef(0);
  const activeSemanticRequest = useRef<AbortController | null>(null);
  const snapshotSequence = useRef(0);
  const draftUpdateSequence = useRef(0);
  const reviewDrafts = useRef(new Map<string, SemanticReviewDraft>());
  const overviewRequestId = useRef(0);
  const activeOverviewRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const nextRuntimeSessionId = crypto.randomUUID();

    void fetch("/api/runtime-session", {
      method: "POST",
      headers: {
        [RUNTIME_SESSION_HEADER]: nextRuntimeSessionId,
      },
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok || controller.signal.aborted) {
          if (!controller.signal.aborted) {
            setRuntimeBootstrapError(true);
          }
          return;
        }

        startRuntimeTransition(() => {
          setRuntimeSessionId(nextRuntimeSessionId);
          setRuntimeReady(true);
          router.refresh();
        });
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setRuntimeBootstrapError(true);
        }
      });

    return () => controller.abort();
  }, [router]);

  const clearDatasetOverview = useCallback(() => {
    overviewRequestId.current += 1;
    activeOverviewRequest.current?.abort();
    activeOverviewRequest.current = null;
    setOverviewRuntime(null);
    setOverviewStatus("idle");
    setOverviewError(null);
  }, []);

  const requestDatasetOverview = useCallback(
    async (overviewRequest: DatasetOverviewRequest) => {
      if (overviewRequest.semanticSchema.status !== "confirmed") {
        clearDatasetOverview();
        return;
      }

      const currentRequestId = overviewRequestId.current + 1;
      overviewRequestId.current = currentRequestId;
      activeOverviewRequest.current?.abort();

      const controller = new AbortController();
      activeOverviewRequest.current = controller;
      setOverviewRuntime(null);
      setOverviewStatus("loading");
      setOverviewError(null);

      const formData = new FormData();
      formData.append("file", overviewRequest.sourceFile);
      formData.append(
        "semanticSchema",
        JSON.stringify(overviewRequest.semanticSchema),
      );

      const sheetName =
        overviewRequest.dataset.schema.selectedSheetName ??
        overviewRequest.semanticSchema.physicalSchema.selectedSheetName;

      if (sheetName) {
        formData.append("sheetName", sheetName);
      }

      try {
        const response = await fetch("/api/datasets/overview", {
          method: "POST",
          headers: {
            [RUNTIME_SESSION_HEADER]: runtimeSessionId ?? "",
          },
          body: formData,
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(await readOverviewError(response));
        }

        const result: unknown = await response.json();

        if (!isOverviewRuntime(result)) {
          throw new Error(
            "Dataset analytics returned an invalid result. Please try again.",
          );
        }

        if (overviewRequestId.current !== currentRequestId) {
          return;
        }

        setOverviewRuntime(result);
        setOverviewStatus("ready");
        setOverviewError(null);
      } catch (error) {
        if (
          controller.signal.aborted ||
          overviewRequestId.current !== currentRequestId
        ) {
          return;
        }

        setOverviewRuntime(null);
        setOverviewStatus("error");
        setOverviewError(
          error instanceof Error
            ? error.message
            : "Dataset analytics could not be prepared. Please try again.",
        );
      } finally {
        if (overviewRequestId.current === currentRequestId) {
          activeOverviewRequest.current = null;
        }
      }
    },
    [clearDatasetOverview, runtimeSessionId],
  );

  const retryDatasetOverview = useCallback(() => {
    if (!sourceFile || !dataset || semanticSchema?.status !== "confirmed") {
      return;
    }

    void requestDatasetOverview({
      sourceFile,
      dataset,
      semanticSchema,
    });
  }, [dataset, requestDatasetOverview, semanticSchema, sourceFile]);

  const value = useMemo<DatasetWorkspaceSession>(
    () => ({
      runtimeSessionId: runtimeSessionId ?? "",
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
      overviewRuntime,
      overviewStatus,
      overviewError,
      requestDatasetOverview,
      retryDatasetOverview,
      clearDatasetOverview,
      requestId,
      activeRequest,
      semanticRequestId,
      activeSemanticRequest,
      snapshotSequence,
      draftUpdateSequence,
      reviewDrafts,
    }),
    [
      autoUsePolicy,
      clearDatasetOverview,
      currentReviewKey,
      dataset,
      overviewRuntime,
      datasetContext,
      error,
      fieldEvidence,
      semanticInferenceMode,
      semanticError,
      semanticSchema,
      semanticSessionMessage,
      semanticStatus,
      sheetReviewLabels,
      sourceFile,
      sourceSnapshotId,
      status,
      overviewError,
      overviewStatus,
      requestDatasetOverview,
      retryDatasetOverview,
      runtimeSessionId,
    ],
  );

  if (runtimeBootstrapError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f8fa] px-6 text-center">
        <div>
          <p className="text-sm font-semibold text-[#526078]">
            Demo workspace could not be started.
          </p>
          <p className="mt-1 text-xs text-[#98a1b1]">
            Refresh the page to start a new session.
          </p>
        </div>
      </div>
    );
  }

  if (!runtimeReady || isRuntimeTransitionPending || !runtimeSessionId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f8fa] px-6">
        <p className="text-sm font-medium text-[#7e8798]">
          Preparing demo workspace...
        </p>
      </div>
    );
  }

  return (
    <DatasetWorkspaceSessionContext.Provider value={value}>
      {children}
    </DatasetWorkspaceSessionContext.Provider>
  );
}

export function useDatasetWorkspaceSession() {
  const context = useContext(DatasetWorkspaceSessionContext);

  if (!context) {
    throw new Error(
      "useDatasetWorkspaceSession must be used within a DatasetWorkspaceSessionProvider.",
    );
  }

  return context;
}
