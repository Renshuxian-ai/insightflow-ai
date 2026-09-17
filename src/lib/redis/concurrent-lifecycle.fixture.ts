import "server-only";

import { randomUUID } from "node:crypto";

import type { AgentTrace } from "@/lib/ai/agent/types";
import { lookupDatasetSession } from "@/lib/analytics/dataset-context/session-store";
import type { DiagnosticCase } from "@/lib/diagnostics/types";
import {
  deleteDatasetInvestigation,
  getDatasetInvestigation,
  saveDatasetInvestigationCase,
  updateDatasetInvestigation,
  type DatasetInvestigationRecord,
} from "@/lib/investigations/dataset-investigation-store";
import type { InvestigationResult } from "@/lib/investigations/types";
import type { ProductReport } from "@/lib/reports/mock-reports";
import {
  deleteSessionReport,
  saveDatasetReportAndValidateInvestigation,
} from "@/lib/reports/session-report-store";

import { getRedisClient } from "./client";
import { getDatasetReportScope, redisKeys } from "./keys";

function assertFixture(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Concurrent lifecycle fixture failed: ${message}`);
  }
}

function createDiagnosticCase(id: string) {
  return {
    id,
    title: "Concurrent lifecycle fixture",
    summary: { changed: "Fixture signal changed." },
    evidence: { behaviorSignals: [], feedbackSignals: [] },
  } as unknown as DiagnosticCase;
}

function createInvestigationRecord(input: {
  runtimeSessionId: string;
  datasetId: string;
  datasetIdentity: string;
  investigationId: string;
  signalFingerprint: string;
  status: DatasetInvestigationRecord["status"];
  version: number;
  reportId?: string | null;
}) {
  const now = new Date().toISOString();
  return {
    id: input.investigationId,
    runtimeSessionId: input.runtimeSessionId,
    version: input.version,
    datasetId: input.datasetId,
    datasetIdentity: input.datasetIdentity,
    signalFingerprint: input.signalFingerprint,
    source: "dataset",
    sourceLabel: "Retention Analytics",
    signalType: "retention",
    title: "Concurrent lifecycle fixture",
    problem: "Fixture signal changed.",
    evidence: [],
    status: input.status,
    createdAt: now,
    updatedAt: now,
    diagnosticCase: createDiagnosticCase(input.investigationId),
    investigationResult:
      input.status === "Investigating"
        ? null
        : ({ id: `result:${input.investigationId}` } as InvestigationResult),
    investigationTrace: null,
    investigationCreatedAt: now,
    usedModelId: "fixture-model",
    reportId: input.reportId ?? null,
  } satisfies DatasetInvestigationRecord;
}

function createReport(
  datasetIdentity: string,
  investigationId: string,
): ProductReport {
  return {
    id: `report-${investigationId}`,
    datasetIdentity,
    investigationCaseId: investigationId,
    investigationId: `result:${investigationId}`,
    title: "Concurrent lifecycle fixture",
    source: "Retention Analytics",
    status: "Validated",
    createdAt: "2026-09-17",
    updatedAt: "2026-09-17",
    aiSummary: "Fixture report.",
    keyFindings: [],
    recommendedActions: [],
    supportingEvidence: [],
  };
}

async function seedDatasetSession(input: {
  runtimeSessionId: string;
  datasetId: string;
  datasetIdentity: string;
  expiresAt: string;
}) {
  const redis = getRedisClient();
  const expiresAt = Math.floor(Date.parse(input.expiresAt) / 1_000);
  const createdAt = new Date().toISOString();
  const meta = {
    ...input,
    datasetName: "Concurrent lifecycle fixture",
    createdAt,
  };
  const document = {
    ...meta,
    analyticsSession: {
      sessionId: input.runtimeSessionId,
      datasetId: input.datasetId,
      datasetIdentity: input.datasetIdentity,
    },
    overviewRuntime: { version: 1, source: "dataset" },
  };

  await redis
    .multi()
    .set(
      redisKeys.datasetCurrent(input.runtimeSessionId),
      input.datasetIdentity,
      { exat: expiresAt },
    )
    .set(
      redisKeys.datasetMeta(input.runtimeSessionId, input.datasetIdentity),
      meta,
      { exat: expiresAt },
    )
    .set(
      redisKeys.datasetSession(input.runtimeSessionId, input.datasetIdentity),
      document,
      { exat: expiresAt },
    )
    .exec();
}

async function seedInvestigation(record: DatasetInvestigationRecord) {
  const redis = getRedisClient();
  const scope = getDatasetReportScope(record.datasetIdentity);
  const session = await redis.get<{ expiresAt: string }>(
    redisKeys.datasetSession(record.runtimeSessionId, record.datasetIdentity),
  );
  assertFixture(session, "seed Dataset session must exist.");
  const expiresAt = Math.floor(Date.parse(session.expiresAt) / 1_000);
  const transaction = redis
    .multi()
    .set(
      redisKeys.investigation(
        record.runtimeSessionId,
        record.datasetIdentity,
        record.id,
      ),
      record,
      { exat: expiresAt },
    )
    .zadd(
      redisKeys.investigationsByDataset(
        record.runtimeSessionId,
        record.datasetIdentity,
      ),
      { score: Date.parse(record.updatedAt), member: record.id },
    )
    .expireat(
      redisKeys.investigationsByDataset(
        record.runtimeSessionId,
        record.datasetIdentity,
      ),
      expiresAt,
    )
    .set(
      redisKeys.investigationByFingerprint(
        record.runtimeSessionId,
        record.datasetIdentity,
        record.signalFingerprint,
      ),
      record.id,
      { exat: expiresAt },
    );

  if (record.reportId) {
    const report = createReport(record.datasetIdentity, record.id);
    transaction
      .set(
        redisKeys.report(record.runtimeSessionId, scope, report.id),
        report,
        { exat: expiresAt },
      )
      .zadd(
        redisKeys.reportsByScope(record.runtimeSessionId, scope),
        { score: Date.parse(report.updatedAt), member: report.id },
      )
      .expireat(
        redisKeys.reportsByScope(record.runtimeSessionId, scope),
        expiresAt,
      )
      .set(
        redisKeys.reportByInvestigation(
          record.runtimeSessionId,
          record.datasetIdentity,
          record.id,
        ),
        report.id,
        { exat: expiresAt },
      );
  }

  await transaction.exec();
}

async function assertLifecycleAbsent(input: {
  runtimeSessionId: string;
  datasetIdentity: string;
  investigationId: string;
  reportId: string;
}) {
  const redis = getRedisClient();
  const scope = getDatasetReportScope(input.datasetIdentity);
  const [investigation, report, pointer, investigationScore, reportScore] =
    await Promise.all([
      redis.get(
        redisKeys.investigation(
          input.runtimeSessionId,
          input.datasetIdentity,
          input.investigationId,
        ),
      ),
      redis.get(redisKeys.report(input.runtimeSessionId, scope, input.reportId)),
      redis.get(
        redisKeys.reportByInvestigation(
          input.runtimeSessionId,
          input.datasetIdentity,
          input.investigationId,
        ),
      ),
      redis.zscore(
        redisKeys.investigationsByDataset(
          input.runtimeSessionId,
          input.datasetIdentity,
        ),
        input.investigationId,
      ),
      redis.zscore(
        redisKeys.reportsByScope(input.runtimeSessionId, scope),
        input.reportId,
      ),
    ]);

  assertFixture(!investigation, "Investigation must not be resurrected.");
  assertFixture(!report, "orphan Report must not remain.");
  assertFixture(!pointer, "report pointer must not remain.");
  assertFixture(investigationScore === null, "Investigation index must be clear.");
  assertFixture(reportScore === null, "Report index must be clear.");
}

async function cleanupFixture(input: {
  runtimeSessionId: string;
  datasetIdentity: string;
  investigationId: string;
  signalFingerprint: string;
  reportId: string;
}) {
  const redis = getRedisClient();
  const scope = getDatasetReportScope(input.datasetIdentity);
  await redis
    .multi()
    .del(redisKeys.datasetCurrent(input.runtimeSessionId))
    .del(redisKeys.datasetMeta(input.runtimeSessionId, input.datasetIdentity))
    .del(redisKeys.datasetSession(input.runtimeSessionId, input.datasetIdentity))
    .del(
      redisKeys.investigation(
        input.runtimeSessionId,
        input.datasetIdentity,
        input.investigationId,
      ),
    )
    .del(
      redisKeys.investigationByFingerprint(
        input.runtimeSessionId,
        input.datasetIdentity,
        input.signalFingerprint,
      ),
    )
    .del(
      redisKeys.reportByInvestigation(
        input.runtimeSessionId,
        input.datasetIdentity,
        input.investigationId,
      ),
    )
    .del(redisKeys.report(input.runtimeSessionId, scope, input.reportId))
    .del(
      redisKeys.investigationsByDataset(
        input.runtimeSessionId,
        input.datasetIdentity,
      ),
    )
    .del(redisKeys.reportsByScope(input.runtimeSessionId, scope))
    .exec();
}

export async function runConcurrentLifecycleFixture() {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    return {
      skipped: true as const,
      reason: "KV_REST_API_URL and KV_REST_API_TOKEN are not configured.",
    };
  }

  const scenarioResults: string[] = [];

  for (const scenario of ["A", "B", "C", "D", "E"] as const) {
    const suffix = `${scenario.toLowerCase()}-${randomUUID()}`;
    const runtimeSessionId = randomUUID();
    const datasetId = `fixture-dataset-${suffix}`;
    const datasetIdentity = `fixture-identity-${suffix}`;
    const investigationId = `fixture-investigation-${suffix}`;
    const signalFingerprint = investigationId;
    const report = createReport(datasetIdentity, investigationId);
    const fixtureIdentity = {
      runtimeSessionId,
      datasetIdentity,
      investigationId,
      signalFingerprint,
      reportId: report.id,
    };

    try {
      await seedDatasetSession({
        runtimeSessionId,
        datasetId,
        datasetIdentity,
        expiresAt: new Date(Date.now() + 10 * 60 * 1_000).toISOString(),
      });

      if (scenario === "A") {
        const diagnosticCase = createDiagnosticCase(investigationId);
        const results = await Promise.all([
          saveDatasetInvestigationCase({
            sessionId: runtimeSessionId,
            investigationId,
            signalFingerprint,
            datasetId,
            datasetIdentity,
            sourceLabel: "Retention Analytics",
            signalType: "retention",
            diagnosticCase,
          }),
          saveDatasetInvestigationCase({
            sessionId: runtimeSessionId,
            investigationId,
            signalFingerprint,
            datasetId,
            datasetIdentity,
            sourceLabel: "Retention Analytics",
            signalType: "retention",
            diagnosticCase,
          }),
        ]);
        assertFixture(
          results.every((result) => result.status === "ok") &&
            results.filter(
              (result) => result.status === "ok" && result.created,
            ).length === 1,
          "two normal Investigate requests must resolve as created plus existing.",
        );
        const redis = getRedisClient();
        assertFixture(
          (await redis.zcard(
            redisKeys.investigationsByDataset(runtimeSessionId, datasetIdentity),
          )) === 1,
          "normal Investigate concurrency must create one index member.",
        );
        assertFixture(
          (await redis.get(
            redisKeys.investigationByFingerprint(
              runtimeSessionId,
              datasetIdentity,
              signalFingerprint,
            ),
          )) === investigationId,
          "fingerprint pointer must resolve to the exact Investigation.",
        );
      } else {
        const status =
          scenario === "D"
            ? "Investigating"
            : scenario === "E"
              ? "Validated"
              : "Validation ready";
        const seeded = createInvestigationRecord({
          runtimeSessionId,
          datasetId,
          datasetIdentity,
          investigationId,
          signalFingerprint,
          status,
          version: 2,
          reportId: status === "Validated" ? report.id : null,
        });
        await seedInvestigation(seeded);

        if (scenario === "B") {
          const results = await Promise.all([
            saveDatasetReportAndValidateInvestigation({
              sessionId: runtimeSessionId,
              datasetIdentity,
              investigationId,
              report,
            }),
            saveDatasetReportAndValidateInvestigation({
              sessionId: runtimeSessionId,
              datasetIdentity,
              investigationId,
              report,
            }),
          ]);
          assertFixture(
            results.every((result) => result.status === "ok") &&
              results.filter(
                (result) => result.status === "ok" && result.created,
              ).length === 1,
            "two Report generations must resolve as created plus existing.",
          );
          const stored = await getDatasetInvestigation(
            runtimeSessionId,
            investigationId,
            datasetIdentity,
          );
          assertFixture(
            stored?.status === "Validated" && stored.reportId === report.id,
            "Investigation must point to the exact generated Report.",
          );
        }

        if (scenario === "C") {
          await Promise.all([
            saveDatasetReportAndValidateInvestigation({
              sessionId: runtimeSessionId,
              datasetIdentity,
              investigationId,
              report,
            }),
            deleteDatasetInvestigation({
              sessionId: runtimeSessionId,
              datasetIdentity,
              investigationId,
            }),
          ]);
          await assertLifecycleAbsent(fixtureIdentity);
        }

        if (scenario === "D") {
          await Promise.all([
            updateDatasetInvestigation({
              sessionId: runtimeSessionId,
              datasetIdentity,
              investigationId,
              generation: {
                result: { id: `updated:${investigationId}` } as InvestigationResult,
                trace: {} as AgentTrace,
                usedModelId: "fixture-model",
                createdAt: new Date().toISOString(),
              },
            }),
            deleteDatasetInvestigation({
              sessionId: runtimeSessionId,
              datasetIdentity,
              investigationId,
            }),
          ]);
          await assertLifecycleAbsent(fixtureIdentity);
        }

        if (scenario === "E") {
          await Promise.all([
            deleteSessionReport(runtimeSessionId, report.id, datasetIdentity),
            deleteDatasetInvestigation({
              sessionId: runtimeSessionId,
              datasetIdentity,
              investigationId,
            }),
          ]);
          await assertLifecycleAbsent(fixtureIdentity);
        }
      }

      scenarioResults.push(scenario);
    } finally {
      await cleanupFixture(fixtureIdentity);
    }
  }

  const runtimeSessionId = randomUUID();
  const datasetId = `fixture-dataset-session-${randomUUID()}`;
  const datasetIdentity = `fixture-identity-session-${randomUUID()}`;
  const investigationId = `fixture-investigation-session-${randomUUID()}`;
  const signalFingerprint = investigationId;
  const reportId = `report-${investigationId}`;

  try {
    await seedDatasetSession({
      runtimeSessionId,
      datasetId,
      datasetIdentity,
      expiresAt: new Date(Date.now() + 10 * 60 * 1_000).toISOString(),
    });
    await getRedisClient().del(
      redisKeys.datasetSession(runtimeSessionId, datasetIdentity),
    );
    assertFixture(
      (await lookupDatasetSession(runtimeSessionId)).status ===
        "missing-invalid",
      "valid metadata plus a missing session document must not be classified as expired.",
    );
    scenarioResults.push("session-consistency");
  } finally {
    await cleanupFixture({
      runtimeSessionId,
      datasetIdentity,
      investigationId,
      signalFingerprint,
      reportId,
    });
  }

  return { skipped: false as const, scenarios: scenarioResults };
}
