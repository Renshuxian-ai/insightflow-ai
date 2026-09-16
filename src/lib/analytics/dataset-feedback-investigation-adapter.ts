import type { DatasetAnalyticsContext } from "./dataset-context";
import type { AnalyticsFeedbackInvestigationContext } from "./investigation-context";

function toSignalPart(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function buildDatasetFeedbackInvestigationContext(
  analyticsContext: DatasetAnalyticsContext,
): AnalyticsFeedbackInvestigationContext | null {
  const contexts = buildDatasetFeedbackInvestigationContexts(analyticsContext);

  return contexts.find((context) => context.topic.change !== null) ??
    contexts[0] ??
    null;
}

export function buildDatasetFeedbackInvestigationContexts(
  analyticsContext: DatasetAnalyticsContext,
): AnalyticsFeedbackInvestigationContext[] {
  const evidence = analyticsContext.feedbackEvidence;

  if (!evidence) {
    return [];
  }

  return evidence.topics.flatMap((topic) => {
    if (
      topic.quotes.length === 0 ||
      (topic.sentiment !== "negative" && topic.sentiment !== "mixed")
    ) {
      return [];
    }

    return [{
      surface: "feedback" as const,
      signalId: [
        "dataset",
        analyticsContext.datasetId,
        "feedback",
        toSignalPart(topic.topic),
      ].join(":"),
      topic: {
        name: topic.topic,
        mentions: topic.mentions,
        change: topic.trend?.changePercent ?? null,
        sentiment: topic.sentiment,
        trendStatus: topic.trend ? ("available" as const) : ("unavailable" as const),
      },
      affectedSegment: "All feedback contributors",
      evidenceQuotes: [...topic.quotes],
      relatedSignal: null,
      datasetEvidence: {
        datasetId: analyticsContext.datasetId,
        source: "uploaded-dataset" as const,
        quality: topic.trend ? ("observed" as const) : ("mixed" as const),
        method: topic.trend?.method ?? "aggregate-topic-evidence",
        limitations: [
          ...(topic.trend
            ? []
            : ["Topic trend is unavailable because no comparable date windows exist."]),
          "No affected segment is inferred without segment-linked feedback evidence.",
          "No related product signal is inferred from feedback data alone.",
        ],
      },
    }];
  });
}
