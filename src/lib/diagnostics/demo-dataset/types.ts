export type DemoUserRow = {
  userId: string;
  platform: string;
  version: string;
  country: string;
  channel: string;
  userType: string;
};

export type DemoEventRow = {
  userId: string;
  eventName: string;
  timestamp: string;
  platform: string;
  version: string;
};

export type DemoMetricRow = {
  date: string;
  metricName: string;
  segment: string;
  value: number;
};

export type DemoFeedbackRow = {
  feedbackId: string;
  userId: string;
  category: string;
  sentiment: string;
  text: string;
};

export type DemoReleaseRow = {
  version: string;
  releaseDate: string;
  change: string;
};

export type DemoDiagnosticDataset = {
  users: DemoUserRow[];
  events: DemoEventRow[];
  metrics: DemoMetricRow[];
  feedback: DemoFeedbackRow[];
  releases: DemoReleaseRow[];
};

export type DemoDatasetFileName =
  | "users.csv"
  | "events.csv"
  | "metrics.csv"
  | "feedback.csv"
  | "releases.csv";
