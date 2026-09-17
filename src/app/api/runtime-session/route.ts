import { cookies } from "next/headers";

import {
  DATASET_ANALYTICS_SESSION_COOKIE,
  lookupDatasetSession,
} from "@/lib/analytics/dataset-context/session-store";
import {
  DATASET_MODE_COOKIE,
  getDatasetModeRuntimeSessionId,
} from "@/lib/datasets/dataset-mode";
import {
  DATASET_MARKER_GRACE_SECONDS,
  DEMO_REPORT_TTL_SECONDS,
} from "@/lib/redis/lifecycle";
import { REPORT_SESSION_COOKIE } from "@/lib/reports/session-report-store";
import {
  getRuntimeSessionId,
  isRuntimeSessionId,
} from "@/lib/runtime-session";

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

export async function POST(request: Request) {
  const runtimeSessionId = getRuntimeSessionId(request);

  if (!runtimeSessionId) {
    return Response.json(
      { error: "A valid runtime session is required." },
      { status: 400 },
    );
  }

  const cookieStore = await cookies();
  const datasetModeSessionId = getDatasetModeRuntimeSessionId(
    cookieStore.get(DATASET_MODE_COOKIE)?.value,
  );

  if (!datasetModeSessionId) {
    const existingDemoSessionId = cookieStore.get(REPORT_SESSION_COOKIE)?.value;
    const effectiveRuntimeSessionId = isRuntimeSessionId(existingDemoSessionId)
      ? existingDemoSessionId
      : runtimeSessionId;

    cookieStore.set(REPORT_SESSION_COOKIE, effectiveRuntimeSessionId, {
      ...cookieOptions,
      maxAge: DEMO_REPORT_TTL_SECONDS,
    });

    return Response.json(
      {
        ready: true,
        runtimeSessionId: effectiveRuntimeSessionId,
        mode: "demo",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const lookup = await lookupDatasetSession(datasetModeSessionId);
  const datasetStatus =
    lookup.status === "missing-invalid"
      ? "temporarily-unavailable"
      : lookup.status;
  const remainingSeconds =
    lookup.status === "ready"
      ? Math.max(
          1,
          Math.floor(
            (Date.parse(lookup.session.expiresAt) - Date.now()) / 1_000,
          ) + DATASET_MARKER_GRACE_SECONDS,
        )
      : DATASET_MARKER_GRACE_SECONDS;

  cookieStore.set(DATASET_ANALYTICS_SESSION_COOKIE, datasetModeSessionId, {
    ...cookieOptions,
    maxAge: remainingSeconds,
  });
  cookieStore.set(REPORT_SESSION_COOKIE, datasetModeSessionId, {
    ...cookieOptions,
    maxAge: remainingSeconds,
  });

  return Response.json(
    {
      ready: true,
      runtimeSessionId: datasetModeSessionId,
      mode: "dataset",
      datasetStatus,
      ...(lookup.status === "ready"
        ? {
            datasetIdentity: lookup.session.datasetIdentity,
            datasetName: lookup.session.datasetName,
            overviewRuntime: lookup.session.overviewRuntime,
            expiresAt: lookup.session.expiresAt,
          }
        : {}),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
