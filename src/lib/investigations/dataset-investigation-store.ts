import "server-only";

import type { AgentTrace } from "@/lib/ai/agent/types";
import { lookupDatasetSession } from "@/lib/analytics/dataset-context/session-store";
import { withDiagnosticReturnTo } from "@/lib/diagnostics/diagnostic-navigation";
import type { DiagnosticCase } from "@/lib/diagnostics/types";
import type { InvestigationResult } from "@/lib/investigations/types";
import { getRedisClient } from "@/lib/redis/client";
import { getDatasetReportScope, redisKeys } from "@/lib/redis/keys";
import { createInvestigationAtomically } from "@/lib/redis/scripts/investigation-create";
import { deleteInvestigationAtomically } from "@/lib/redis/scripts/investigation-delete";
import { updateInvestigationAtomically } from "@/lib/redis/scripts/investigation-update";
import { toUnixSeconds } from "@/lib/redis/lifecycle";

import type {
  InvestigationSource,
  InvestigationStatus,
  MockInvestigation,
} from "./mock-investigations";

export type DatasetInvestigationSignalType =
  | "activity"
  | "retention"
  | "funnel"
  | "feedback";

export type DatasetInvestigationRecord = {
  id: string;
  runtimeSessionId: string;
  version: number;
  datasetId: string;
  datasetIdentity: string;
  signalFingerprint: string;
  source: "dataset";
  sourceLabel: InvestigationSource;
  signalType: DatasetInvestigationSignalType;
  title: string;
  problem: string;
  evidence: string[];
  status: InvestigationStatus;
  createdAt: string;
  updatedAt: string;
  diagnosticCase: DiagnosticCase;
  investigationResult: InvestigationResult | null;
  investigationTrace: AgentTrace | null;
  investigationCreatedAt: string | null;
  usedModelId: string | null;
  reportId: string | null;
};

function getEvidenceSummary(diagnosticCase: DiagnosticCase) {
  return [
    ...diagnosticCase.evidence.behaviorSignals.map((signal) => signal.finding),
    ...diagnosticCase.evidence.feedbackSignals.map((signal) => signal.finding),
  ].slice(0, 3);
}

function toDate(value: string) {
  return value.slice(0, 10);
}

type DatasetMutationFailure = {
  status:
    | "not-found"
    | "conflict"
    | "expired"
    | "temporarily-unavailable";
};

async function getDatasetMutationLifetime(
  sessionId: string,
  datasetIdentity: string,
) {
  const lookup = await lookupDatasetSession(sessionId);

  if (lookup.status === "expired") {
    return { status: "expired" as const };
  }

  if (lookup.status !== "ready") {
    return { status: "temporarily-unavailable" as const };
  }

  if (lookup.session.datasetIdentity !== datasetIdentity) {
    return { status: "conflict" as const };
  }

  return {
    status: "ready" as const,
    expiresAt: toUnixSeconds(lookup.session.expiresAt),
  };
}

function normalizeDatasetInvestigationRecord(
  record: DatasetInvestigationRecord,
  runtimeSessionId: string,
): DatasetInvestigationRecord {
  return {
    ...record,
    runtimeSessionId: record.runtimeSessionId ?? runtimeSessionId,
    version: Number.isInteger(record.version) ? record.version : 1,
  };
}

export async function saveDatasetInvestigationCase(input: {
  sessionId: string;
  investigationId: string;
  signalFingerprint: string;
  datasetId: string;
  datasetIdentity: string;
  sourceLabel: InvestigationSource;
  signalType: DatasetInvestigationSignalType;
  diagnosticCase: DiagnosticCase;
}) {
  const lifetime = await getDatasetMutationLifetime(
    input.sessionId,
    input.datasetIdentity,
  );

  if (lifetime.status !== "ready") {
    return lifetime;
  }

  const now = new Date().toISOString();
  const record: DatasetInvestigationRecord = {
    id: input.investigationId,
    runtimeSessionId: input.sessionId,
    version: 1,
    datasetId: input.datasetId,
    datasetIdentity: input.datasetIdentity,
    signalFingerprint: input.signalFingerprint,
    source: "dataset",
    sourceLabel: input.sourceLabel,
    signalType: input.signalType,
    title: input.diagnosticCase.title,
    problem: input.diagnosticCase.summary.changed,
    evidence: getEvidenceSummary(input.diagnosticCase),
    status: "Investigating",
    createdAt: now,
    updatedAt: now,
    diagnosticCase: input.diagnosticCase,
    investigationResult: null,
    investigationTrace: null,
    investigationCreatedAt: null,
    usedModelId: null,
    reportId: null,
  };
  const recordKey = redisKeys.investigation(
    input.sessionId,
    input.datasetIdentity,
    record.id,
  );
  const indexKey = redisKeys.investigationsByDataset(
    input.sessionId,
    input.datasetIdentity,
  );
  const fingerprintKey = redisKeys.investigationByFingerprint(
    input.sessionId,
    input.datasetIdentity,
    input.signalFingerprint,
  );

  const mutationStatus = await createInvestigationAtomically({
    keys: [
      recordKey,
      indexKey,
      fingerprintKey,
      redisKeys.datasetSession(input.sessionId, input.datasetIdentity),
    ],
    record,
    runtimeSessionId: input.sessionId,
    datasetIdentity: input.datasetIdentity,
    investigationId: input.investigationId,
    signalFingerprint: input.signalFingerprint,
    replaceFingerprintPointer:
      input.investigationId !== input.signalFingerprint,
    expiresAt: lifetime.expiresAt,
    score: Date.parse(record.updatedAt),
  });

  if (mutationStatus === "expired") {
    return { status: "expired" as const };
  }

  if (mutationStatus === "conflict") {
    return { status: "conflict" as const };
  }

  if (mutationStatus === "existing") {
    const existing = await getDatasetInvestigation(
      input.sessionId,
      input.investigationId,
      input.datasetIdentity,
    );

    return existing
      ? { status: "ok" as const, value: existing, created: false }
      : { status: "conflict" as const };
  }

  return { status: "ok" as const, value: record, created: true };
}

export async function getDatasetInvestigation(
  sessionId: string,
  investigationId: string,
  datasetIdentity: string,
) {
  const record = await getRedisClient().get<DatasetInvestigationRecord>(
    redisKeys.investigation(sessionId, datasetIdentity, investigationId),
  );

  return record?.datasetIdentity === datasetIdentity &&
    record.id === investigationId &&
    (!record.runtimeSessionId || record.runtimeSessionId === sessionId)
    ? normalizeDatasetInvestigationRecord(record, sessionId)
    : null;
}

function getInvestigationRouteIdCandidates(routeId: string) {
  const candidates = new Set([routeId]);
  let decoded = routeId;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const nextValue = decodeURIComponent(decoded);

      if (nextValue === decoded) {
        break;
      }

      candidates.add(nextValue);
      decoded = nextValue;
    } catch {
      break;
    }
  }

  return candidates;
}

export async function getDatasetInvestigationByRouteId(
  sessionId: string,
  routeId: string,
  datasetIdentity: string,
) {
  for (const investigationId of getInvestigationRouteIdCandidates(routeId)) {
    const record = await getDatasetInvestigation(
      sessionId,
      investigationId,
      datasetIdentity,
    );

    if (record) {
      return record;
    }
  }

  return null;
}

export async function getDatasetInvestigationByFingerprint(
  sessionId: string,
  datasetIdentity: string,
  signalFingerprint: string,
) {
  const investigationId = await getRedisClient().get<string>(
    redisKeys.investigationByFingerprint(
      sessionId,
      datasetIdentity,
      signalFingerprint,
    ),
  );

  return investigationId
    ? getDatasetInvestigation(sessionId, investigationId, datasetIdentity)
    : null;
}

export async function updateDatasetInvestigation(input: {
  sessionId: string;
  investigationId: string;
  datasetIdentity: string;
  generation?: {
    result: InvestigationResult;
    trace: AgentTrace;
    usedModelId: string;
    createdAt: string;
  };
}) {
  const lifetime = await getDatasetMutationLifetime(
    input.sessionId,
    input.datasetIdentity,
  );

  if (lifetime.status !== "ready") {
    return lifetime;
  }

  const existing = await getDatasetInvestigation(
    input.sessionId,
    input.investigationId,
    input.datasetIdentity,
  );

  if (!existing) {
    return { status: "not-found" as const };
  }

  if (!input.generation || existing.status !== "Investigating") {
    return { status: "conflict" as const };
  }

  const updated: DatasetInvestigationRecord = {
    ...existing,
    version: existing.version + 1,
    status: "Validation ready",
    updatedAt: new Date().toISOString(),
    investigationResult: input.generation.result,
    investigationTrace: input.generation.trace,
    investigationCreatedAt: input.generation.createdAt,
    usedModelId: input.generation.usedModelId,
  };
  const indexKey = redisKeys.investigationsByDataset(
    input.sessionId,
    input.datasetIdentity,
  );

  const mutationStatus = await updateInvestigationAtomically({
    keys: [
      redisKeys.investigation(
        input.sessionId,
        input.datasetIdentity,
        updated.id,
      ),
      indexKey,
      redisKeys.datasetSession(input.sessionId, input.datasetIdentity),
    ],
    updatedRecord: updated,
    runtimeSessionId: input.sessionId,
    datasetIdentity: input.datasetIdentity,
    investigationId: updated.id,
    expectedVersion: existing.version,
    expectedStatus: "Investigating",
    nextStatus: "Validation ready",
    expiresAt: lifetime.expiresAt,
    score: Date.parse(updated.updatedAt),
  });

  return mutationStatus === "ok"
    ? { status: "ok" as const, value: updated }
    : { status: mutationStatus as DatasetMutationFailure["status"] };
}

export async function deleteDatasetInvestigation(input: {
  sessionId: string;
  investigationId: string;
  datasetIdentity: string;
}) {
  const lifetime = await getDatasetMutationLifetime(
    input.sessionId,
    input.datasetIdentity,
  );

  if (lifetime.status !== "ready") {
    return lifetime;
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const existing = await getDatasetInvestigation(
      input.sessionId,
      input.investigationId,
      input.datasetIdentity,
    );

    if (!existing) {
      return { status: "not-found" as const };
    }

    const scope = getDatasetReportScope(input.datasetIdentity);
    const mutationStatus = await deleteInvestigationAtomically({
      keys: [
        redisKeys.investigation(
          input.sessionId,
          input.datasetIdentity,
          input.investigationId,
        ),
        redisKeys.investigationsByDataset(
          input.sessionId,
          input.datasetIdentity,
        ),
        redisKeys.investigationByFingerprint(
          input.sessionId,
          input.datasetIdentity,
          existing.signalFingerprint,
        ),
        redisKeys.reportByInvestigation(
          input.sessionId,
          input.datasetIdentity,
          input.investigationId,
        ),
        redisKeys.report(
          input.sessionId,
          scope,
          existing.reportId ?? `missing:${input.investigationId}`,
        ),
        redisKeys.reportsByScope(input.sessionId, scope),
        redisKeys.datasetSession(input.sessionId, input.datasetIdentity),
      ],
      runtimeSessionId: input.sessionId,
      datasetIdentity: input.datasetIdentity,
      investigationId: input.investigationId,
      signalFingerprint: existing.signalFingerprint,
      expectedVersion: existing.version,
      reportId: existing.reportId,
    });

    if (mutationStatus === "ok") {
      return { status: "ok" as const, value: existing };
    }

    if (mutationStatus !== "conflict") {
      return {
        status: mutationStatus as DatasetMutationFailure["status"],
      };
    }
  }

  return { status: "conflict" as const };
}

export async function listDatasetInvestigationRecords(
  sessionId: string,
  datasetIdentity: string,
) {
  const redis = getRedisClient();
  const ids = await redis.zrange<string[]>(
    redisKeys.investigationsByDataset(sessionId, datasetIdentity),
    0,
    -1,
    { rev: true },
  );

  if (ids.length === 0) {
    return [];
  }

  const records = await redis.mget<(DatasetInvestigationRecord | null)[]>(
    ...ids.map((id) =>
      redisKeys.investigation(sessionId, datasetIdentity, id),
    ),
  );

  return records.filter(
    (record): record is DatasetInvestigationRecord =>
      Boolean(record) &&
      record?.datasetIdentity === datasetIdentity &&
      (!record.runtimeSessionId || record.runtimeSessionId === sessionId),
  ).map((record) => normalizeDatasetInvestigationRecord(record, sessionId));
}

export async function listDatasetInvestigations(
  sessionId: string,
  datasetIdentity: string,
): Promise<MockInvestigation[]> {
  const records = await listDatasetInvestigationRecords(
    sessionId,
    datasetIdentity,
  );

  return records.map((record) => ({
    id: record.id,
    title: record.title,
    source: record.sourceLabel,
    status: record.status,
    evidenceSummary: record.evidence,
    createdAt: toDate(record.createdAt),
    updatedAt: toDate(record.updatedAt),
    aiFinding: record.problem,
    href: withDiagnosticReturnTo(
      `/ai-diagnostics/${encodeURIComponent(record.id)}`,
      "/investigations",
    ),
    ...(record.reportId
      ? { reportHref: `/reports/${encodeURIComponent(record.reportId)}` }
      : {}),
  }));
}
