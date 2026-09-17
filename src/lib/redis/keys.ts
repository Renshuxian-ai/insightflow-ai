const KEY_PREFIX = "if:v1";

function segment(value: string) {
  return encodeURIComponent(value);
}

export type ReportScope = `dataset:${string}` | "demo";

export const redisKeys = {
  datasetCurrent(runtimeSessionId: string) {
    return `${KEY_PREFIX}:dataset-current:${segment(runtimeSessionId)}`;
  },
  datasetMeta(runtimeSessionId: string, datasetIdentity: string) {
    return `${KEY_PREFIX}:dataset-meta:${segment(runtimeSessionId)}:${segment(datasetIdentity)}`;
  },
  datasetSession(runtimeSessionId: string, datasetIdentity: string) {
    return `${KEY_PREFIX}:dataset-session:${segment(runtimeSessionId)}:${segment(datasetIdentity)}`;
  },
  investigation(
    runtimeSessionId: string,
    datasetIdentity: string,
    investigationId: string,
  ) {
    return `${KEY_PREFIX}:investigation:${segment(runtimeSessionId)}:${segment(datasetIdentity)}:${segment(investigationId)}`;
  },
  investigationsByDataset(
    runtimeSessionId: string,
    datasetIdentity: string,
  ) {
    return `${KEY_PREFIX}:investigations-by-dataset:${segment(runtimeSessionId)}:${segment(datasetIdentity)}`;
  },
  investigationByFingerprint(
    runtimeSessionId: string,
    datasetIdentity: string,
    signalFingerprint: string,
  ) {
    return `${KEY_PREFIX}:investigation-by-fingerprint:${segment(runtimeSessionId)}:${segment(datasetIdentity)}:${segment(signalFingerprint)}`;
  },
  report(runtimeSessionId: string, scope: ReportScope, reportId: string) {
    return `${KEY_PREFIX}:report:${segment(runtimeSessionId)}:${segment(scope)}:${segment(reportId)}`;
  },
  reportsByScope(runtimeSessionId: string, scope: ReportScope) {
    return `${KEY_PREFIX}:reports-by-scope:${segment(runtimeSessionId)}:${segment(scope)}`;
  },
  reportByInvestigation(
    runtimeSessionId: string,
    datasetIdentity: string,
    investigationId: string,
  ) {
    return `${KEY_PREFIX}:report-by-investigation:${segment(runtimeSessionId)}:${segment(datasetIdentity)}:${segment(investigationId)}`;
  },
};

export function getDatasetReportScope(datasetIdentity: string): ReportScope {
  return `dataset:${datasetIdentity}`;
}