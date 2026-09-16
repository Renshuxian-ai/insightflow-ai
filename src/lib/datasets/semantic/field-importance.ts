import type { FieldProfile } from "@/lib/datasets/types";

import { SEMANTIC_TYPE_IDS } from "./semantic-type-registry";
import type {
  SemanticFieldMapping,
  SemanticMappingValue,
} from "./types";
import { isConditionalCohortDateFieldName } from "./field-classification";

export type FieldImportance =
  | "critical"
  | "important"
  | "contextual"
  | "low";

export type FieldImportanceAssessment = {
  importance: FieldImportance;
  label: "Critical" | "Important" | "Contextual" | "Low impact";
  description: string;
  reasons: string[];
};

export const FIELD_IMPORTANCE_RANK: Record<FieldImportance, number> = {
  critical: 4,
  important: 3,
  contextual: 2,
  low: 1,
};

function normalize(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getSemanticMapping(
  mapping: SemanticFieldMapping,
): SemanticMappingValue | null {
  if (
    mapping.resolution.status === "accepted" ||
    mapping.resolution.status === "edited"
  ) {
    return mapping.resolution.value;
  }

  return mapping.suggestion;
}

function assessment(
  importance: FieldImportance,
  description: string,
  reasons: string[],
): FieldImportanceAssessment {
  const labels: Record<FieldImportance, FieldImportanceAssessment["label"]> = {
    critical: "Critical",
    important: "Important",
    contextual: "Contextual",
    low: "Low impact",
  };

  return { importance, label: labels[importance], description, reasons };
}

export function getFieldImportance(
  mapping: SemanticFieldMapping,
  physicalField: FieldProfile,
): FieldImportanceAssessment {
  const semanticMapping = getSemanticMapping(mapping);
  const semanticType = semanticMapping?.semanticType ?? SEMANTIC_TYPE_IDS.unknown;
  const searchableName = normalize(
    [
      mapping.originalName,
      physicalField.displayName,
      semanticMapping?.businessMeaning ?? "",
    ].join(" "),
  );
  const isRecordTrackingId =
    /^(?:event|feedback|record|row|message|response)_id$/.test(
      normalize(mapping.originalName),
    );

  if (isRecordTrackingId) {
    return assessment(
      "low",
      "Used mainly for record tracing and usually not required for product analysis.",
      [
        "It can help trace or deduplicate individual records.",
        "Core trends, funnels, retention, and feedback analysis usually do not depend on it.",
      ],
    );
  }

  if (isConditionalCohortDateFieldName(mapping.originalName)) {
    return assessment(
      "important",
      "Supports cohort-based retention analysis without blocking other product analysis.",
      [
        "It groups users into acquisition cohorts for retention analysis.",
        "If it is unavailable, cohort matrix analysis may be unavailable while other analytics can continue.",
      ],
    );
  }

  if (
    semanticType === SEMANTIC_TYPE_IDS.userId ||
    /(?:^|_)user_id(?:_|$)|(?:^|_)account_id(?:_|$)/.test(searchableName)
  ) {
    return assessment(
      "critical",
      "Required to connect product behavior to users across retention and journey analysis.",
      [
        "Retention analysis needs a stable user identity.",
        "Missing user identity reduces segment and journey accuracy.",
      ],
    );
  }

  if (
    semanticType === SEMANTIC_TYPE_IDS.eventTimestamp ||
    /(?:^|_)(?:event_)?(?:timestamp|occurred_at|event_time)(?:_|$)/.test(
      searchableName,
    )
  ) {
    return assessment(
      "critical",
      "Required to order events and calculate time-based product analysis.",
      [
        "Trends, funnels, and retention windows depend on event timing.",
        "Missing or unreliable timestamps can invalidate sequence analysis.",
      ],
    );
  }

  if (
    semanticType === SEMANTIC_TYPE_IDS.eventName ||
    /(?:^|_)event_(?:name|type)(?:_|$)/.test(searchableName)
  ) {
    return assessment(
      "critical",
      "Required to identify product behaviors and construct event-based analysis.",
      [
        "Funnels and behavior trends depend on recognizable event names.",
        "Missing event identity limits diagnosis to aggregate metrics.",
      ],
    );
  }

  if (
    semanticType === SEMANTIC_TYPE_IDS.retention ||
    /(?:^|_)retention(?:_rate)?(?:_|$)/.test(searchableName)
  ) {
    return assessment(
      "critical",
      "Required for retention analysis.",
      [
        "Retention comparisons depend directly on this outcome.",
        "Missing value semantics can make retention gaps unreliable.",
      ],
    );
  }

  if (
    semanticType === SEMANTIC_TYPE_IDS.feedbackText ||
    /(?:^|_)(?:feedback|comment|response)_text(?:_|$)/.test(searchableName)
  ) {
    return assessment(
      "critical",
      "Required to preserve the user voice used by feedback analysis.",
      [
        "Feedback topics need representative source text as evidence.",
        "Without it, qualitative patterns cannot be inspected or validated.",
      ],
    );
  }

  if (
    semanticType === SEMANTIC_TYPE_IDS.platform ||
    /(?:^|_)(?:platform|user_segment|customer_segment|subscription_plan|plan|tier)(?:_|$)/.test(
      searchableName,
    )
  ) {
    return assessment(
      "important",
      "Improves analysis accuracy by locating differences across meaningful user groups.",
      [
        "Segment comparisons help identify where a product signal is concentrated.",
        "Missing this field reduces the precision of diagnosis.",
      ],
    );
  }

  if (
    semanticType === SEMANTIC_TYPE_IDS.metric ||
    semanticType === SEMANTIC_TYPE_IDS.revenue ||
    semanticType === SEMANTIC_TYPE_IDS.funnelStep ||
    semanticType === SEMANTIC_TYPE_IDS.releaseVersion ||
    semanticType === SEMANTIC_TYPE_IDS.sessionId ||
    semanticType === SEMANTIC_TYPE_IDS.sentiment ||
    /(?:^|_)(?:conversion|revenue|amount|score|count|rate)(?:_|$)/.test(
      searchableName,
    )
  ) {
    return assessment(
      "important",
      "Improves metric, journey, or comparison accuracy when investigating product changes.",
      [
        "This field can refine an analysis or comparison.",
        "The core signal may remain available, but with less diagnostic precision.",
      ],
    );
  }

  if (
    /(?:^|_)(?:country|region|device|device_type|browser|locale|language|city)(?:_|$)/.test(
      searchableName,
    ) ||
    semanticType === SEMANTIC_TYPE_IDS.dimension ||
    physicalField.detectedType === "date" ||
    physicalField.detectedType === "datetime"
  ) {
    return assessment(
      "contextual",
      "Adds user or business context that can help explain where a signal appears.",
      [
        "It supports filtering and contextual comparison.",
        "Most core product metrics can still be calculated without it.",
      ],
    );
  }

  if (
    semanticMapping?.semanticRole === "identifier" ||
    /(?:^|_)(?:id|uuid|key|tracking_id)(?:_|$)/.test(searchableName)
  ) {
    return assessment(
      "low",
      "Used mainly for record tracing and usually not required for product analysis.",
      [
        "It may support record lookup or deduplication.",
        "It does not normally change product-level findings.",
      ],
    );
  }

  return assessment(
    "contextual",
    "Provides additional context for understanding and filtering the dataset.",
    [
      "Its field name, physical type, and suggested meaning do not indicate a core analysis dependency.",
      "It may still be useful when investigating a specific segment or business question.",
    ],
  );
}
