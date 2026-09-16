import "server-only";

import { randomUUID } from "node:crypto";

import type { ProductReport } from "./mock-reports";

export const REPORT_SESSION_COOKIE = "insightflow_report_session";

const SESSION_TTL_MS = 12 * 60 * 60 * 1_000;
const MAX_SESSION_ENTRIES = 50;
const MAX_REPORTS_PER_SESSION = 30;

type ReportSession = {
  id: string;
  reports: Map<string, ProductReport>;
  updatedAt: number;
};

declare global {
  var __insightflowReportSessions: Map<string, ReportSession> | undefined;
}

const sessions =
  globalThis.__insightflowReportSessions ?? new Map<string, ReportSession>();

globalThis.__insightflowReportSessions = sessions;

function removeExpiredSessions(now: number) {
  for (const [sessionId, session] of sessions) {
    if (now - session.updatedAt > SESSION_TTL_MS) {
      sessions.delete(sessionId);
    }
  }

  while (sessions.size >= MAX_SESSION_ENTRIES) {
    const oldestSessionId = sessions.keys().next().value;

    if (typeof oldestSessionId !== "string") {
      break;
    }

    sessions.delete(oldestSessionId);
  }
}

export function saveSessionReport(
  report: ProductReport,
  requestedSessionId?: string,
) {
  const now = Date.now();

  removeExpiredSessions(now);

  const existingSession = requestedSessionId
    ? sessions.get(requestedSessionId)
    : undefined;
  const session: ReportSession = existingSession ?? {
    id: requestedSessionId ?? randomUUID(),
    reports: new Map<string, ProductReport>(),
    updatedAt: now,
  };

  session.reports.delete(report.id);
  session.reports.set(report.id, report);

  while (session.reports.size > MAX_REPORTS_PER_SESSION) {
    const oldestReportId = session.reports.keys().next().value;

    if (typeof oldestReportId !== "string") {
      break;
    }

    session.reports.delete(oldestReportId);
  }

  session.updatedAt = now;
  sessions.set(session.id, session);

  return session.id;
}

export function getSessionReports(
  sessionId: string | undefined,
  datasetIdentity?: string,
) {
  if (!sessionId) {
    return [];
  }

  const session = sessions.get(sessionId);

  if (!session || Date.now() - session.updatedAt > SESSION_TTL_MS) {
    sessions.delete(sessionId);
    return [];
  }

  return [...session.reports.values()]
    .filter(
      (report) =>
        datasetIdentity === undefined || report.datasetIdentity === datasetIdentity,
    )
    .sort(
    (left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt),
  );
}

export function getSessionReport(
  sessionId: string | undefined,
  reportId: string,
  datasetIdentity?: string,
) {
  return (
    getSessionReports(sessionId, datasetIdentity).find(
      (report) => report.id === reportId,
    ) ?? null
  );
}

function getReportRouteIdCandidates(routeId: string) {
  const candidates = new Set([routeId]);
  let decoded = routeId;

  // Dynamic route params may arrive decoded, encoded, or double encoded,
  // depending on whether navigation came from a raw or historical href.
  // Bound decoding so malformed input safely falls through to not found.
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

export function getSessionReportByRouteId(
  sessionId: string | undefined,
  routeId: string,
  datasetIdentity?: string,
) {
  for (const reportId of getReportRouteIdCandidates(routeId)) {
    const report = getSessionReport(sessionId, reportId, datasetIdentity);

    if (report) {
      return report;
    }
  }

  return null;
}

export function deleteSessionReport(
  sessionId: string | undefined,
  reportId: string,
  datasetIdentity?: string,
) {
  if (!sessionId) {
    return null;
  }

  const session = sessions.get(sessionId);
  const report = session?.reports.get(reportId);

  if (
    !session ||
    !report ||
    (datasetIdentity !== undefined &&
      report.datasetIdentity !== datasetIdentity)
  ) {
    return null;
  }

  session.reports.delete(reportId);
  session.updatedAt = Date.now();
  return report;
}
