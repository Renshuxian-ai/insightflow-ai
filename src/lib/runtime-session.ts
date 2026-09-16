export const RUNTIME_SESSION_HEADER = "x-insightflow-runtime-session";

const RUNTIME_SESSION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isRuntimeSessionId(value: unknown): value is string {
  return typeof value === "string" && RUNTIME_SESSION_ID_PATTERN.test(value);
}

export function getRuntimeSessionId(request: Request) {
  const value = request.headers.get(RUNTIME_SESSION_HEADER);
  return isRuntimeSessionId(value) ? value : null;
}
