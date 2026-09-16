import type {
  RetentionBreakdownDimensionPresentation,
  RetentionBreakdownSegmentPresentation,
  RetentionDiagnosisEvidencePresentation,
  RetentionDiagnosisPresentation,
  RetentionSuggestedCheckPresentation,
} from "./retention-presentation";
import { getRetentionPresentationRate } from "./retention-presentation";

type BuildRetentionDiagnosisInput = {
  breakdowns: RetentionBreakdownDimensionPresentation[];
  severity?: RetentionDiagnosisPresentation["severity"];
  suggestedCheckTitles?: string[];
};

function toRates(segment: RetentionBreakdownSegmentPresentation) {
  const d7 = getRetentionPresentationRate(segment, 7);

  if (d7 === null) {
    return null;
  }

  return {
    D1: getRetentionPresentationRate(segment, 1),
    D7: d7,
    D30: getRetentionPresentationRate(segment, 30),
  };
}

function analyzeDimension(
  dimension: RetentionBreakdownDimensionPresentation,
): RetentionDiagnosisEvidencePresentation | null {
  const comparable = dimension.segments.flatMap((segment) => {
    const retention = toRates(segment);
    return retention ? [{ segment, retention }] : [];
  });

  if (comparable.length < 2) {
    return null;
  }

  const best = comparable.reduce((selected, candidate) =>
    candidate.retention.D7 > selected.retention.D7 ? candidate : selected,
  );
  const worst = comparable.reduce((selected, candidate) =>
    candidate.retention.D7 < selected.retention.D7 ? candidate : selected,
  );
  const d7Gap = Number((worst.retention.D7 - best.retention.D7).toFixed(2));

  if (d7Gap >= 0) {
    return null;
  }

  return {
    dimensionId: dimension.id,
    dimensionLabel: dimension.label,
    segment: {
      id: worst.segment.id,
      label: worst.segment.label,
      users: worst.segment.users,
      retention: worst.retention,
    },
    benchmark: {
      id: best.segment.id,
      label: best.segment.label,
      retention: best.retention,
    },
    d7Gap,
    impactScore: worst.segment.users * Math.abs(d7Gap),
  };
}

function getDefaultSuggestedChecks(
  evidence: RetentionDiagnosisEvidencePresentation,
) {
  return evidence.dimensionId === "platform"
    ? [
        `Compare release and version adoption for ${evidence.segment.label}`,
        `Review platform-specific funnel performance for ${evidence.segment.label}`,
        `Review platform-related feedback topics for ${evidence.segment.label}`,
      ]
    : [
        "Compare onboarding completion by user type",
        "Compare feature adoption by user type",
        "Review feedback differences across user types",
      ];
}

function replaceKnownSegment(
  title: string,
  segmentLabels: readonly string[],
  replacement: string,
) {
  const matchingLabel = segmentLabels.find((label) => title.includes(label));
  return matchingLabel ? title.replace(matchingLabel, replacement) : title;
}

function toSuggestedChecks(
  titles: readonly string[],
): RetentionSuggestedCheckPresentation[] {
  return titles.map((title, index) => ({
    id: `retention-investigation-target-${index + 1}`,
    title,
    status: "not-analyzed",
  }));
}

function deriveSeverity(gap: number): RetentionDiagnosisPresentation["severity"] {
  const absoluteGap = Math.abs(gap);

  if (absoluteGap >= 20) {
    return "high";
  }

  return absoluteGap >= 10 ? "medium" : "low";
}

export function buildRetentionDiagnosis(
  input: BuildRetentionDiagnosisInput,
): RetentionDiagnosisPresentation | null {
  const evidence = input.breakdowns
    .flatMap((dimension) => {
      const result = analyzeDimension(dimension);
      return result ? [result] : [];
    })
    .sort((left, right) => right.impactScore - left.impactScore);
  const primaryEvidence = evidence[0];

  if (!primaryEvidence) {
    return null;
  }

  const segmentLabels = input.breakdowns.flatMap((dimension) =>
    dimension.segments.map((segment) => segment.label),
  );
  const suggestedTitles = input.suggestedCheckTitles
    ? input.suggestedCheckTitles.map((title) =>
        replaceKnownSegment(
          title,
          segmentLabels,
          primaryEvidence.segment.label,
        ),
      )
    : getDefaultSuggestedChecks(primaryEvidence);
  const segmentRate = primaryEvidence.segment.retention.D7;
  const benchmarkRate = primaryEvidence.benchmark.retention.D7;
  const gap = Math.abs(primaryEvidence.d7Gap);

  return {
    severity: input.severity ?? deriveSeverity(primaryEvidence.d7Gap),
    interpretation: `${primaryEvidence.segment.label} retention is lower than the strongest observed ${primaryEvidence.dimensionLabel.toLocaleLowerCase("en-US")} segment and requires investigation.`,
    observation: `${primaryEvidence.segment.label} users show ${segmentRate.toFixed(1)}% D7 retention, ${gap.toFixed(1)} pp below ${primaryEvidence.benchmark.label} at ${benchmarkRate.toFixed(1)}%.`,
    primaryEvidence,
    secondaryEvidence: evidence.slice(1),
    suggestedChecks: toSuggestedChecks(suggestedTitles),
  };
}
