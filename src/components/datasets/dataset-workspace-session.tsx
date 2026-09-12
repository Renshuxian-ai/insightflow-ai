"use client";

import {
  createContext,
  useContext,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

import type {
  SemanticAutoUsePolicyResult,
  SemanticFieldReviewEvidence,
  SemanticInferenceMode,
  SemanticSchema,
} from "@/lib/datasets/semantic/types";
import type { Dataset } from "@/lib/datasets/types";

export type WorkspaceStatus = "idle" | "uploading" | "ready" | "error";

export type DatasetSemanticReviewStatus =
  | "idle"
  | "generating"
  | "ready"
  | "empty"
  | "error";

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

type DatasetWorkspaceSession = {
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
  requestId: SessionRef<number>;
  activeRequest: SessionRef<AbortController | null>;
  semanticRequestId: SessionRef<number>;
  activeSemanticRequest: SessionRef<AbortController | null>;
  snapshotSequence: SessionRef<number>;
  draftUpdateSequence: SessionRef<number>;
  reviewDrafts: SessionRef<Map<string, SemanticReviewDraft>>;
};

const DatasetWorkspaceSessionContext =
  createContext<DatasetWorkspaceSession | null>(null);

export function DatasetWorkspaceSessionProvider({
  children,
}: {
  children: ReactNode;
}) {
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
  const requestId = useRef(0);
  const activeRequest = useRef<AbortController | null>(null);
  const semanticRequestId = useRef(0);
  const activeSemanticRequest = useRef<AbortController | null>(null);
  const snapshotSequence = useRef(0);
  const draftUpdateSequence = useRef(0);
  const reviewDrafts = useRef(new Map<string, SemanticReviewDraft>());

  const value = useMemo<DatasetWorkspaceSession>(
    () => ({
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
      currentReviewKey,
      dataset,
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
    ],
  );

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
