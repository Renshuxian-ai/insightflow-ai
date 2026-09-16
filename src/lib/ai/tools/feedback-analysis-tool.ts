import "server-only";

import { feedbackTopics } from "@/lib/feedback/mock-feedback-data";

import type {
  AnalyticsTool,
  ToolInput,
  ToolInputValidationResult,
  ToolObservation,
} from "./types";

function validateInput(input: unknown): ToolInputValidationResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { valid: false, message: "Feedback input must be an object." };
  }

  const record = input as Record<string, unknown>;
  const allowedKeys = new Set(["topic", "sentiment"]);

  if (Object.keys(record).some((key) => !allowedKeys.has(key))) {
    return { valid: false, message: "Feedback input contains unsupported fields." };
  }

  for (const key of ["topic", "sentiment"] as const) {
    if (
      record[key] !== undefined &&
      (typeof record[key] !== "string" || !record[key].trim())
    ) {
      return { valid: false, message: `${key} must be a non-empty string.` };
    }
  }

  return {
    valid: true,
    value: Object.fromEntries(
      Object.entries(record).map(([key, value]) => [
        key,
        (value as string).trim(),
      ]),
    ),
  };
}

function findDemoTopic(topic: string | undefined, caseTitle: string) {
  const requestedTopic = topic?.toLocaleLowerCase("en-US");

  if (requestedTopic) {
    const match = feedbackTopics.find(
      (candidate) =>
        candidate.title.toLocaleLowerCase("en-US") === requestedTopic,
    );

    if (match) {
      return match;
    }
  }

  const normalizedTitle = caseTitle.toLocaleLowerCase("en-US");

  return (
    feedbackTopics.find((candidate) =>
      normalizedTitle.includes(candidate.title.toLocaleLowerCase("en-US")),
    ) ??
    feedbackTopics.find((candidate) => normalizedTitle.includes("retention") && candidate.id === "onboarding-clarity") ??
    feedbackTopics[0]
  );
}

export const feedbackAnalysisTool: AnalyticsTool = {
  name: "feedback_analysis",
  description:
    "Read a feedback topic, sentiment, representative quotes, and supporting evidence.",
  inputSchema: {
    type: "object",
    properties: {
      topic: {
        type: "string",
        description: "Optional feedback topic to inspect.",
      },
      sentiment: {
        type: "string",
        description: "Optional sentiment filter such as negative or mixed.",
      },
    },
    required: [],
    additionalProperties: false,
  },
  validateInput,
  async execute(input: ToolInput, context): Promise<ToolObservation> {
    const datasetFeedback = context.datasetAnalyticsContext?.feedbackEvidence;

    if (context.executionScope === "analytics-dataset" && datasetFeedback) {
      const requestedTopic = input.topic?.toLocaleLowerCase("en-US");
      const topic = datasetFeedback.topics.find(
        (candidate) =>
          !requestedTopic ||
          candidate.topic.toLocaleLowerCase("en-US") === requestedTopic,
      ) ?? datasetFeedback.topics[0];

      if (!topic) {
        throw new Error("Dataset feedback topic evidence is unavailable.");
      }

      const sourceSignal =
        context.diagnosticCase.evidence.feedbackSignals[0] ??
        context.diagnosticCase.evidence.behaviorSignals[0];

      return {
        summary: `${topic.topic} has ${topic.mentions} mentions with ${topic.sentiment} sentiment in uploaded dataset evidence.`,
        facts: {
          topic: topic.topic,
          mentions: topic.mentions,
          sentiment: topic.sentiment,
          representativeQuotes: topic.quotes,
          sentimentCounts: Object.entries(topic.sentimentCounts).map(
            ([sentiment, count]) => `${sentiment}:${count}`,
          ),
          trendChangePercent: topic.trend?.changePercent ?? "unavailable",
          trendAvailable: topic.trend !== null ? "true" : "false",
          evidenceSource: "uploaded-dataset",
        },
        sourceReferences: [
          {
            sourceType: context.diagnosticCase.evidence.feedbackSignals[0]
              ? "feedback-signal"
              : "behavior-signal",
            sourceId: sourceSignal.id,
          },
        ],
        limitations: [
          ...(topic.trend
            ? []
            : ["A comparable feedback trend window is unavailable."]),
          "Feedback topics and sentiment are descriptive evidence, not causal conclusions.",
        ],
      };
    }

    const caseFeedback = context.diagnosticCase.evidence.feedbackSignals.find(
      (signal) =>
        !input.topic ||
        signal.topic.toLocaleLowerCase("en-US") ===
          input.topic.toLocaleLowerCase("en-US"),
    );
    const demoTopic = findDemoTopic(input.topic, context.diagnosticCase.title);
    const topic = caseFeedback?.topic ?? demoTopic?.title ?? input.topic ?? "No matching topic";
    const mentions = caseFeedback?.mentionCount ?? demoTopic?.mentionCount ?? 0;
    const sentiment =
      caseFeedback?.sentiment ?? demoTopic?.sentiment ?? "Mixed";
    const representativeQuotes =
      caseFeedback?.snippets ??
      demoTopic?.evidenceQuotes.map((quote) => quote.text) ??
      [];
    const evidence = [
      ...(caseFeedback ? [caseFeedback.finding] : []),
      ...(demoTopic ? [demoTopic.aiSummary] : []),
    ];
    const sourceSignal =
      context.diagnosticCase.evidence.behaviorSignals.find((signal) =>
        signal.id.includes("topic-volume"),
      ) ??
      context.diagnosticCase.evidence.behaviorSignals.find((signal) =>
        signal.id.includes("cohort"),
      ) ??
      context.diagnosticCase.evidence.behaviorSignals[0];

    return {
      summary: `${topic} has ${mentions} demo mentions with ${sentiment.toLocaleLowerCase("en-US")} sentiment.`,
      facts: {
        topic,
        mentions,
        sentiment,
        representativeQuotes,
        evidence,
      },
      sourceReferences: [
        {
          sourceType: "behavior-signal",
          sourceId: sourceSignal.id,
        },
      ],
      limitations: [
        "This tool reads demo feedback evidence; AI grouping is a pattern to investigate, not a fact or cause.",
      ],
    };
  },
};
