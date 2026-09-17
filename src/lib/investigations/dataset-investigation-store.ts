import "server-only";

import type { DiagnosticCase } from "@/lib/diagnostics/types";
import type { AgentTrace } from "@/lib/ai/agent/types";
import type { InvestigationResult } from "@/lib/investigations/types";
import type { ProductReport } from "@/lib/reports/mock-reports";
import { withDiagnosticReturnTo } from "@/lib/diagnostics/diagnostic-navigation";

import type {
  InvestigationSource,
  InvestigationStatus,
  MockInvestigation,
} from "./mock-investigations";

const SESSION_TTL_MS = 30 * 60 * 1_000;
const MAX_SESSION_ENTRIES = 20;

export type DatasetInvestigationSignalType =
  | "activity"
  | "retention"
  | "funnel"
  | "feedback";

export type DatasetInvestigationRecord = {
  id: string;
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

type DatasetInvestigationSession = {
  records: Map<string, DatasetInvestigationRecord>;
  touchedAt: number;
};

declare global {
  var __insightflowDatasetInvestigations:
    | Map<string, DatasetInvestigationSession>
    | undefined;
}

const investigationSessions =
  globalThis.__insightflowDatasetInvestigations ??
  new Map<string, DatasetInvestigationSession>();

globalThis.__insightflowDatasetInvestigations = investigationSessions;

function removeExpiredSessions(now: number) {
  for (const [sessionId, session] of investigationSessions) {
    if (now - session.touchedAt > SESSION_TTL_MS) {
      investigationSessions.delete(sessionId);
    }
  }

  while (investigationSessions.size >= MAX_SESSION_ENTRIES) {
    const oldestSessionId = investigationSessions.keys().next().value;

    if (typeof oldestSessionId !== "string") {
      break;
    }

    investigationSessions.delete(oldestSessionId);
  }
}

function getSession(sessionId: string, create: boolean) {
  const now = Date.now();
  removeExpiredSessions(now);
  const existing = investigationSessions.get(sessionId);

  if (existing) {
    existing.touchedAt = now;
    return existing;
  }

  if (!create) {
    return null;
  }

  const session: DatasetInvestigationSession = {
    records: new Map(),
    touchedAt: now,
  };
  investigationSessions.set(sessionId, session);
  return session;
}

function getEvidenceSummary(diagnosticCase: DiagnosticCase) {
  return [
    ...diagnosticCase.evidence.behaviorSignals.map((signal) => signal.finding),
    ...diagnosticCase.evidence.feedbackSignals.map((signal) => signal.finding),
  ].slice(0, 3);
}

function toDate(value: string) {
  return value.slice(0, 10);
}

export function saveDatasetInvestigationCase(input: {
  sessionId: string;
  investigationId: string;
  signalFingerprint: string;
  datasetId: string;
  datasetIdentity: string;
  sourceLabel: InvestigationSource;
  signalType: DatasetInvestigationSignalType;
  diagnosticCase: DiagnosticCase;
}) {
  const session = getSession(input.sessionId, true);

  if (!session) {
    throw new Error("Dataset investigation session could not be created.");
  }

  const storedRecord = session.records.get(input.investigationId);
  const existing =
    storedRecord?.datasetIdentity === input.datasetIdentity
      ? storedRecord
      : null;
  const now = new Date().toISOString();
  const record: DatasetInvestigationRecord = {
    id: input.investigationId,
    datasetId: input.datasetId,
    datasetIdentity: input.datasetIdentity,
    signalFingerprint: input.signalFingerprint,
    source: "dataset",
    sourceLabel: input.sourceLabel,
    signalType: input.signalType,
    title: input.diagnosticCase.title,
    problem: input.diagnosticCase.summary.changed,
    evidence: getEvidenceSummary(input.diagnosticCase),
    status: existing?.status ?? "Investigating",
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    diagnosticCase: input.diagnosticCase,
    investigationResult: existing?.investigationResult ?? null,
    investigationTrace: existing?.investigationTrace ?? null,
    investigationCreatedAt: existing?.investigationCreatedAt ?? null,
    usedModelId: existing?.usedModelId ?? null,
    reportId: existing?.reportId ?? null,
  };

  session.records.set(record.id, record);
  return record;
}

export function getDatasetInvestigation(
  sessionId: string,
  investigationId: string,
  datasetIdentity: string,
) {
  const record =
    getSession(sessionId, false)?.records.get(investigationId) ?? null;

  return record?.datasetIdentity === datasetIdentity ? record : null;
}

function getInvestigationRouteIdCandidates(routeId: string) {
  const candidates = new Set([routeId]);
  let decoded = routeId;

  // Next.js normally decodes a dynamic segment, but client navigation and
  // previously persisted hrefs can leave an encoded (or double-encoded) ID.
  // Bound decoding so malformed input cannot turn this lookup into a loop.
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

export function getDatasetInvestigationByRouteId(
  sessionId: string,
  routeId: string,
  datasetIdentity: string,
) {
  for (const investigationId of getInvestigationRouteIdCandidates(routeId)) {
    const record = getDatasetInvestigation(
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

export function getLatestDatasetInvestigationByFingerprint(
  sessionId: string,
  datasetIdentity: string,
  signalFingerprint: string,
) {
  const records = [
    ...(getSession(sessionId, false)?.records.values() ?? []),
  ].filter(
    (record) =>
      record.datasetIdentity === datasetIdentity &&
      record.signalFingerprint === signalFingerprint,
  );

  return records.sort(
    (left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt),
  )[0] ?? null;
}

export function updateDatasetInvestigation(input: {
  sessionId: string;
  investigationId: string;
  datasetIdentity: string;
  status: InvestigationStatus;
  reportId?: string;
  generation?: {
    result: InvestigationResult;
    trace: AgentTrace;
    usedModelId: string;
    createdAt: string;
  };
}) {
  const session = getSession(input.sessionId, false);
  const existing = session?.records.get(input.investigationId);

  if (
    !session ||
    !existing ||
    existing.datasetIdentity !== input.datasetIdentity
  ) {
    return null;
  }

  const updated: DatasetInvestigationRecord = {
    ...existing,
    status: input.status,
    updatedAt: new Date().toISOString(),
    reportId: input.reportId ?? existing.reportId,
    ...(input.generation
      ? {
          investigationResult: input.generation.result,
          investigationTrace: input.generation.trace,
          investigationCreatedAt: input.generation.createdAt,
          usedModelId: input.generation.usedModelId,
        }
      : {}),
  };
  session.records.set(updated.id, updated);
  return updated;
}

export function deleteDatasetInvestigation(input: {
  sessionId: string;
  investigationId: string;
  datasetIdentity: string;
}) {
  const session = getSession(input.sessionId, false);
  const existing = session?.records.get(input.investigationId);

  if (
    !session ||
    !existing ||
    existing.datasetIdentity !== input.datasetIdentity
  ) {
    return null;
  }

  session.records.delete(input.investigationId);
  return existing;
}

export function clearDatasetInvestigationReport(input: {
  sessionId: string;
  datasetIdentity: string;
  reportId: string;
  investigationId?: string;
}) {
  const session = getSession(input.sessionId, false);

  if (!session) {
    return null;
  }

  const exactRecord = input.investigationId
    ? session.records.get(input.investigationId)
    : null;
  const existing =
    exactRecord?.datasetIdentity === input.datasetIdentity &&
    exactRecord.reportId === input.reportId
      ? exactRecord
      : input.investigationId
        ? null
        : [...session.records.values()].find(
            (record) =>
              record.datasetIdentity === input.datasetIdentity &&
              record.reportId === input.reportId,
          );

  if (!existing) {
    return null;
  }

  const updated: DatasetInvestigationRecord = {
    ...existing,
    status:
      existing.status === "Validated" ? "Validation ready" : existing.status,
    reportId: null,
    updatedAt: new Date().toISOString(),
  };
  session.records.set(updated.id, updated);
  return updated;
}

export function reconcileDatasetInvestigationReports(input: {
  sessionId: string;
  datasetIdentity: string;
  reports: readonly ProductReport[];
}) {
  const session = getSession(input.sessionId, false);

  if (!session) {
    return;
  }

  for (const [recordId, record] of session.records) {
    if (
      record.datasetIdentity !== input.datasetIdentity ||
      record.status !== "Validated"
    ) {
      continue;
    }

    const matchingReport = input.reports.find(
      (report) => {
        const linkedInvestigationCaseId =
          report.investigationCaseId ??
          (report.id === `report-${record.id}` ? record.id : null);

        return (
          report.id === record.reportId &&
          linkedInvestigationCaseId === record.id &&
          report.datasetIdentity === record.datasetIdentity
        );
      },
    );

    if (!matchingReport) {
      session.records.set(recordId, {
        ...record,
        status: "Validation ready",
        reportId: null,
        updatedAt: new Date().toISOString(),
      });
    }
  }
}

export function listDatasetInvestigations(
  sessionId: string,
  datasetIdentity: string,
): MockInvestigation[] {
  const records = [
    ...(getSession(sessionId, false)?.records.values() ?? []),
  ].filter((record) => record.datasetIdentity === datasetIdentity);

  return records
    .sort(
      (left, right) =>
        Date.parse(right.updatedAt) - Date.parse(left.updatedAt),
    )
    .map((record) => ({
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
