export type RetentionIntervalPresentation = {
  day: number;
  users: number;
  rate: number;
};

export type RetentionCohortPresentation = {
  id: string;
  date: string;
  users: number;
  intervals: RetentionIntervalPresentation[];
};

export type RetentionBreakdownSegmentPresentation = {
  id: string;
  label: string;
  users: number;
  intervals: RetentionIntervalPresentation[];
};

export type RetentionBreakdownDimensionPresentation = {
  id: "platform" | "user-type";
  label: string;
  segments: RetentionBreakdownSegmentPresentation[];
};

export type RetentionDiagnosisIntervalRates = {
  D1: number | null;
  D7: number;
  D30: number | null;
};

export type RetentionDiagnosisEvidencePresentation = {
  dimensionId: RetentionBreakdownDimensionPresentation["id"];
  dimensionLabel: string;
  segment: {
    id: string;
    label: string;
    users: number;
    retention: RetentionDiagnosisIntervalRates;
  };
  benchmark: {
    id: string;
    label: string;
    retention: RetentionDiagnosisIntervalRates;
  };
  d7Gap: number;
  impactScore: number;
};

export type RetentionSuggestedCheckPresentation = {
  id: string;
  title: string;
  status: "not-analyzed";
};

export type RetentionDiagnosisPresentation = {
  severity: "low" | "medium" | "high";
  interpretation: string;
  observation: string;
  primaryEvidence: RetentionDiagnosisEvidencePresentation;
  secondaryEvidence: RetentionDiagnosisEvidencePresentation[];
  suggestedChecks: RetentionSuggestedCheckPresentation[];
};

export function getRetentionPresentationRate(
  segment: Pick<RetentionBreakdownSegmentPresentation, "intervals">,
  day: number,
) {
  return segment.intervals.find((interval) => interval.day === day)?.rate ?? null;
}
