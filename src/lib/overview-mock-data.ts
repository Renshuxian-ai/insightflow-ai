import {
  coreConversionDiagnosticCase,
  coreConversionDropoffSignal,
  primaryDiagnosticCase,
} from "./diagnostics-mock-data";
import { formatSignedPercentageChange } from "./metric-formatters";

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
  id: string;
  severity: AnomalySeverity;
  title: string;
  metric: string;
  change: string;
  context: string;
  diagnosticAvailable?: boolean;
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

const onboardingFeedbackSignal = primaryDiagnosticCase.evidence.feedbackSignals[0];
const primaryRetentionChange = formatSignedPercentageChange(primaryDiagnosticCase.metric.changeValue);
const coreConversionChange = formatSignedPercentageChange(coreConversionDiagnosticCase.metric.changeValue);

export const overviewKpis: Kpi[] = [
  { label: "DAU", value: "12,482", change: "+8.2%", changeDirection: "positive", comparison: "vs. previous 30 days" },
  {
    label: primaryDiagnosticCase.metric.label,
    value: primaryDiagnosticCase.metric.currentValue,
    change: primaryRetentionChange,
    changeDirection: "negative",
    comparison: primaryDiagnosticCase.metric.comparison,
  },
  {
    label: coreConversionDiagnosticCase.metric.label,
    value: coreConversionDiagnosticCase.metric.currentValue,
    change: coreConversionChange,
    changeDirection: "negative",
    comparison: coreConversionDiagnosticCase.metric.comparison,
  },
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
    id: primaryDiagnosticCase.id,
    severity: primaryDiagnosticCase.severity,
    title: primaryDiagnosticCase.title,
    metric: primaryDiagnosticCase.metric.currentValue,
    change: primaryRetentionChange,
    context: `Affected: ${primaryDiagnosticCase.context.platform.label} · ${primaryDiagnosticCase.context.segment.label} · ${primaryDiagnosticCase.context.version.label}`,
    diagnosticAvailable: true,
  },
  {
    id: coreConversionDiagnosticCase.id,
    severity: coreConversionDiagnosticCase.severity,
    title: coreConversionDiagnosticCase.title,
    metric: coreConversionDiagnosticCase.metric.currentValue,
    change: coreConversionChange,
    context: `${coreConversionDropoffSignal.label}: ${coreConversionDropoffSignal.value}`,
    diagnosticAvailable: true,
  },
  {
    id: "negative-feedback-increase",
    severity: "MEDIUM",
    title: "Negative feedback increased",
    metric: "Search-related feedback",
    change: "↑ 37%",
    context: "14 new feedback items mention search this week",
  },
];

export const userSegments: UserSegment[] = [
  {
    name: `${primaryDiagnosticCase.context.platform.label} ${primaryDiagnosticCase.context.segment.label.toLowerCase()}`,
    description: "First 7 days after signup",
    users: "12,448 users",
    change: `${primaryDiagnosticCase.metric.label} ${primaryRetentionChange}`,
    changeDirection: "negative",
  },
  { name: "Power collaborators", description: "Invited 3+ teammates", users: "5,102 users", change: "Activation +5.8%", changeDirection: "positive" },
  { name: "Search-heavy teams", description: "10+ searches per week", users: "3,875 users", change: "Negative feedback +24%", changeDirection: "negative" },
];

export const feedbackTopics: FeedbackTopic[] = [
  { name: "Search relevance", mentionCount: 38, sentiment: "Negative", change: "+37%" },
  {
    name: onboardingFeedbackSignal.topic,
    mentionCount: onboardingFeedbackSignal.mentionCount,
    sentiment: onboardingFeedbackSignal.sentiment,
    change: onboardingFeedbackSignal.change,
  },
  { name: "Team collaboration", mentionCount: 16, sentiment: "Mixed", change: "+6%" },
];
