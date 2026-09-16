import type { FeedbackTopic } from "@/lib/feedback/mock-feedback-data";

import type { AnalyticsFeedbackInvestigationContext } from "./investigation-context";

function toSignalPart(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function buildFeedbackInvestigationContext(
  topic: FeedbackTopic,
): AnalyticsFeedbackInvestigationContext {
  return {
    surface: "feedback",
    signalId: `feedback:${toSignalPart(topic.id || topic.title)}`,
    topic: {
      name: topic.title,
      mentions: topic.mentionCount,
      change: topic.trendChange,
      sentiment: topic.sentiment.toLocaleLowerCase(
        "en-US",
      ) as AnalyticsFeedbackInvestigationContext["topic"]["sentiment"],
    },
    affectedSegment: topic.affectedSegments[0] ?? topic.context.segment,
    evidenceQuotes: topic.evidenceQuotes.map((quote) => quote.text),
    relatedSignal: {
      name: topic.relatedSignal.title,
      change: topic.relatedSignal.changeValue,
    },
  };
}
