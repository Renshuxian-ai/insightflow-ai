"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useAppShellState } from "@/components/layout/app-shell-state";
import {
  getSemanticSchemaUnderstandings,
  type SemanticFieldUnderstanding,
} from "@/lib/datasets/semantic/auto-use-policy";
import { getSemanticTypeDefinition } from "@/lib/datasets/semantic/semantic-type-registry";
import type {
  SemanticAutoUsePolicyResult,
  SemanticFieldMapping,
  SemanticFieldReviewEvidence,
  SemanticMappingValue,
  SemanticSchema,
} from "@/lib/datasets/semantic/types";
import type { DatasetSchema } from "@/lib/datasets/types";

import { SemanticFieldReview } from "./semantic-field-review";

export type SemanticReviewFilter =
  | "required"
  | "optional"
  | "changed-by-you"
  | "unresolved"
  | "all";

export type SemanticReviewWorkspaceProps = {
  isOpen: boolean;
  isExpanded: boolean;
  onExpandedChange: (isExpanded: boolean) => void;
  onRequestClose: () => void;
  schema: SemanticSchema;
  physicalSchema: DatasetSchema;
  autoUsePolicy: SemanticAutoUsePolicyResult;
  fieldEvidence: SemanticFieldReviewEvidence[];
  activeFilter: SemanticReviewFilter;
  onActiveFilterChange: (filter: SemanticReviewFilter) => void;
  activeFieldKey: string | null;
  onActiveFieldChange: (stableFieldKey: string | null) => void;
  onUseSuggestion: (field: SemanticFieldMapping) => void;
  onEdit: (
    field: SemanticFieldMapping,
    value: SemanticMappingValue,
  ) => void;
  onExclude: (field: SemanticFieldMapping, reason: string) => void;
  onMarkUnresolved: (field: SemanticFieldMapping) => void;
  onResetDecision: (field: SemanticFieldMapping) => void;
};

const filterOptions: Array<{
  value: SemanticReviewFilter;
  label: string;
}> = [
  { value: "required", label: "Required" },
  { value: "optional", label: "Optional" },
  { value: "changed-by-you", label: "Changed by you" },
  { value: "unresolved", label: "Unresolved" },
  { value: "all", label: "All" },
];

function getFieldStatus(
  field: SemanticFieldMapping,
  understanding: SemanticFieldUnderstanding,
): { label: string; className: string } {
  switch (field.resolution.status) {
    case "accepted":
      break;
    case "edited":
      return {
        label: "Changed by you",
        className: "bg-[#edf1ff] text-[#5269bf]",
      };
    case "excluded":
      return {
        label: "Not used",
        className: "bg-[#f1f3f7] text-[#667085]",
      };
    case "unresolved":
      return {
        label: "Unresolved",
        className: "bg-[#fff6df] text-[#8a5b00]",
      };
    case "suggested":
      break;
  }

  if (understanding.isBlocking) {
    return {
      label: "Required",
      className: "bg-[#fff0ef] text-[#a44848]",
    };
  }

  if (
    understanding.status === "needs-review" ||
    understanding.status === "meaning-unclear"
  ) {
    return {
      label: "Optional",
      className: "bg-[#fff6df] text-[#8a5b00]",
    };
  }

  return {
    label: "Ready to use",
    className: "bg-[#eaf8f0] text-[#27714b]",
  };
}

function isFieldInFilter(
  field: SemanticFieldMapping,
  understanding: SemanticFieldUnderstanding,
  filter: SemanticReviewFilter,
): boolean {
  if (filter === "all") {
    return true;
  }

  if (filter === "unresolved") {
    return field.resolution.status === "unresolved";
  }

  if (filter === "changed-by-you") {
    return field.resolution.status === "edited";
  }

  if (filter === "required") {
    return understanding.isBlocking;
  }

  return Boolean(
    field.resolution.status === "suggested" &&
      !understanding.isBlocking &&
      (understanding.status === "needs-review" ||
        understanding.status === "meaning-unclear"),
  );
}

function getFieldMeaning(
  field: SemanticFieldMapping,
  understanding: SemanticFieldUnderstanding,
): string {
  const mapping = understanding.effectiveMapping ?? field.suggestion;

  if (!mapping || mapping.semanticType === "unknown") {
    return "Meaning unclear";
  }

  return (
    mapping.businessMeaning ??
    getSemanticTypeDefinition(mapping.semanticType).label
  );
}

function normalizeSearchValue(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export function SemanticReviewWorkspace({
  isOpen,
  isExpanded,
  onExpandedChange,
  onRequestClose,
  schema,
  physicalSchema,
  autoUsePolicy,
  fieldEvidence,
  activeFilter,
  onActiveFilterChange,
  activeFieldKey,
  onActiveFieldChange,
  onUseSuggestion,
  onEdit,
  onExclude,
  onMarkUnresolved,
  onResetDecision,
}: SemanticReviewWorkspaceProps) {
  const { setFocusMode } = useAppShellState();
  const [searchQuery, setSearchQuery] = useState("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const understandings = useMemo(
    () => getSemanticSchemaUnderstandings(schema, autoUsePolicy),
    [autoUsePolicy, schema],
  );
  const physicalFieldsByKey = useMemo(
    () =>
      new Map(
        physicalSchema.fields.map((field) => [field.stableFieldKey, field]),
      ),
    [physicalSchema.fields],
  );
  const evidenceByKey = useMemo(
    () =>
      new Map(
        fieldEvidence.map((evidence) => [evidence.stableFieldKey, evidence]),
      ),
    [fieldEvidence],
  );

  const normalizedSearch = normalizeSearchValue(searchQuery);
  const visibleFields = useMemo(
    () =>
      schema.fields.filter((field) => {
        const understanding = understandings.get(field.stableFieldKey);

        if (
          !understanding ||
          !isFieldInFilter(field, understanding, activeFilter)
        ) {
          return false;
        }

        if (!normalizedSearch) {
          return true;
        }

        return normalizeSearchValue(
          `${field.originalName} ${getFieldMeaning(field, understanding)}`,
        ).includes(normalizedSearch);
      }),
    [activeFilter, normalizedSearch, schema.fields, understandings],
  );

  const selectedField = useMemo(
    () =>
      schema.fields.find((field) => {
        const understanding = understandings.get(field.stableFieldKey);

        return Boolean(
          field.stableFieldKey === activeFieldKey &&
            understanding &&
            isFieldInFilter(field, understanding, activeFilter),
        );
      }) ?? null,
    [activeFieldKey, activeFilter, schema.fields, understandings],
  );
  const selectedUnderstanding = selectedField
    ? (understandings.get(selectedField.stableFieldKey) ?? null)
    : null;
  const selectedPhysicalField = selectedField
    ? (physicalFieldsByKey.get(selectedField.stableFieldKey) ?? null)
    : null;
  const selectedEvidence = selectedField
    ? (evidenceByKey.get(selectedField.stableFieldKey) ?? null)
    : null;
  const requiredFields = schema.fields.filter(
    (field) => understandings.get(field.stableFieldKey)?.isBlocking,
  );
  const optionalFields = schema.fields.filter((field) => {
    const understanding = understandings.get(field.stableFieldKey);

    return Boolean(
      understanding && isFieldInFilter(field, understanding, "optional"),
    );
  });

  const requestDiscard = useCallback(() => {
    if (!hasUnsavedChanges) {
      return true;
    }

    return window.confirm(
      "Discard the unsaved changes for this field?",
    );
  }, [hasUnsavedChanges]);

  const requestClose = useCallback(() => {
    if (!requestDiscard()) {
      return;
    }

    setHasUnsavedChanges(false);
    onRequestClose();
  }, [onRequestClose, requestDiscard]);

  const requestFieldChange = useCallback(
    (nextFieldKey: string) => {
      if (nextFieldKey === activeFieldKey) {
        return;
      }

      if (!requestDiscard()) {
        return;
      }

      setHasUnsavedChanges(false);
      onActiveFieldChange(nextFieldKey);
    },
    [activeFieldKey, onActiveFieldChange, requestDiscard],
  );

  function requestFilterChange(nextFilter: SemanticReviewFilter) {
    if (nextFilter === activeFilter || !requestDiscard()) {
      return;
    }

    const nextField = schema.fields.find((field) => {
      const understanding = understandings.get(field.stableFieldKey);

      return Boolean(
        understanding && isFieldInFilter(field, understanding, nextFilter),
      );
    });

    setHasUnsavedChanges(false);
    onActiveFilterChange(nextFilter);
    onActiveFieldChange(nextField?.stableFieldKey ?? null);
  }

  useEffect(() => {
    setFocusMode(isOpen && isExpanded);
  }, [isExpanded, isOpen, setFocusMode]);

  useEffect(
    () => () => {
      setFocusMode(false);
    },
    [setFocusMode],
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      requestClose();
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, requestClose]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const animationFrame = window.requestAnimationFrame(() =>
      searchInputRef.current?.focus(),
    );

    return () => window.cancelAnimationFrame(animationFrame);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || selectedField) {
      return;
    }

    onActiveFieldChange(visibleFields[0]?.stableFieldKey ?? null);
  }, [isOpen, onActiveFieldChange, selectedField, visibleFields]);

  if (!isOpen) {
    return null;
  }

  function advanceAfterDecision(currentField: SemanticFieldMapping) {
    const activeTaskFields = schema.fields.filter((field) => {
      const understanding = understandings.get(field.stableFieldKey);

      return Boolean(
        understanding && isFieldInFilter(field, understanding, activeFilter),
      );
    });
    const currentIndex = activeTaskFields.findIndex(
      (field) => field.stableFieldKey === currentField.stableFieldKey,
    );
    const remainingTaskFields = activeTaskFields.filter(
      (field) => field.stableFieldKey !== currentField.stableFieldKey,
    );
    const nextField =
      remainingTaskFields.find(
        (field) => field.fieldIndex > currentField.fieldIndex,
      ) ??
      remainingTaskFields[0] ??
      null;

    setHasUnsavedChanges(false);

    if (currentIndex >= 0) {
      onActiveFieldChange(nextField?.stableFieldKey ?? null);
    }
  }

  function handleUseSuggestion(field: SemanticFieldMapping) {
    onUseSuggestion(field);
    advanceAfterDecision(field);
  }

  function handleEdit(
    field: SemanticFieldMapping,
    value: SemanticMappingValue,
  ) {
    onEdit(field, value);
    advanceAfterDecision(field);
  }

  function handleExclude(field: SemanticFieldMapping, reason: string) {
    onExclude(field, reason);
    advanceAfterDecision(field);
  }

  function handleMarkUnresolved(field: SemanticFieldMapping) {
    onMarkUnresolved(field);
    advanceAfterDecision(field);
  }

  function handleResetDecision(field: SemanticFieldMapping) {
    onResetDecision(field);
    setHasUnsavedChanges(false);
  }

  const dialogClassName = isExpanded
    ? "h-dvh w-full rounded-none"
    : "h-[min(46rem,calc(100dvh-2rem))] w-full max-w-5xl rounded-2xl sm:h-[min(46rem,calc(100dvh-3rem))]";
  return (
    <div
      className={`fixed inset-0 z-[70] flex bg-[#172033]/35 ${
        isExpanded ? "p-0" : "items-center justify-center p-3 sm:p-6"
      }`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isExpanded) {
          requestClose();
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="field-review-workspace-title"
        className={`${dialogClassName} flex min-h-0 flex-col overflow-hidden border border-[#dfe4ec] bg-white shadow-[0_24px_80px_rgba(23,32,51,0.24)]`}
      >
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-[#e6e9ef] px-4 py-3.5 sm:px-5">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#6072b8]">
              Field Understanding
            </p>
            <h2
              id="field-review-workspace-title"
              className="mt-0.5 truncate text-base font-semibold text-[#172033]"
            >
              Review field meanings
            </h2>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => onExpandedChange(!isExpanded)}
              className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-[#d8deea] bg-white px-3 text-xs font-semibold text-[#526078] transition-colors hover:border-[#b9c4d8] hover:text-[#263247]"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="none"
                className="size-4"
              >
                <path
                  d={
                    isExpanded
                      ? "M7.5 3.5v4h-4M12.5 16.5v-4h4M3.5 7.5l4-4M16.5 12.5l-4 4"
                      : "M7.5 7.5h-4v-4M12.5 12.5h4v4M3.5 3.5l4 4M16.5 16.5l-4-4"
                  }
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {isExpanded ? "Restore" : "Expand"}
            </button>
            <button
              type="button"
              aria-label="Close field review"
              onClick={requestClose}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-[#758095] transition-colors hover:bg-[#f1f3f7] hover:text-[#263247]"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="none"
                className="size-4"
              >
                <path
                  d="m5 5 10 10M15 5 5 15"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
              <span className="hidden sm:inline">Close</span>
            </button>
          </div>
        </header>

        <div
          className={`grid min-h-0 flex-1 ${
            isExpanded
              ? "lg:grid-cols-[19rem_minmax(0,1fr)]"
              : "md:grid-cols-[15rem_minmax(0,1fr)]"
          }`}
        >
          <aside className="flex min-h-0 flex-col border-b border-[#e6e9ef] bg-[#fafbfc] md:border-r md:border-b-0">
            <div className="shrink-0 space-y-3 border-b border-[#e6e9ef] p-3.5">
              <label className="relative block">
                <span className="sr-only">Search fields</span>
                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  fill="none"
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#8a94a6]"
                >
                  <circle
                    cx="8.5"
                    cy="8.5"
                    r="4.75"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                  <path
                    d="m12.25 12.25 4 4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
                <input
                  ref={searchInputRef}
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search fields"
                  className="h-10 w-full rounded-lg border border-[#dfe4ec] bg-white pr-3 pl-9 text-sm text-[#263247] outline-none placeholder:text-[#9aa3b2] focus:border-[#8298ef] focus:ring-2 focus:ring-[#3559e8]/10"
                />
              </label>

              <div className="flex flex-wrap gap-1.5" aria-label="Field filters">
                {filterOptions.map((option) => {
                  const isActive = activeFilter === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => requestFilterChange(option.value)}
                      className={`rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
                        isActive
                          ? "bg-[#e9edff] text-[#3559e8]"
                          : "bg-white text-[#657084] hover:bg-[#f1f3f7] hover:text-[#344056]"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
              {visibleFields.length > 0 ? (
                <ul className="space-y-1">
                  {visibleFields.map((field) => {
                    const understanding = understandings.get(
                      field.stableFieldKey,
                    );

                    if (!understanding) {
                      return null;
                    }

                    const status = getFieldStatus(field, understanding);
                    const isSelected =
                      field.stableFieldKey === activeFieldKey;

                    return (
                      <li key={field.stableFieldKey}>
                        <button
                          type="button"
                          onClick={() =>
                            requestFieldChange(field.stableFieldKey)
                          }
                          className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${
                            isSelected
                              ? "border-[#bdc9f7] bg-[#f1f4ff] shadow-sm"
                              : "border-transparent hover:border-[#e2e6ed] hover:bg-white"
                          }`}
                        >
                          <span className="block truncate text-xs font-semibold text-[#263247]">
                            {field.originalName}
                          </span>
                          <span className="mt-1 block truncate text-[11px] text-[#778196]">
                            {getFieldMeaning(field, understanding)}
                          </span>
                          <span className="mt-2 flex flex-wrap gap-1">
                            <span
                              className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold ${status.className}`}
                            >
                              {status.label}
                            </span>
                            {understanding.isBlocking &&
                            status.label !== "Required" ? (
                              <span className="inline-flex rounded bg-[#fff0ef] px-1.5 py-0.5 text-[10px] font-semibold text-[#a44848]">
                                Required
                              </span>
                            ) : null}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="px-3 py-8 text-center">
                  <p className="text-xs font-semibold text-[#526078]">
                    {activeFilter === "required" && requiredFields.length === 0
                      ? "All required fields are resolved"
                      : "No matching fields"}
                  </p>
                  <p className="mt-1 text-[11px] leading-5 text-[#8a94a6]">
                    {activeFilter === "required" && requiredFields.length === 0
                      ? "Optional fields remain available when you choose to review them."
                      : "Try another search or field status."}
                  </p>
                </div>
              )}
            </div>
          </aside>

          <main className="min-h-0 overflow-y-auto bg-[#f7f8fa] p-3.5 sm:p-5">
            {activeFilter === "required" && requiredFields.length === 0 ? (
              <div className="grid h-full min-h-52 place-items-center">
                <div className="max-w-sm text-center">
                  <p className="text-base font-semibold text-[#263247]">
                    All required fields are resolved
                  </p>
                  <p className="mt-2 text-xs leading-5 text-[#7e8798]">
                    {optionalFields.length > 0
                      ? "You can review optional fields now or finish for now."
                      : "You can finish for now."}
                  </p>
                  {optionalFields.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => requestFilterChange("optional")}
                      className="mt-3 px-2 py-2 text-xs font-semibold text-[#6072b8] underline-offset-4 hover:text-[#3559e8] hover:underline"
                    >
                      Review optional fields
                    </button>
                  ) : null}
                </div>
              </div>
            ) : selectedField &&
            selectedUnderstanding &&
            selectedPhysicalField ? (
              <div className="mx-auto max-w-3xl">
                <SemanticFieldReview
                  key={selectedField.stableFieldKey}
                  mapping={selectedField}
                  physicalField={selectedPhysicalField}
                  understanding={selectedUnderstanding}
                  evidence={selectedEvidence}
                  readOnly={schema.status === "confirmed"}
                  onUseSuggestion={() => handleUseSuggestion(selectedField)}
                  onEdit={(value) => handleEdit(selectedField, value)}
                  onExclude={(reason) => handleExclude(selectedField, reason)}
                  onMarkUnresolved={() =>
                    handleMarkUnresolved(selectedField)
                  }
                  onResetDecision={() => handleResetDecision(selectedField)}
                  onDirtyChange={setHasUnsavedChanges}
                />
              </div>
            ) : (
              <div className="grid h-full min-h-52 place-items-center">
                <div className="max-w-sm text-center">
                  <p className="text-sm font-semibold text-[#344056]">
                    Select a field to review
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[#7e8798]">
                    Choose a field from the list to inspect its suggested meaning and available evidence.
                  </p>
                </div>
              </div>
            )}
          </main>
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-4 border-t border-[#e6e9ef] bg-white px-4 py-3 sm:px-5">
          <div className="text-xs text-[#778196]" aria-live="polite">
            <p className="font-medium text-[#526078]">
              {requiredFields.length === 0
                ? "No required fields remaining"
                : `${requiredFields.length} required ${
                    requiredFields.length === 1 ? "field" : "fields"
                  } remaining`}
            </p>
            {optionalFields.length > 0 ? (
              <p className="mt-0.5">
                {optionalFields.length} optional {optionalFields.length === 1 ? "field" : "fields"} can be reviewed later
              </p>
            ) : null}
          </div>
        </footer>
      </section>
    </div>
  );
}
