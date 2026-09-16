export const DIAGNOSTIC_RETURN_TO_QUERY_PARAM = "returnTo";

const DIAGNOSTIC_RETURN_TARGETS = {
  "/": "Overview",
  "/analytics/trends": "Trends",
  "/analytics/funnels": "Funnels",
  "/analytics/retention": "Retention",
  "/feedback": "Feedback",
  "/investigations": "Investigations",
} as const;

export type DiagnosticReturnPath = keyof typeof DIAGNOSTIC_RETURN_TARGETS;

export type DiagnosticReturnTarget = {
  href: DiagnosticReturnPath;
  label: (typeof DIAGNOSTIC_RETURN_TARGETS)[DiagnosticReturnPath];
};

export function getDiagnosticReturnTarget(
  value: string | string[] | undefined,
): DiagnosticReturnTarget {
  const candidate = Array.isArray(value) ? value[0] : value;

  if (
    candidate &&
    Object.prototype.hasOwnProperty.call(DIAGNOSTIC_RETURN_TARGETS, candidate)
  ) {
    const href = candidate as DiagnosticReturnPath;

    return {
      href,
      label: DIAGNOSTIC_RETURN_TARGETS[href],
    };
  }

  return {
    href: "/",
    label: "Overview",
  };
}

export function withDiagnosticReturnTo(
  href: string,
  returnTo: DiagnosticReturnPath,
) {
  const url = new URL(href, "https://insightflow.local");

  if (url.origin !== "https://insightflow.local") {
    throw new Error("Diagnostic navigation href must be an internal path.");
  }

  url.searchParams.set(DIAGNOSTIC_RETURN_TO_QUERY_PARAM, returnTo);
  return `${url.pathname}${url.search}${url.hash}`;
}
