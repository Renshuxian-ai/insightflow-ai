export type FeedbackSentiment = "Negative" | "Mixed";

export type FeedbackOverviewMetric = {
  id: string;
  label: string;
  value: string;
  change: string;
  changeDirection: "positive" | "negative" | "neutral";
  comparison: string;
};

export type FeedbackEvidenceQuote = {
  id: string;
  text: string;
  source: string;
};

export type FeedbackTopic = {
  id: string;
  title: string;
  mentionCount: number;
  trend: string;
  trendChange: number;
  sentiment: FeedbackSentiment;
  affectedSegments: string[];
  representativeQuote: string;
  aiSummary: string;
  evidenceQuotes: FeedbackEvidenceQuote[];
  context: {
    platform: string;
    version: string;
    segment: string;
  };
  relatedSignal: {
    title: string;
    change: string;
    changeValue: number;
  };
};

export const feedbackOverviewMetrics: FeedbackOverviewMetric[] = [
  {
    id: "total-feedback",
    label: "Total Feedback",
    value: "2,183",
    change: "+11.2%",
    changeDirection: "positive",
    comparison: "vs. previous 30 days",
  },
  {
    id: "negative-feedback",
    label: "Negative Feedback",
    value: "32.5%",
    change: "+8.4 pp",
    changeDirection: "negative",
    comparison: "vs. previous 30 days",
  },
  {
    id: "new-issues",
    label: "New Issues Detected",
    value: "6",
    change: "+2",
    changeDirection: "negative",
    comparison: "vs. previous period",
  },
  {
    id: "linked-signals",
    label: "Linked Product Signals",
    value: "3",
    change: "+1",
    changeDirection: "neutral",
    comparison: "with supporting analytics evidence",
  },
];

export const feedbackTopics: FeedbackTopic[] = [
  {
    id: "search-relevance",
    title: "Search relevance",
    mentionCount: 38,
    trend: "37% vs. previous period",
    trendChange: 37,
    sentiment: "Negative",
    affectedSegments: ["Search-heavy teams"],
    representativeQuote:
      "Search results are not relevant after the update.",
    aiSummary:
      "Users report difficulty finding relevant results after the latest update.",
    evidenceQuotes: [
      {
        id: "search-quote-1",
        text: "Search results are not relevant after the update.",
        source: "In-product feedback",
      },
      {
        id: "search-quote-2",
        text: "I have to try several different phrases to find the same document.",
        source: "Support feedback",
      },
      {
        id: "search-quote-3",
        text: "The first results used to be useful, but now they feel unrelated.",
        source: "In-product feedback",
      },
    ],
    context: {
      platform: "Android",
      version: "V3.2",
      segment: "Search-heavy teams",
    },
    relatedSignal: {
      title: "Core conversion declined",
      change: "-2.3%",
      changeValue: -2.3,
    },
  },
  {
    id: "onboarding-clarity",
    title: "Onboarding clarity",
    mentionCount: 21,
    trend: "18% vs. previous period",
    trendChange: 18,
    sentiment: "Negative",
    affectedSegments: ["New users", "Free users"],
    representativeQuote:
      "I was not sure what to do after the second onboarding step.",
    aiSummary:
      "New users describe uncertainty about the next action during onboarding.",
    evidenceQuotes: [
      {
        id: "onboarding-quote-1",
        text: "I was not sure what to do after the second onboarding step.",
        source: "Onboarding survey",
      },
      {
        id: "onboarding-quote-2",
        text: "The setup instructions skipped the part I actually needed.",
        source: "Support feedback",
      },
      {
        id: "onboarding-quote-3",
        text: "I left because the final step did not explain what would happen next.",
        source: "Exit survey",
      },
    ],
    context: {
      platform: "Android",
      version: "V3.2",
      segment: "New users",
    },
    relatedSignal: {
      title: "D1 retention declined",
      change: "-13.0 pp",
      changeValue: -13,
    },
  },
  {
    id: "team-collaboration",
    title: "Team collaboration",
    mentionCount: 16,
    trend: "6% vs. previous period",
    trendChange: 6,
    sentiment: "Mixed",
    affectedSegments: ["Pro teams", "Workspace admins"],
    representativeQuote:
      "Inviting teammates is easy, but it is hard to see who has finished setup.",
    aiSummary:
      "Teams value the invitation flow but report limited visibility into teammate setup progress.",
    evidenceQuotes: [
      {
        id: "collaboration-quote-1",
        text: "Inviting teammates is easy, but it is hard to see who has finished setup.",
        source: "Customer interview",
      },
      {
        id: "collaboration-quote-2",
        text: "The shared workspace works well once everyone has joined.",
        source: "In-product feedback",
      },
      {
        id: "collaboration-quote-3",
        text: "I need a clearer way to remind teammates who have not completed setup.",
        source: "Support feedback",
      },
    ],
    context: {
      platform: "Web",
      version: "V3.2",
      segment: "Pro teams",
    },
    relatedSignal: {
      title: "Core conversion declined",
      change: "-2.3%",
      changeValue: -2.3,
    },
  },
];
