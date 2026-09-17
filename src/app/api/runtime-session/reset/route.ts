import { cookies } from "next/headers";

import { DATASET_ANALYTICS_SESSION_COOKIE } from "@/lib/analytics/dataset-context/session-store";
import {
  DATASET_MODE_COOKIE,
  getDatasetModeRuntimeSessionId,
} from "@/lib/datasets/dataset-mode";
import { deleteDatasetLifecycle } from "@/lib/redis/reset-dataset-lifecycle";
import { REPORT_SESSION_COOKIE } from "@/lib/reports/session-report-store";

export async function POST() {
  const cookieStore = await cookies();
  const runtimeSessionId = getDatasetModeRuntimeSessionId(
    cookieStore.get(DATASET_MODE_COOKIE)?.value,
  );
  let sharedStateDeleted = false;

  if (runtimeSessionId) {
    try {
      await deleteDatasetLifecycle(runtimeSessionId);
      sharedStateDeleted = true;
    } catch {
      // Explicit cookie reset must remain available while Redis is down.
      // Any shared keys that could not be removed still expire automatically.
    }
  }

  cookieStore.delete(DATASET_MODE_COOKIE);
  cookieStore.delete(DATASET_ANALYTICS_SESSION_COOKIE);
  cookieStore.delete(REPORT_SESSION_COOKIE);

  return Response.json(
    { reset: true, sharedStateDeleted },
    { headers: { "Cache-Control": "no-store" } },
  );
}