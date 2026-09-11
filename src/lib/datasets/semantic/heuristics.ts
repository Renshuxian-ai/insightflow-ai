import type { FieldProfile } from "@/lib/datasets/types";

import {
  getSemanticTypeDefinition,
  SEMANTIC_TYPE_IDS,
} from "./semantic-type-registry";
import type {
  HeuristicSemanticCandidate,
  SemanticRole,
  SemanticType,
} from "./types";

type FieldNameRule = {
  patterns: RegExp[];
  semanticType: SemanticType;
  semanticConfidence: number;
  businessMeaning: string;
};

const fieldNameRules: FieldNameRule[] = [
  {
    patterns: [/^(user_?id|uid|customer_?id|account_?id)$/],
    semanticType: SEMANTIC_TYPE_IDS.userId,
    semanticConfidence: 0.95,
    businessMeaning: "Product user identifier",
  },
  {
    patterns: [/^(session_?id|sessionid)$/],
    semanticType: SEMANTIC_TYPE_IDS.sessionId,
    semanticConfidence: 0.95,
    businessMeaning: "Product session identifier",
  },
  {
    patterns: [/^(event|event_?name|event_?type|action)$/],
    semanticType: SEMANTIC_TYPE_IDS.eventName,
    semanticConfidence: 0.9,
    businessMeaning: "Tracked product event name",
  },
  {
    patterns: [
      /^(timestamp|time|event_?time|event_?timestamp|event_?ts|evt_?ts|created_?at|occurred_?at)$/,
    ],
    semanticType: SEMANTIC_TYPE_IDS.eventTimestamp,
    semanticConfidence: 0.9,
    businessMeaning: "Event or record timestamp",
  },
  {
    patterns: [/^(platform|os|operating_?system|client_?platform)$/],
    semanticType: SEMANTIC_TYPE_IDS.platform,
    semanticConfidence: 0.9,
    businessMeaning: "User platform or operating system",
  },
  {
    patterns: [/^(country|country_?code|user_?country)$/],
    semanticType: SEMANTIC_TYPE_IDS.dimension,
    semanticConfidence: 0.9,
    businessMeaning: "User country",
  },
  {
    patterns: [/^(version|app_?version|release|release_?version)$/],
    semanticType: SEMANTIC_TYPE_IDS.releaseVersion,
    semanticConfidence: 0.88,
    businessMeaning: "Application or product release version",
  },
  {
    patterns: [/^(feedback|comment|review|review_?text|feedback_?text)$/],
    semanticType: SEMANTIC_TYPE_IDS.feedbackText,
    semanticConfidence: 0.9,
    businessMeaning: "Qualitative user feedback text",
  },
  {
    patterns: [/^(sentiment|sentiment_?label|tone)$/],
    semanticType: SEMANTIC_TYPE_IDS.sentiment,
    semanticConfidence: 0.86,
    businessMeaning: "Feedback sentiment classification",
  },
  {
    patterns: [/^(revenue|arr|mrr|sales_?revenue)$/],
    semanticType: SEMANTIC_TYPE_IDS.revenue,
    semanticConfidence: 0.86,
    businessMeaning: "Revenue measurement",
  },
  {
    patterns: [/^(retention|retention_?rate|d\d+_?retention|ret_?\d+d)$/],
    semanticType: SEMANTIC_TYPE_IDS.retention,
    semanticConfidence: 0.84,
    businessMeaning: "User retention outcome",
  },
  {
    patterns: [/^(funnel_?step|step_?name|conversion_?step)$/],
    semanticType: SEMANTIC_TYPE_IDS.funnelStep,
    semanticConfidence: 0.84,
    businessMeaning: "Conversion funnel step",
  },
  {
    patterns: [/^(metric|metric_?value|value|amount|amt|count|score|rate)$/],
    semanticType: SEMANTIC_TYPE_IDS.metric,
    semanticConfidence: 0.72,
    businessMeaning: "Product measurement",
  },
  {
    patterns: [/^(amount|amt)$/],
    semanticType: SEMANTIC_TYPE_IDS.revenue,
    semanticConfidence: 0.56,
    businessMeaning: "Possible monetary amount",
  },
];

export function normalizeFieldName(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function createCandidate(
  semanticType: SemanticType,
  semanticConfidence: number,
  businessMeaning: string | null,
  reason: string,
  semanticRole?: SemanticRole,
): HeuristicSemanticCandidate {
  const definition = getSemanticTypeDefinition(semanticType);

  return {
    semanticRole: semanticRole ?? definition.role,
    semanticType,
    businessMeaning,
    semanticConfidence,
    reason,
  };
}

function getPhysicalFallback(field: FieldProfile): HeuristicSemanticCandidate {
  if (field.detectedType === "date" || field.detectedType === "datetime") {
    return createCandidate(
      SEMANTIC_TYPE_IDS.unknown,
      0.45,
      "Time value",
      "The physical profile identifies a time value but not its business meaning.",
      "time",
    );
  }

  if (field.detectedType === "integer" || field.detectedType === "number") {
    return createCandidate(
      SEMANTIC_TYPE_IDS.unknown,
      0.35,
      "Numeric value",
      "The physical profile identifies a measure-like value but not its business meaning.",
      "measure",
    );
  }

  if (field.detectedType === "string" || field.detectedType === "boolean") {
    return createCandidate(
      SEMANTIC_TYPE_IDS.unknown,
      0.25,
      null,
      "The physical profile does not identify a specific business meaning.",
      "unknown",
    );
  }

  return createCandidate(
    SEMANTIC_TYPE_IDS.unknown,
    0.2,
    null,
    "The physical profile does not provide enough evidence for a semantic role.",
  );
}

export function getHeuristicSemanticCandidates(
  field: FieldProfile,
): HeuristicSemanticCandidate[] {
  const normalizedName = normalizeFieldName(field.originalName || field.displayName);
  const candidates = fieldNameRules
    .filter((rule) => rule.patterns.some((pattern) => pattern.test(normalizedName)))
    .map((rule) =>
      createCandidate(
        rule.semanticType,
        rule.semanticConfidence,
        rule.businessMeaning,
        `The normalized field name "${normalizedName}" matches a controlled semantic rule.`,
      ),
    );

  if (candidates.length === 0) {
    candidates.push(getPhysicalFallback(field));
  }

  const uniqueCandidates = new Map<SemanticType, HeuristicSemanticCandidate>();

  for (const candidate of candidates) {
    const existing = uniqueCandidates.get(candidate.semanticType);

    if (!existing || candidate.semanticConfidence > existing.semanticConfidence) {
      uniqueCandidates.set(candidate.semanticType, candidate);
    }
  }

  return [...uniqueCandidates.values()].sort(
    (left, right) => right.semanticConfidence - left.semanticConfidence,
  );
}
