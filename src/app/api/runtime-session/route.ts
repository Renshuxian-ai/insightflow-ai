import { cookies } from "next/headers";

import { DATASET_ANALYTICS_SESSION_COOKIE } from "@/lib/analytics/dataset-context/session-store";
import { REPORT_SESSION_COOKIE } from "@/lib/reports/session-report-store";
import { getRuntimeSessionId } from "@/lib/runtime-session";

export async function POST(request: Request) {
  const runtimeSessionId = getRuntimeSessionId(request);

  if (!runtimeSessionId) {
    return Response.json(
      { error: "A valid runtime session is required." },
      { status: 400 },
    );
  }

  const cookieStore = await cookies();
  const options = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };

  cookieStore.set(DATASET_ANALYTICS_SESSION_COOKIE, runtimeSessionId, options);
  cookieStore.set(REPORT_SESSION_COOKIE, runtimeSessionId, options);

  return Response.json({ ready: true });
}
