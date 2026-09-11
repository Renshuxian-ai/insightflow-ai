export const SEMANTIC_ROLES = [
  "identifier",
  "time",
  "measure",
  "dimension",
  "text",
  "classification",
  "outcome",
  "unknown",
] as const;

export type RegisteredSemanticRole = (typeof SEMANTIC_ROLES)[number];

export const SEMANTIC_TYPE_IDS = {
  userId: "user-id",
  sessionId: "session-id",
  eventName: "event-name",
  eventTimestamp: "event-timestamp",
  metric: "metric",
  dimension: "dimension",
  platform: "platform",
  releaseVersion: "release-version",
  feedbackText: "feedback-text",
  sentiment: "sentiment",
  revenue: "revenue",
  retention: "retention",
  funnelStep: "funnel-step",
  unknown: "unknown",
} as const;

export type RegisteredSemanticType =
  (typeof SEMANTIC_TYPE_IDS)[keyof typeof SEMANTIC_TYPE_IDS];

export type SemanticTypeDefinition = {
  id: RegisteredSemanticType;
  label: string;
  role: RegisteredSemanticRole;
  description: string;
};

export const semanticTypeRegistry: Record<
  RegisteredSemanticType,
  SemanticTypeDefinition
> = {
  [SEMANTIC_TYPE_IDS.userId]: {
    id: SEMANTIC_TYPE_IDS.userId,
    label: "User ID",
    role: "identifier",
    description: "Identifies a product user or account subject.",
  },
  [SEMANTIC_TYPE_IDS.sessionId]: {
    id: SEMANTIC_TYPE_IDS.sessionId,
    label: "Session ID",
    role: "identifier",
    description: "Identifies a product usage session.",
  },
  [SEMANTIC_TYPE_IDS.eventName]: {
    id: SEMANTIC_TYPE_IDS.eventName,
    label: "Event name",
    role: "dimension",
    description: "Names a tracked product behavior or event.",
  },
  [SEMANTIC_TYPE_IDS.eventTimestamp]: {
    id: SEMANTIC_TYPE_IDS.eventTimestamp,
    label: "Event timestamp",
    role: "time",
    description: "Records when an event or observation occurred.",
  },
  [SEMANTIC_TYPE_IDS.metric]: {
    id: SEMANTIC_TYPE_IDS.metric,
    label: "Metric",
    role: "measure",
    description: "Contains a numeric product measurement.",
  },
  [SEMANTIC_TYPE_IDS.dimension]: {
    id: SEMANTIC_TYPE_IDS.dimension,
    label: "Dimension",
    role: "dimension",
    description: "Groups or describes records for analysis.",
  },
  [SEMANTIC_TYPE_IDS.platform]: {
    id: SEMANTIC_TYPE_IDS.platform,
    label: "Platform",
    role: "dimension",
    description: "Identifies a platform, operating system, or client family.",
  },
  [SEMANTIC_TYPE_IDS.releaseVersion]: {
    id: SEMANTIC_TYPE_IDS.releaseVersion,
    label: "Release version",
    role: "dimension",
    description: "Identifies an application or product release.",
  },
  [SEMANTIC_TYPE_IDS.feedbackText]: {
    id: SEMANTIC_TYPE_IDS.feedbackText,
    label: "Feedback text",
    role: "text",
    description: "Contains qualitative user feedback.",
  },
  [SEMANTIC_TYPE_IDS.sentiment]: {
    id: SEMANTIC_TYPE_IDS.sentiment,
    label: "Sentiment",
    role: "classification",
    description: "Classifies the tone of feedback or text.",
  },
  [SEMANTIC_TYPE_IDS.revenue]: {
    id: SEMANTIC_TYPE_IDS.revenue,
    label: "Revenue",
    role: "measure",
    description: "Contains a monetary revenue measurement.",
  },
  [SEMANTIC_TYPE_IDS.retention]: {
    id: SEMANTIC_TYPE_IDS.retention,
    label: "Retention",
    role: "outcome",
    description: "Represents a retention outcome or rate.",
  },
  [SEMANTIC_TYPE_IDS.funnelStep]: {
    id: SEMANTIC_TYPE_IDS.funnelStep,
    label: "Funnel step",
    role: "dimension",
    description: "Identifies a step in a conversion sequence.",
  },
  [SEMANTIC_TYPE_IDS.unknown]: {
    id: SEMANTIC_TYPE_IDS.unknown,
    label: "Unknown",
    role: "unknown",
    description: "No reliable semantic role has been identified.",
  },
};

export function isSemanticRole(
  value: unknown,
): value is RegisteredSemanticRole {
  return (
    typeof value === "string" &&
    (SEMANTIC_ROLES as readonly string[]).includes(value)
  );
}

export function isSemanticType(
  value: unknown,
): value is RegisteredSemanticType {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(semanticTypeRegistry, value)
  );
}

export function getSemanticTypeDefinition(
  semanticType: RegisteredSemanticType,
): SemanticTypeDefinition {
  return semanticTypeRegistry[semanticType];
}

export function isSemanticTypeCompatibleWithRole(
  semanticType: RegisteredSemanticType,
  semanticRole: RegisteredSemanticRole,
): boolean {
  return (
    semanticType === SEMANTIC_TYPE_IDS.unknown ||
    semanticTypeRegistry[semanticType].role === semanticRole
  );
}
