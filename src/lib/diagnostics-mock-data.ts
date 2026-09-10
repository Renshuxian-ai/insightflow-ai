import { formatPercentageMagnitude } from "./metric-formatters";

export type DiagnosticSeverity = "HIGH" | "MEDIUM";

export type DiagnosticMetric = {
  id: string;
  label: string;
  currentValue: string;
  changeValue: number;
  comparison: string;
};

export type DiagnosticContextItem = {
  id: string;
  label: string;
};

export type BehaviorSignal = {
  id: string;
  label: string;
  value: string;
  finding: string;
  detail: string;
  source: string;
};

export type FeedbackSignal = {
  id: string;
  topic: string;
  mentionCount: number;
  change: string;
  sentiment: "Negative" | "Mixed";
  finding: string;
  source: string;
  snippets: string[];
};

export type ReasoningStatement = {
  statement: string;
  evidenceIds: string[];
  status?: string;
};

export type DiagnosticTraceStep = {
  id: string;
  label: string;
  description: string;
  status: "mock-checked";
  evidenceIds: string[];
};

export type NextValidation = {
  id: string;
  label: string;
  description: string;
};

export type DiagnosticCase = {
  id: string;
  source: "mock";
  status: "ready";
  severity: DiagnosticSeverity;
  title: string;
  metric: DiagnosticMetric;
  context: {
    dateRange: DiagnosticContextItem;
    segment: DiagnosticContextItem;
    platform: DiagnosticContextItem;
    version: DiagnosticContextItem;
  };
  summary: {
    changed: string;
    affected: string;
    started: string;
  };
  evidence: {
    behaviorSignals: [BehaviorSignal, ...BehaviorSignal[]];
    feedbackSignals: [FeedbackSignal, ...FeedbackSignal[]];
  };
  reasoning: {
    observation: ReasoningStatement;
    inference: ReasoningStatement;
    hypothesis: ReasoningStatement;
  };
  traceSteps: DiagnosticTraceStep[];
  nextValidations: NextValidation[];
};

const retentionMetric: DiagnosticMetric = {
  id: "d1-retention",
  label: "D1 Retention",
  currentValue: "38.4%",
  changeValue: -4.1,
  comparison: "vs. previous 30 days",
};

const retentionContext: DiagnosticCase["context"] = {
  dateRange: { id: "last-30-days", label: "Last 30 days" },
  segment: { id: "new-users", label: "New Users" },
  platform: { id: "android", label: "Android" },
  version: { id: "v3.2", label: "V3.2" },
};

const retentionSummaryLabel = retentionMetric.label.replace("Retention", "retention");
const retentionChangeMagnitude = formatPercentageMagnitude(retentionMetric.changeValue);
const onboardingFeedbackMentionCount = 21;

export const primaryDiagnosticCase: DiagnosticCase = {
  id: "new-user-d1-retention-drop",
  source: "mock",
  status: "ready",
  severity: "HIGH",
  title: "New-user D1 retention dropped",
  metric: retentionMetric,
  context: retentionContext,
  summary: {
    changed: `${retentionSummaryLabel} fell to ${retentionMetric.currentValue}, down ${retentionChangeMagnitude} vs. the previous period.`,
    affected: `${retentionContext.platform.label} · ${retentionContext.segment.label} · ${retentionContext.version.label} showed the strongest deterioration.`,
    started: "The decline appears in cohorts entering after the selected release window.",
  },
  evidence: {
    behaviorSignals: [
      {
        id: "behavior-segment-concentration",
        label: "Affected segment",
        value: "Largest decline",
        finding: "The selected cohort shows the strongest retention deterioration.",
        detail: "The change is concentrated in this cohort rather than distributed evenly across platforms.",
        source: "Segment comparison · Mock data",
      },
      {
        id: "behavior-onboarding-dropoff",
        label: "Onboarding Step 2 → Step 3",
        value: "+6.4 pp drop-off",
        finding: "Step completion weakened after the selected release window.",
        detail: "Completion moved from 72.6% to 66.2% in the mock comparison.",
        source: "Onboarding funnel · Mock data",
      },
    ],
    feedbackSignals: [
      {
        id: "feedback-onboarding-clarity",
        topic: "Onboarding clarity",
        mentionCount: onboardingFeedbackMentionCount,
        change: "+18%",
        sentiment: "Negative",
        finding: "Negative onboarding feedback increased in the selected period.",
        source: `${onboardingFeedbackMentionCount} mock feedback items · ${retentionContext.dateRange.label}`,
        snippets: [
          "I got stuck when the app asked me to finish setting up my profile.",
          "After signing in, the last onboarding step sent me back again.",
        ],
      },
    ],
  },
  reasoning: {
    observation: {
      statement: "Retention deterioration is concentrated in the affected cohort after the selected release.",
      evidenceIds: ["behavior-segment-concentration", "behavior-onboarding-dropoff"],
    },
    inference: {
      statement: "The retention decline may be associated with increased onboarding friction introduced around the selected release.",
      evidenceIds: ["behavior-onboarding-dropoff", "feedback-onboarding-clarity"],
      status: "Possible explanation · Not confirmed",
    },
    hypothesis: {
      statement: `Simplifying the Step 3 onboarding flow may improve ${retentionMetric.label.toLowerCase()} for the affected new-user cohort.`,
      evidenceIds: ["behavior-onboarding-dropoff", "feedback-onboarding-clarity"],
      status: "Unvalidated hypothesis",
    },
  },
  traceSteps: [
    {
      id: "trace-metric",
      label: "Retention signal checked",
      description: `Compared the mock ${retentionMetric.label} signal with its previous-period baseline.`,
      status: "mock-checked",
      evidenceIds: ["behavior-segment-concentration"],
    },
    {
      id: "trace-segment",
      label: "Affected segment checked",
      description: "Reviewed the mock platform, user-scope, and release-version breakdown.",
      status: "mock-checked",
      evidenceIds: ["behavior-segment-concentration"],
    },
    {
      id: "trace-behavior",
      label: "Behavior evidence checked",
      description: "Reviewed the mock behavior evidence linked to this case.",
      status: "mock-checked",
      evidenceIds: ["behavior-onboarding-dropoff"],
    },
    {
      id: "trace-feedback",
      label: "Related feedback checked",
      description: "Reviewed the linked mock feedback evidence and representative snippets.",
      status: "mock-checked",
      evidenceIds: ["feedback-onboarding-clarity"],
    },
  ],
  nextValidations: [
    {
      id: "inspect-funnel",
      label: "Inspect Funnel",
      description: "Validate where the onboarding drop-off changed most.",
    },
    {
      id: "compare-versions",
      label: `Compare V3.1 vs ${retentionContext.version.label}`,
      description: "Check whether the change is isolated to the latest release.",
    },
    {
      id: "review-feedback",
      label: "Review affected feedback",
      description: "Read the feedback associated with the affected cohort.",
    },
    {
      id: "define-experiment",
      label: "Define experiment",
      description: "Turn the hypothesis into a measurable validation plan.",
    },
  ],
};

export const diagnosticCases: Record<string, DiagnosticCase> = {
  [primaryDiagnosticCase.id]: primaryDiagnosticCase,
};

export function getDiagnosticCase(id: string): DiagnosticCase | undefined {
  return diagnosticCases[id];
}
