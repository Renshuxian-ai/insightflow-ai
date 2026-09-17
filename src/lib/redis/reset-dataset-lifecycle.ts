import "server-only";

import type { DatasetInvestigationRecord } from "@/lib/investigations/dataset-investigation-store";
import type { ProductReport } from "@/lib/reports/mock-reports";

import { getRedisClient } from "./client";
import { getDatasetReportScope, redisKeys } from "./keys";

export async function deleteDatasetLifecycle(runtimeSessionId: string) {
  const redis = getRedisClient();
  const currentKey = redisKeys.datasetCurrent(runtimeSessionId);
  const datasetIdentity = await redis.get<string>(currentKey);

  if (!datasetIdentity || typeof datasetIdentity !== "string") {
    await redis.del(currentKey);
    return;
  }

  const investigationIndexKey = redisKeys.investigationsByDataset(
    runtimeSessionId,
    datasetIdentity,
  );
  const reportScope = getDatasetReportScope(datasetIdentity);
  const reportIndexKey = redisKeys.reportsByScope(
    runtimeSessionId,
    reportScope,
  );
  const [investigationIds, reportIds] = await Promise.all([
    redis.zrange<string[]>(investigationIndexKey, 0, -1),
    redis.zrange<string[]>(reportIndexKey, 0, -1),
  ]);
  const investigationRecords =
    investigationIds.length > 0
      ? await redis.mget<(DatasetInvestigationRecord | null)[]>(
          ...investigationIds.map((id) =>
            redisKeys.investigation(runtimeSessionId, datasetIdentity, id),
          ),
        )
      : [];
  const reports =
    reportIds.length > 0
      ? await redis.mget<(ProductReport | null)[]>(
          ...reportIds.map((id) =>
            redisKeys.report(runtimeSessionId, reportScope, id),
          ),
        )
      : [];
  const transaction = redis
    .multi()
    .del(currentKey)
    .del(redisKeys.datasetMeta(runtimeSessionId, datasetIdentity))
    .del(redisKeys.datasetSession(runtimeSessionId, datasetIdentity))
    .del(investigationIndexKey)
    .del(reportIndexKey);

  for (const record of investigationRecords) {
    if (!record) {
      continue;
    }

    transaction
      .del(
        redisKeys.investigation(
          runtimeSessionId,
          datasetIdentity,
          record.id,
        ),
      )
      .del(
        redisKeys.investigationByFingerprint(
          runtimeSessionId,
          datasetIdentity,
          record.signalFingerprint,
        ),
      )
      .del(
        redisKeys.reportByInvestigation(
          runtimeSessionId,
          datasetIdentity,
          record.id,
        ),
      );
  }

  for (const report of reports) {
    if (report) {
      transaction.del(
        redisKeys.report(runtimeSessionId, reportScope, report.id),
      );

      if (report.investigationCaseId) {
        transaction.del(
          redisKeys.reportByInvestigation(
            runtimeSessionId,
            datasetIdentity,
            report.investigationCaseId,
          ),
        );
      }
    }
  }

  await transaction.exec();
}
