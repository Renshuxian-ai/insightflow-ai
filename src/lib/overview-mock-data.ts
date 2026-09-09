export type ChangeDirection = "positive" | "negative";

export type Kpi = {
  label: string;
  value: string;
  change: string;
  changeDirection: ChangeDirection;
  comparison: string;
};

export type TrendPoint = {
  label: string;
  value: number;
};

export type AnomalySeverity = "HIGH" | "MEDIUM";

export type Anomaly = {
  severity: AnomalySeverity;
  title: string;
  metric: string;
  change: string;
  context: string;
  diagnosticContext?: {
    evidence: string[];
    observation: string;
    inference: string;
    hypothesis: string;
  };
};

export type UserSegment = {
  name: string;
  description: string;
  users: string;
  change: string;
  changeDirection: ChangeDirection;
};

export type FeedbackTopic = {
  name: string;
  mentionCount: number;
  sentiment: "Negative" | "Mixed";
  change: string;
};

export const overviewKpis: Kpi[] = [
  { label: "DAU", value: "12,482", change: "+8.2%", changeDirection: "positive", comparison: "vs. previous 30 days" },
  { label: "D1 Retention", value: "38.4%", change: "-4.1%", changeDirection: "negative", comparison: "vs. previous 30 days" },
  { label: "Core Conversion", value: "26.8%", change: "-2.3%", changeDirection: "negative", comparison: "vs. previous 30 days" },
  { label: "Feedback", value: "2,183", change: "+11.2%", changeDirection: "positive", comparison: "vs. previous 30 days" },
];

export const productTrend: TrendPoint[] = [
  { label: "Aug 12", value: 11540 },
  { label: "Aug 16", value: 11820 },
  { label: "Aug 20", value: 11670 },
  { label: "Aug 24", value: 12050 },
  { label: "Aug 28", value: 11910 },
  { label: "Sep 01", value: 12360 },
  { label: "Sep 05", value: 12180 },
  { label: "Sep 09", value: 12482 },
];

export const anomalies: Anomaly[] = [
  {
    severity: "HIGH",
    title: "New-user D1 retention dropped",
    metric: "38.4%",
    change: "↓ 4.1%",
    context: "Affected: Android · New Users · V3.2",
    diagnosticContext: {
      evidence: ["D1 retention is below its recent baseline for Android new users."],
      observation: "The decline starts after the V3.2 release window.",
      inference: "The onboarding experience may be contributing to early churn.",
      hypothesis: "A V3.2 onboarding change created friction for new Android users.",
    },
  },
  {
    severity: "MEDIUM",
    title: "Core conversion declined",
    metric: "26.8%",
    change: "↓ 2.3%",
    context: "Largest drop-off: Step 2 → Step 3",
  },
  {
    severity: "MEDIUM",
    title: "Negative feedback increased",
    metric: "Search-related feedback",
    change: "↑ 37%",
    context: "14 new feedback items mention search this week",
  },
];

export const userSegments: UserSegment[] = [
  { name: "Android new users", description: "First 7 days after signup", users: "12,448 users", change: "D1 retention −7.2%", changeDirection: "negative" },
  { name: "Power collaborators", description: "Invited 3+ teammates", users: "5,102 users", change: "Activation +5.8%", changeDirection: "positive" },
  { name: "Search-heavy teams", description: "10+ searches per week", users: "3,875 users", change: "Negative feedback +24%", changeDirection: "negative" },
];

export const feedbackTopics: FeedbackTopic[] = [
  { name: "Search relevance", mentionCount: 38, sentiment: "Negative", change: "+37%" },
  { name: "Onboarding clarity", mentionCount: 21, sentiment: "Negative", change: "+18%" },
  { name: "Team collaboration", mentionCount: 16, sentiment: "Mixed", change: "+6%" },
];
