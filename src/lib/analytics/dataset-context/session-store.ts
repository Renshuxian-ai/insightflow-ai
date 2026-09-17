import "server-only";

import { randomUUID } from "node:crypto";

import { createAnalyticsDiagnosticCase } from "@/lib/analytics/analytics-diagnostic-adapter";
import { buildDatasetFeedbackInvestigationContext } from "@/lib/analytics/dataset-feedback-investigation-adapter";
import { buildDatasetFunnelInvestigationContext } from "@/lib/analytics/dataset-funnel-investigation-adapter";
import { buildDatasetRetentionInvestigationContext } from "@/lib/analytics/dataset-retention-investigation-adapter";
import type { AnalyticsInvestigationContext } from "@/lib/analytics/investigation-context";
import type { DiagnosticCase } from "@/lib/diagnostics/types";
import { buildDatasetSignalDiagnosticCaseId } from "@/lib/diagnostics/dataset-diagnostic-case";
import { buildAnalyticsSignalFingerprint } from "@/lib/investigations/signal-fingerprint";
import type { OverviewRuntime } from "@/lib/overview/overview-runtime";
import { getRedisClient } from "@/lib/redis/client";
import { redisKeys } from "@/lib/redis/keys";
import {
  DATASET_MARKER_GRACE_SECONDS,
  assertPersistedDatasetSessionSize,
  createDatasetLifetime,
  toUnixSeconds,
  type DatasetLifetime,
} from "@/lib/redis/lifecycle";

import type {
  DatasetAnalyticsContext,
  DatasetAnalyticsSurface,
} from "./types";

export const DATASET_ANALYTICS_SESSION_COOKIE =
  "insightflow_dataset_analytics_session";

export type DatasetAnalyticsSession = {
  sessionId: string;
  datasetId: string;
  datasetIdentity: string;
  analyticsContext: DatasetAnalyticsContext;
  availableSurfaces: DatasetAnalyticsSurface[];
  availableAnalysis: DatasetAnalyticsSurface[];
  missingEvidence: string[];
  limitations: string[];
  investigationContexts: Partial<
    Record<DatasetAnalyticsSurface, AnalyticsInvestigationContext>
  >;
  diagnosticCases: Partial<Record<DatasetAnalyticsSurface, DiagnosticCase>>;
  createdAt: number;
};

export type PersistedDatasetSession = DatasetLifetime & {
  runtimeSessionId: string;
  datasetId: string;
  datasetIdentity: string;
  datasetName: string;
  analyticsSession: DatasetAnalyticsSession;
  overviewRuntime: OverviewRuntime;
};

type PersistedDatasetMeta = DatasetLifetime & {
  runtimeSessionId: string;
  datasetId: string;
  datasetIdentity: string;
  datasetName: string;
};

export type DatasetSessionLookup =
  | { status: "ready"; session: PersistedDatasetSession }
  | { status: "expired" }
  | { status: "temporarily-unavailable" }
  | { status: "missing-invalid" };

function unique(values: readonly string[]) {
  return [...new Set(values)];
}

export function buildDatasetAnalyticsSession(
  analyticsContext: DatasetAnalyticsContext,
  options: {
    requestedSessionId?: string;
    datasetIdentity?: string;
  } = {},
): DatasetAnalyticsSession {
  const datasetIdentity = options.datasetIdentity ?? analyticsContext.datasetId;
  const retention = buildDatasetRetentionInvestigationContext(analyticsContext);
  const funnel = buildDatasetFunnelInvestigationContext(analyticsContext);
  const feedback = buildDatasetFeedbackInvestigationContext(analyticsContext);
  const investigationContexts: DatasetAnalyticsSession["investigationContexts"] = {
    ...(retention ? { retention } : {}),
    ...(funnel ? { funnel } : {}),
    ...(feedback ? { feedback } : {}),
  };
  const diagnosticCases: DatasetAnalyticsSession["diagnosticCases"] = {};

  for (const [surface, context] of Object.entries(investigationContexts)) {
    const diagnosticCase = context
      ? createAnalyticsDiagnosticCase(context, {
          diagnosticCaseId: buildDatasetSignalDiagnosticCaseId(
            buildAnalyticsSignalFingerprint(datasetIdentity, context),
          ),
        })
      : null;

    if (diagnosticCase) {
      diagnosticCases[surface as DatasetAnalyticsSurface] = diagnosticCase;
    }
  }

  const availableAnalysis = Object.keys(
    diagnosticCases,
  ) as DatasetAnalyticsSurface[];
  const missingEvidence = [
    ...(analyticsContext.retentionEvidence?.comparison
      ? retention
        ? []
        : ["Retention evidence does not contain a declining primary signal."]
      : ["Retention current/baseline comparison is unavailable."]),
    ...(analyticsContext.funnelEvidence
      ? funnel
        ? []
        : ["Funnel version baseline is unavailable."]
      : ["Funnel transition evidence is unavailable."]),
    ...(analyticsContext.feedbackEvidence
      ? feedback?.topic.change !== null
        ? []
        : ["Feedback topic trend is unavailable."]
      : ["Feedback topic and quote evidence is unavailable."]),
  ];
  const limitations = unique([
    ...Object.values(investigationContexts).flatMap(
      (context) => context?.datasetEvidence?.limitations ?? [],
    ),
    ...(availableAnalysis.length === 0
      ? ["No supported primary signal can be generated from this dataset."]
      : []),
  ]);
  const now = Date.now();
  const sessionId = options.requestedSessionId ?? randomUUID();
  const session: DatasetAnalyticsSession = {
    sessionId,
    datasetId: analyticsContext.datasetId,
    datasetIdentity,
    analyticsContext,
    availableSurfaces: [...analyticsContext.availableSurfaces],
    availableAnalysis,
    missingEvidence,
    limitations,
    investigationContexts,
    diagnosticCases,
    createdAt: now,
  };

  return session;
}

export function createPersistedDatasetSession(input: {
  analyticsSession: DatasetAnalyticsSession;
  datasetName: string;
  overviewRuntime: OverviewRuntime;
  now?: number;
}): PersistedDatasetSession {
  const lifetime = createDatasetLifetime(input.now);
  const document: PersistedDatasetSession = {
    runtimeSessionId: input.analyticsSession.sessionId,
    datasetId: input.analyticsSession.datasetId,
    datasetIdentity: input.analyticsSession.datasetIdentity,
    datasetName: input.datasetName,
    analyticsSession: input.analyticsSession,
    overviewRuntime: input.overviewRuntime,
    ...lifetime,
  };

  assertPersistedDatasetSessionSize(document);
  return document;
}

export async function persistDatasetSession(
  document: PersistedDatasetSession,
) {
  assertPersistedDatasetSessionSize(document);
  const redis = getRedisClient();
  const dataExpiresAt = toUnixSeconds(document.expiresAt);
  const metadataExpiresAt = dataExpiresAt + DATASET_MARKER_GRACE_SECONDS;
  const meta: PersistedDatasetMeta = {
    runtimeSessionId: document.runtimeSessionId,
    datasetId: document.datasetId,
    datasetIdentity: document.datasetIdentity,
    datasetName: document.datasetName,
    createdAt: document.createdAt,
    expiresAt: document.expiresAt,
  };

  await redis
    .multi()
    .set(
      redisKeys.datasetCurrent(document.runtimeSessionId),
      document.datasetIdentity,
      { exat: metadataExpiresAt },
    )
    .set(
      redisKeys.datasetMeta(
        document.runtimeSessionId,
        document.datasetIdentity,
      ),
      meta,
      { exat: metadataExpiresAt },
    )
    .set(
      redisKeys.datasetSession(
        document.runtimeSessionId,
        document.datasetIdentity,
      ),
      document,
      { exat: dataExpiresAt },
    )
    .exec();
}

function isPersistedDatasetMeta(value: unknown): value is PersistedDatasetMeta {
  if (!value || typeof value !== "object") {
    return false;
  }

  const meta = value as Partial<PersistedDatasetMeta>;
  return (
    typeof meta.runtimeSessionId === "string" &&
    typeof meta.datasetId === "string" &&
    typeof meta.datasetIdentity === "string" &&
    typeof meta.datasetName === "string" &&
    typeof meta.createdAt === "string" &&
    typeof meta.expiresAt === "string" &&
    Number.isFinite(Date.parse(meta.createdAt)) &&
    Number.isFinite(Date.parse(meta.expiresAt))
  );
}

function isPersistedDatasetSession(
  value: unknown,
): value is PersistedDatasetSession {
  if (!isPersistedDatasetMeta(value)) {
    return false;
  }

  const document = value as Partial<PersistedDatasetSession>;
  const analyticsSession = document.analyticsSession as
    | Partial<DatasetAnalyticsSession>
    | undefined;
  const overviewRuntime = document.overviewRuntime as
    | Partial<OverviewRuntime>
    | undefined;
  return (
    Boolean(analyticsSession) &&
    analyticsSession?.sessionId === document.runtimeSessionId &&
    analyticsSession?.datasetId === document.datasetId &&
    analyticsSession?.datasetIdentity === document.datasetIdentity &&
    overviewRuntime?.version === 1 &&
    overviewRuntime.source === "dataset"
  );
}

export async function lookupDatasetSession(
  runtimeSessionId: string,
): Promise<DatasetSessionLookup> {
  try {
    const redis = getRedisClient();
    const datasetIdentity = await redis.get<string>(
      redisKeys.datasetCurrent(runtimeSessionId),
    );

    if (!datasetIdentity || typeof datasetIdentity !== "string") {
      return { status: "missing-invalid" };
    }

    const [meta, document] = await redis.mget<[
      PersistedDatasetMeta | null,
      PersistedDatasetSession | null,
    ]>(
      redisKeys.datasetMeta(runtimeSessionId, datasetIdentity),
      redisKeys.datasetSession(runtimeSessionId, datasetIdentity),
    );

    if (
      !isPersistedDatasetMeta(meta) ||
      meta.runtimeSessionId !== runtimeSessionId ||
      meta.datasetIdentity !== datasetIdentity
    ) {
      return { status: "missing-invalid" };
    }

    if (Date.parse(meta.expiresAt) <= Date.now()) {
      return { status: "expired" };
    }

    if (!document) {
      return { status: "missing-invalid" };
    }

    if (
      !isPersistedDatasetSession(document) ||
      document.runtimeSessionId !== runtimeSessionId ||
      document.datasetIdentity !== datasetIdentity ||
      document.expiresAt !== meta.expiresAt
    ) {
      return { status: "missing-invalid" };
    }

    return { status: "ready", session: document };
  } catch {
    return { status: "temporarily-unavailable" };
  }
}

export async function getPersistedDatasetSession(
  runtimeSessionId: string,
  datasetIdentity: string,
) {
  const lookup = await lookupDatasetSession(runtimeSessionId);

  return lookup.status === "ready" &&
    lookup.session.datasetIdentity === datasetIdentity
    ? lookup.session
    : null;
}

export function selectDatasetDiagnosticCase(
  session: DatasetAnalyticsSession,
  requestedCase: DiagnosticCase,
): DiagnosticCase | null {
  const metricId = requestedCase.metric.id;

  if (metricId.includes("retention")) {
    return session.diagnosticCases.retention ?? null;
  }

  if (metricId.includes("funnel") || metricId.includes("conversion")) {
    return session.diagnosticCases.funnel ?? null;
  }

  if (metricId.includes("feedback")) {
    return session.diagnosticCases.feedback ?? null;
  }

  return (
    session.diagnosticCases.retention ??
    session.diagnosticCases.funnel ??
    session.diagnosticCases.feedback ??
    null
  );
}
