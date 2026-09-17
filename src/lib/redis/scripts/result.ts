export type AtomicMutationStatus =
  | "created"
  | "existing"
  | "ok"
  | "not-found"
  | "conflict"
  | "expired";

const ATOMIC_MUTATION_STATUSES = new Set<AtomicMutationStatus>([
  "created",
  "existing",
  "ok",
  "not-found",
  "conflict",
  "expired",
]);

export function parseAtomicMutationStatus(
  value: unknown,
): AtomicMutationStatus {
  if (
    typeof value !== "string" ||
    !ATOMIC_MUTATION_STATUSES.has(value as AtomicMutationStatus)
  ) {
    throw new Error("Redis returned an invalid lifecycle mutation result.");
  }

  return value as AtomicMutationStatus;
}
