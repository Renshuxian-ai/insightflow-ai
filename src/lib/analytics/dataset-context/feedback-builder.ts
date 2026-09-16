import {
  DATASET_ANALYTICS_SEMANTIC_TYPES,
  findAnalyticsField,
  readCell,
  roundAnalyticsValue,
  toAnalyticsDateKey,
  toCellText,
} from "./field-bindings";
import type {
  DatasetAnalyticsBuilderInput,
  DatasetFeedbackEvidence,
  DatasetFeedbackSentiment,
} from "./types";

type TopicAccumulator = {
  topic: string;
  mentions: number;
  sentimentCounts: Map<string, number>;
  quotes: string[];
  quoteSet: Set<string>;
  dates: string[];
};

function getTopicSentiment(
  sentimentCounts: Map<string, number>,
): DatasetFeedbackSentiment {
  const supportedSentiments = ["positive", "negative", "neutral"] as const;
  const ranked = supportedSentiments
    .map((sentiment) => ({
      sentiment,
      count: sentimentCounts.get(sentiment) ?? 0,
    }))
    .sort((left, right) => right.count - left.count);
  const first = ranked[0];
  const second = ranked[1];

  if (!first || first.count === 0) {
    return sentimentCounts.size > 0 ? "mixed" : "unknown";
  }

  return second && first.count === second.count ? "mixed" : first.sentiment;
}

export function buildDatasetFeedbackEvidence(
  input: DatasetAnalyticsBuilderInput,
): DatasetFeedbackEvidence | null {
  const feedbackText = findAnalyticsField(input, {
    names: ["feedback_text", "comment_text", "response_text"],
    semanticTypes: [DATASET_ANALYTICS_SEMANTIC_TYPES.feedbackText],
  });
  const feedbackTopic = findAnalyticsField(input, {
    names: ["feedback_topic", "topic"],
  });
  const feedbackSentiment = findAnalyticsField(input, {
    names: ["feedback_sentiment", "sentiment"],
    semanticTypes: [DATASET_ANALYTICS_SEMANTIC_TYPES.sentiment],
  });
  const date = findAnalyticsField(input, {
    names: ["event_timestamp", "timestamp", "occurred_at", "event_time"],
    semanticTypes: [DATASET_ANALYTICS_SEMANTIC_TYPES.eventTimestamp],
  });

  if (!feedbackText || !feedbackTopic || !feedbackSentiment) {
    return null;
  }

  const topics = new Map<string, TopicAccumulator>();
  const observedDates = new Set<string>();

  for (const row of input.dataset.rows) {
    const text = toCellText(readCell(row, feedbackText));
    const topic = toCellText(readCell(row, feedbackTopic));
    const sentiment = toCellText(readCell(row, feedbackSentiment))
      ?.toLocaleLowerCase("en-US");
    const dateKey = date ? toAnalyticsDateKey(readCell(row, date)) : null;

    if (!text || !topic) {
      continue;
    }

    const key = topic.toLocaleLowerCase("en-US");
    const accumulator = topics.get(key) ?? {
      topic,
      mentions: 0,
      sentimentCounts: new Map<string, number>(),
      quotes: [],
      quoteSet: new Set<string>(),
      dates: [],
    };

    accumulator.mentions += 1;

    if (sentiment) {
      accumulator.sentimentCounts.set(
        sentiment,
        (accumulator.sentimentCounts.get(sentiment) ?? 0) + 1,
      );
    }

    if (dateKey) {
      accumulator.dates.push(dateKey);
      observedDates.add(dateKey);
    }

    if (accumulator.quotes.length < 3 && !accumulator.quoteSet.has(text)) {
      accumulator.quoteSet.add(text);
      accumulator.quotes.push(text);
    }

    topics.set(key, accumulator);
  }

  if (topics.size === 0) {
    return null;
  }

  const sortedDates = [...observedDates].sort();
  const splitIndex = Math.floor(sortedDates.length / 2);
  const baselineDateSet = new Set(sortedDates.slice(0, splitIndex));
  const currentDateSet = new Set(sortedDates.slice(splitIndex));
  const topicEvidence = [...topics.values()]
    .map((topic) => {
      const baselineMentions = topic.dates.filter((dateKey) =>
        baselineDateSet.has(dateKey),
      ).length;
      const currentMentions = topic.dates.filter((dateKey) =>
        currentDateSet.has(dateKey),
      ).length;

      return {
        topic: topic.topic,
        mentions: topic.mentions,
        sentiment: getTopicSentiment(topic.sentimentCounts),
        sentimentCounts: Object.fromEntries(
          [...topic.sentimentCounts.entries()].sort(([left], [right]) =>
            left.localeCompare(right),
          ),
        ),
        quotes: topic.quotes,
        trend:
          baselineMentions > 0 && currentMentions > 0
            ? {
                method: "latest-half-vs-previous-half" as const,
                baselineMentions,
                currentMentions,
                changePercent: roundAnalyticsValue(
                  ((currentMentions - baselineMentions) / baselineMentions) *
                    100,
                ),
              }
            : null,
      };
    })
    .sort(
      (left, right) =>
        right.mentions - left.mentions || left.topic.localeCompare(right.topic),
    );

  return {
    fields: {
      feedbackText,
      feedbackTopic,
      feedbackSentiment,
      date,
    },
    totalFeedback: topicEvidence.reduce(
      (total, topic) => total + topic.mentions,
      0,
    ),
    topics: topicEvidence,
  };
}
