import { isRuntimeSessionId } from "@/lib/runtime-session";

export const DATASET_MODE_COOKIE = "insightflow_dataset_mode";

export function getDatasetModeRuntimeSessionId(
  datasetModeMarker: unknown,
): string | null {
  return isRuntimeSessionId(datasetModeMarker) ? datasetModeMarker : null;
}
