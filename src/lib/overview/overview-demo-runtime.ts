export const overviewDemoRuntime = {
  kpis: [
    { label: "DAU", value: "12,482", change: "+8.2%", changeDirection: "positive" as const, comparison: "vs. previous 30 days" },
    { label: "D1 Retention", value: "38.4%", change: "-4.1 pp", changeDirection: "negative" as const, comparison: "vs. previous 30 days" },
    { label: "Core Conversion", value: "32.5%", change: "-67.5 pp", changeDirection: "negative" as const, comparison: "vs. previous version" },
    { label: "Feedback", value: "2,183", change: "+11.2%", changeDirection: "positive" as const, comparison: "vs. previous 30 days" },
  ],
  trend: {
    metricLabel: "Daily active users over the last 30 days",
    latestValue: "12.5k",
    change: "+8.2% vs. previous period",
    changeDirection: "positive" as const,
    data: [
      { label: "Aug 12", value: 11540 }, { label: "Aug 16", value: 11820 },
      { label: "Aug 20", value: 11670 }, { label: "Aug 24", value: 12050 },
      { label: "Aug 28", value: 11910 }, { label: "Sep 01", value: 12360 },
      { label: "Sep 05", value: 12180 }, { label: "Sep 09", value: 12482 },
    ],
  },
  anomalies: [
    { id: "new-user-d1-retention-drop", severity: "HIGH" as const, title: "New-user D1 retention dropped", current: "38.4%", change: "-4.1 pp", evidenceSummary: "Affected: Android · New Users · V3.2", diagnosticAvailable: true },
    { id: "core-conversion-decline", severity: "HIGH" as const, title: "Core conversion declined", current: "32.5%", change: "-67.5 pp", evidenceSummary: "Complete Step2 to Complete Step3 is the largest drop-off.", diagnosticAvailable: true },
    { id: "negative-feedback-increase", severity: "MEDIUM" as const, title: "Negative feedback increased", current: "Search-related feedback", change: "+37%", evidenceSummary: "14 new feedback items mention search this week.", diagnosticAvailable: false },
  ],
  userSegments: [
    { name: "Android new users", description: "First 7 days after signup", users: "12,448 users", change: "D1 Retention -4.1 pp", changeDirection: "negative" as const },
    { name: "Power collaborators", description: "Invited 3+ teammates", users: "5,102 users", change: "Activation +5.8%", changeDirection: "positive" as const },
    { name: "Search-heavy teams", description: "10+ searches per week", users: "3,875 users", change: "Negative feedback +24%", changeDirection: "negative" as const },
  ],
  feedbackTopics: [
    { name: "Search relevance", mentionCount: 38, sentiment: "Negative" as const, change: "+37%" },
    { name: "Onboarding clarity", mentionCount: 21, sentiment: "Negative" as const, change: "+18%" },
    { name: "Team collaboration", mentionCount: 16, sentiment: "Mixed" as const, change: "+6%" },
  ],
};
