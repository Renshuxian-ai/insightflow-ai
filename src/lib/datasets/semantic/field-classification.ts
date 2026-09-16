const CONDITIONAL_COHORT_DATE_FIELD_NAMES = new Set([
  "cohort_date",
  "cohort_start_date",
  "cohort_start",
  "acquisition_date",
  "signup_date",
  "first_active_date",
]);

function normalizeFieldName(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function isConditionalCohortDateFieldName(value: string): boolean {
  return CONDITIONAL_COHORT_DATE_FIELD_NAMES.has(normalizeFieldName(value));
}
