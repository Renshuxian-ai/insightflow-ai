export type DiagnosticSeverity = "HIGH" | "MEDIUM";

export type DiagnosticChangeType = "relative-percent" | "percentage-points";

export type DiagnosticMetric = {
  id: string;
  label: string;
  currentValue: string;
  previousValue?: string;
  changeValue: number;
  changeType?: DiagnosticChangeType;
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
