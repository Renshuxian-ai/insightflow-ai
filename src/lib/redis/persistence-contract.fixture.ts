import { redisKeys } from "./keys";
import {
  DATASET_MARKER_GRACE_SECONDS,
  DATASET_SESSION_TTL_SECONDS,
  DatasetPersistenceSizeError,
  MAX_PERSISTED_DATASET_SESSION_BYTES,
  assertPersistedDatasetSessionSize,
  createDatasetLifetime,
  getUtf8JsonSize,
} from "./lifecycle";

function assertFixture(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Redis persistence contract fixture failed: ${message}`);
  }
}

export function runRedisPersistenceContractFixture() {
  const runtimeSessionId = "00000000-0000-4000-8000-000000000000";
  const datasetIdentity = "dataset-identity";
  const investigationId = "signal:retention";
  const reportId = "report:signal:retention";
  const lifetime = createDatasetLifetime(0);

  assertFixture(
    redisKeys.datasetSession(runtimeSessionId, datasetIdentity) ===
      `if:v1:dataset-session:${runtimeSessionId}:${datasetIdentity}`,
    "Dataset session keys must retain the versioned namespace.",
  );
  assertFixture(
    redisKeys.investigation(
      runtimeSessionId,
      datasetIdentity,
      investigationId,
    ) ===
      `if:v1:investigation:${runtimeSessionId}:${datasetIdentity}:signal%3Aretention`,
    "dynamic key segments must be escaped deterministically.",
  );
  assertFixture(
    redisKeys.report(
      runtimeSessionId,
      `dataset:${datasetIdentity}`,
      reportId,
    ).startsWith("if:v1:report:"),
    "Report keys must retain the versioned namespace.",
  );
  assertFixture(
    Date.parse(lifetime.expiresAt) - Date.parse(lifetime.createdAt) ===
      DATASET_SESSION_TTL_SECONDS * 1_000,
    "Dataset expiration must be an absolute six-hour window.",
  );
  assertFixture(
    DATASET_MARKER_GRACE_SECONDS === 30 * 60,
    "Dataset metadata must retain a thirty-minute expiration evidence window.",
  );
  assertFixture(
    getUtf8JsonSize({ value: "数据" }) > JSON.stringify({ value: "数据" }).length,
    "serialization limits must count UTF-8 bytes rather than characters.",
  );
  assertFixture(
    assertPersistedDatasetSessionSize({ ok: true }) > 0,
    "small derived sessions must pass the size guard.",
  );

  let rejected = false;

  try {
    assertPersistedDatasetSessionSize({
      value: "x".repeat(MAX_PERSISTED_DATASET_SESSION_BYTES),
    });
  } catch (error) {
    rejected = error instanceof DatasetPersistenceSizeError;
  }

  assertFixture(rejected, "oversized sessions must be rejected before Redis.");
  return { keys: 3, ttlSeconds: DATASET_SESSION_TTL_SECONDS };
}
