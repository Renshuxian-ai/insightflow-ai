export const DATASET_SESSION_TTL_SECONDS = 6 * 60 * 60;
export const DATASET_MARKER_GRACE_SECONDS = 30 * 60;
export const DATASET_MARKER_TTL_SECONDS =
  DATASET_SESSION_TTL_SECONDS + DATASET_MARKER_GRACE_SECONDS;
export const DEMO_REPORT_TTL_SECONDS = 6 * 60 * 60;
export const MAX_PERSISTED_DATASET_SESSION_BYTES = 3 * 1024 * 1024;

export class DatasetPersistenceSizeError extends Error {
  constructor(readonly size: number) {
    super(
      `The derived Dataset session is ${size} bytes and exceeds the ${MAX_PERSISTED_DATASET_SESSION_BYTES}-byte persistence limit.`,
    );
    this.name = "DatasetPersistenceSizeError";
  }
}

export type DatasetLifetime = {
  createdAt: string;
  expiresAt: string;
};

export function createDatasetLifetime(now = Date.now()): DatasetLifetime {
  return {
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + DATASET_SESSION_TTL_SECONDS * 1_000).toISOString(),
  };
}

export function toUnixSeconds(value: string) {
  return Math.floor(Date.parse(value) / 1_000);
}

export function getUtf8JsonSize(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

export function assertPersistedDatasetSessionSize(value: unknown) {
  const size = getUtf8JsonSize(value);

  if (size > MAX_PERSISTED_DATASET_SESSION_BYTES) {
    throw new DatasetPersistenceSizeError(size);
  }

  return size;
}
