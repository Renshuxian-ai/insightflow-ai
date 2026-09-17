import "server-only";

import { randomUUID } from "node:crypto";

import { lookupDatasetSession } from "@/lib/analytics/dataset-context/session-store";
import {
  getDatasetInvestigation,
  type DatasetInvestigationRecord,
} from "@/lib/investigations/dataset-investigation-store";
import { getRedisClient } from "@/lib/redis/client";
import {
  getDatasetReportScope,
  redisKeys,
  type ReportScope,
} from "@/lib/redis/keys";
import {
  DEMO_REPORT_TTL_SECONDS,
  toUnixSeconds,
} from "@/lib/redis/lifecycle";
import { createReportAtomically } from "@/lib/redis/scripts/report-create";
import { deleteReportAtomically } from "@/lib/redis/scripts/report-delete";

import type { ProductReport } from "./mock-reports";

export const REPORT_SESSION_COOKIE = "insightflow_report_session";

const MAX_REPORTS_PER_SESSION = 30;

export type ReportMutationResult =
  | { status: "ok"; report: ProductReport; created?: boolean }
  | {
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

function getScope(datasetIdentity?: string): ReportScope {
  return datasetIdentity ? getDatasetReportScope(datasetIdentity) : "demo";
}

function getReportRouteIdCandidates(routeId: string) {
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

export async function saveSessionReport(
  report: ProductReport,
  requestedSessionId?: string,
) {
  if (report.datasetIdentity) {
    throw new Error(
      "Dataset reports must be saved with their validated Investigation.",
    );
  }

  const sessionId = requestedSessionId ?? randomUUID();
  const redis = getRedisClient();
  const indexKey = redisKeys.reportsByScope(sessionId, "demo");
  const score = Date.parse(report.updatedAt);

  await redis
    .multi()
    .set(redisKeys.report(sessionId, "demo", report.id), report, {
      ex: DEMO_REPORT_TTL_SECONDS,
    })
    .zadd(indexKey, { score, member: report.id })
    .expire(indexKey, DEMO_REPORT_TTL_SECONDS)
    .zremrangebyrank(indexKey, 0, -(MAX_REPORTS_PER_SESSION + 1))
    .exec();

  return sessionId;
}

export async function saveDatasetReportAndValidateInvestigation(input: {
  sessionId: string;
  datasetIdentity: string;
  investigationId: string;
  report: ProductReport;
}) {
  const lifetime = await getDatasetMutationLifetime(
    input.sessionId,
    input.datasetIdentity,
  );

  if (lifetime.status !== "ready") {
    return lifetime;
  }

  const investigation = await getDatasetInvestigation(
    input.sessionId,
    input.investigationId,
    input.datasetIdentity,
  );

  if (
    !investigation ||
    (investigation.status !== "Validation ready" &&
      !(
        investigation.status === "Validated" &&
        investigation.reportId === input.report.id
      )) ||
    !investigation.investigationResult ||
    input.report.datasetIdentity !== input.datasetIdentity ||
    input.report.investigationCaseId !== input.investigationId
  ) {
    return { status: investigation ? "conflict" : "not-found" } as const;
  }

  const updatedAt = new Date().toISOString();
  const validatedInvestigation: DatasetInvestigationRecord = {
    ...investigation,
    version: investigation.version + 1,
    status: "Validated",
    reportId: input.report.id,
    updatedAt,
  };
  const scope = getDatasetReportScope(input.datasetIdentity);
  const reportIndexKey = redisKeys.reportsByScope(input.sessionId, scope);
  const investigationIndexKey = redisKeys.investigationsByDataset(
    input.sessionId,
    input.datasetIdentity,
  );
  const mutationStatus = await createReportAtomically({
    keys: [
      redisKeys.investigation(
        input.sessionId,
        input.datasetIdentity,
        input.investigationId,
      ),
      investigationIndexKey,
      redisKeys.report(input.sessionId, scope, input.report.id),
      reportIndexKey,
      redisKeys.reportByInvestigation(
        input.sessionId,
        input.datasetIdentity,
        input.investigationId,
      ),
      redisKeys.datasetSession(input.sessionId, input.datasetIdentity),
    ],
    updatedInvestigation: validatedInvestigation,
    report: input.report,
    runtimeSessionId: input.sessionId,
    datasetIdentity: input.datasetIdentity,
    investigationId: input.investigationId,
    reportId: input.report.id,
    expectedVersion: investigation.version,
    expiresAt: lifetime.expiresAt,
    investigationScore: Date.parse(updatedAt),
    reportScore: Date.parse(input.report.updatedAt),
  });

  if (mutationStatus === "created" || mutationStatus === "existing") {
    return {
      status: "ok" as const,
      report: input.report,
      created: mutationStatus === "created",
    };
  }

  return {
    status: mutationStatus as Exclude<
      ReportMutationResult["status"],
      "ok"
    >,
  };
}

export async function getSessionReports(
  sessionId: string | undefined,
  datasetIdentity?: string,
) {
  if (!sessionId) {
    return [];
  }

  const redis = getRedisClient();
  const scope = getScope(datasetIdentity);
  const ids = await redis.zrange<string[]>(
    redisKeys.reportsByScope(sessionId, scope),
    0,
    -1,
    { rev: true },
  );

  if (ids.length === 0) {
    return [];
  }

  const reports = await redis.mget<(ProductReport | null)[]>(
    ...ids.map((id) => redisKeys.report(sessionId, scope, id)),
  );

  return reports.filter(
    (report): report is ProductReport =>
      Boolean(report) &&
      (datasetIdentity === undefined ||
        report?.datasetIdentity === datasetIdentity),
  );
}

export async function getSessionReport(
  sessionId: string | undefined,
  reportId: string,
  datasetIdentity?: string,
) {
  if (!sessionId) {
    return null;
  }

  const report = await getRedisClient().get<ProductReport>(
    redisKeys.report(sessionId, getScope(datasetIdentity), reportId),
  );

  return report &&
    (datasetIdentity === undefined || report.datasetIdentity === datasetIdentity)
    ? report
    : null;
}

export async function getSessionReportByRouteId(
  sessionId: string | undefined,
  routeId: string,
  datasetIdentity?: string,
) {
  for (const reportId of getReportRouteIdCandidates(routeId)) {
    const report = await getSessionReport(
      sessionId,
      reportId,
      datasetIdentity,
    );

    if (report) {
      return report;
    }
  }

  return null;
}

export async function deleteSessionReport(
  sessionId: string | undefined,
  reportId: string,
  datasetIdentity?: string,
) {
  if (!sessionId) {
    return { status: "not-found" as const };
  }

  const report = await getSessionReport(sessionId, reportId, datasetIdentity);

  if (!report) {
    return { status: "not-found" as const };
  }

  const redis = getRedisClient();
  const scope = getScope(datasetIdentity);

  if (!datasetIdentity) {
    await redis
      .multi()
      .del(redisKeys.report(sessionId, scope, reportId))
      .zrem(redisKeys.reportsByScope(sessionId, scope), reportId)
      .exec();
    return { status: "ok" as const, report };
  }
  if (!report.investigationCaseId) {
    return { status: "conflict" as const };
  }

  const lifetime = await getDatasetMutationLifetime(sessionId, datasetIdentity);

  if (lifetime.status !== "ready") {
    return lifetime;
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const investigation = await getDatasetInvestigation(
      sessionId,
      report.investigationCaseId,
      datasetIdentity,
    );
    const updatedAt = new Date().toISOString();
    const updatedInvestigation = investigation
      ? {
          ...investigation,
          version: investigation.version + 1,
          status: "Validation ready" as const,
          reportId: null,
          updatedAt,
        }
      : {};
    const mutationStatus = await deleteReportAtomically({
      keys: [
        redisKeys.report(sessionId, scope, reportId),
        redisKeys.reportsByScope(sessionId, scope),
        redisKeys.reportByInvestigation(
          sessionId,
          datasetIdentity,
          report.investigationCaseId,
        ),
        redisKeys.investigation(
          sessionId,
          datasetIdentity,
          report.investigationCaseId,
        ),
        redisKeys.investigationsByDataset(sessionId, datasetIdentity),
        redisKeys.datasetSession(sessionId, datasetIdentity),
      ],
      updatedInvestigation,
      runtimeSessionId: sessionId,
      datasetIdentity,
      reportId,
      investigationId: report.investigationCaseId,
      expectedVersion: investigation?.version ?? 0,
      expiresAt: lifetime.expiresAt,
      investigationScore: Date.parse(updatedAt),
    });

    if (mutationStatus === "ok") {
      return { status: "ok" as const, report };
    }

    if (mutationStatus !== "conflict") {
      return {
        status: mutationStatus as Exclude<
          ReportMutationResult["status"],
          "ok"
        >,
      };
    }
  }

  return { status: "conflict" as const };
}
