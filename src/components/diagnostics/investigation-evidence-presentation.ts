import type { DiagnosticCase } from "@/lib/diagnostics/types";
import type { EvidenceReference } from "@/lib/investigations/types";

type InvestigationEvidencePresentation = {
  badgeLabel: string;
  badgeClassName: string;
  whyUsed: string;
};

const sourceTypeLabels: Record<EvidenceReference["sourceType"], string> = {
  metric: "METRIC",
  context: "CONTEXT",
  "behavior-signal": "BEHAVIOR SIGNAL",
  "feedback-signal": "FEEDBACK SIGNAL",
};

const defaultBadgeClassName = "bg-[#f2f4f8] text-[#778196]";

function isPrimarySignalEvidence(
  reference: EvidenceReference,
  diagnosticCase: DiagnosticCase,
) {
  if (!diagnosticCase.primarySignal) {
    return false;
  }

  const primarySignalStep = diagnosticCase.traceSteps.find((step) =>
    step.label.startsWith("Primary signal:"),
  );

  return primarySignalStep?.evidenceIds.includes(reference.sourceId) ?? false;
}

function isCohortSupportingContext(
  reference: EvidenceReference,
  diagnosticCase: DiagnosticCase,
) {
  if (
    !diagnosticCase.primarySignal ||
    reference.sourceType !== "behavior-signal"
  ) {
    return false;
  }

  const signal = diagnosticCase.evidence.behaviorSignals.find(
    (item) => item.id === reference.sourceId,
  );
  const supportingContextStep = diagnosticCase.traceSteps.find((step) =>
    step.label.includes("supporting context"),
  );

  return (
    signal?.label === "Selected retention cohort" &&
    (supportingContextStep?.evidenceIds.includes(reference.sourceId) ?? false)
  );
}

export function getInvestigationEvidencePresentation(
  reference: EvidenceReference,
  diagnosticCase: DiagnosticCase,
): InvestigationEvidencePresentation {
  const primarySignal = diagnosticCase.primarySignal;

  if (isPrimarySignalEvidence(reference, diagnosticCase)) {
    return {
      badgeLabel: "PRIMARY SIGNAL",
      badgeClassName: "bg-[#edf1ff] text-[#3559e8]",
      whyUsed: reference.relevance,
    };
  }

  if (
    primarySignal &&
    isCohortSupportingContext(reference, diagnosticCase)
  ) {
    return {
      badgeLabel: "SUPPORTING CONTEXT",
      badgeClassName: "bg-[#eef2f6] text-[#607087]",
      whyUsed: `Provides cohort-level supporting context for the primary ${primarySignal.segment} ${primarySignal.interval} ${primarySignal.metric} signal.`,
    };
  }

  return {
    badgeLabel: sourceTypeLabels[reference.sourceType],
    badgeClassName: defaultBadgeClassName,
    whyUsed: reference.relevance,
  };
}
