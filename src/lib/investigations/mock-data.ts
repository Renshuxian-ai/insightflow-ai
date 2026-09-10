import {
  coreConversionDiagnosticCase,
  primaryDiagnosticCase,
} from "@/lib/diagnostics-mock-data";

import type { InvestigationResult } from "./types";

const retentionInvestigation: InvestigationResult = {
  id: "investigation-new-user-d1-retention-drop-v1",
  diagnosticCaseId: primaryDiagnosticCase.id,
  source: "mock",
  status: "prototype-draft",
  focus: {
    title: "Assess onboarding as a plausible contributor",
    description:
      "Review whether the concentrated onboarding signals justify prioritizing this path while keeping release, acquisition, and instrumentation explanations open.",
  },
  summary: {
    text: "D1 retention is below its recent baseline, the decline is concentrated in the affected cohort, onboarding completion weakened, and negative onboarding feedback increased. These signals appear together in this mock diagnostic and do not establish a cause.",
    evidenceReferenceIds: [
      "retention-metric",
      "retention-segment",
      "retention-onboarding",
      "retention-feedback",
    ],
  },
  evidenceUsed: [
    {
      id: "retention-metric",
      sourceType: "metric",
      sourceId: primaryDiagnosticCase.metric.id,
      relevance: "Defines the size and direction of the retention anomaly.",
    },
    {
      id: "retention-segment",
      sourceType: "behavior-signal",
      sourceId: "behavior-segment-concentration",
      relevance: "Shows that the decline is concentrated rather than evenly distributed.",
    },
    {
      id: "retention-onboarding",
      sourceType: "behavior-signal",
      sourceId: "behavior-onboarding-dropoff",
      relevance: "Identifies a measurable weakening in the onboarding journey.",
    },
    {
      id: "retention-feedback",
      sourceType: "feedback-signal",
      sourceId: "feedback-onboarding-clarity",
      relevance: "Adds qualitative reports of onboarding difficulty in the same period.",
    },
  ],
  possibleExplanations: [
    {
      id: "retention-explanation-onboarding-friction",
      statement:
        "Additional friction around onboarding Step 3 may be contributing to the decline for the affected new-user cohort.",
      qualification: "possible-not-confirmed",
      evidenceRelationship: "supporting",
      confidence: "medium",
      confidenceRationale:
        "The behavior and feedback signals point in the same direction, but the current case does not contain a controlled comparison.",
      evidenceReferenceIds: ["retention-onboarding", "retention-feedback"],
      uncertainty:
        "The evidence does not isolate onboarding from release mix, acquisition quality, or other cohort differences.",
    },
    {
      id: "retention-explanation-mix-or-measurement",
      statement:
        "A change in acquisition mix, cohort composition, or event measurement could also contribute to the observed pattern.",
      qualification: "alternative-to-rule-out",
      evidenceRelationship: "context-only",
      confidence: "low",
      confidenceRationale:
        "The concentration makes these alternatives worth checking, but the current evidence does not measure them directly.",
      evidenceReferenceIds: ["retention-metric", "retention-segment"],
      uncertainty:
        "Channel, device-quality, and instrumentation comparisons are not included in this mock case.",
    },
  ],
  workingHypothesis: {
    id: "hypothesis-retention-onboarding-friction-v1",
    statement:
      "If Step 3 friction is contributing to the decline, reducing that friction should first improve onboarding completion for the affected cohort before any retention effect is evaluated.",
    status: "unvalidated",
    evidenceReferenceIds: ["retention-onboarding", "retention-feedback"],
  },
  recommendedValidations: [
    {
      validationId: "inspect-funnel",
      priority: "primary",
      rationale: "Confirm whether the Step 2 → Step 3 deterioration remains after consistent cohort filters are applied.",
    },
    {
      validationId: "compare-versions",
      priority: "supporting",
      rationale: "Compare matched cohorts without treating release timing as proof of causation.",
    },
    {
      validationId: "review-feedback",
      priority: "supporting",
      rationale: "Check whether the feedback themes consistently describe the same friction point.",
    },
  ],
  limitations: [
    "All signals in this draft are mock data.",
    "No controlled cohort comparison or event-quality audit has been performed.",
  ],
};

const coreConversionInvestigation: InvestigationResult = {
  id: "investigation-core-conversion-decline-v1",
  diagnosticCaseId: coreConversionDiagnosticCase.id,
  source: "mock",
  status: "prototype-draft",
  focus: {
    title: "Assess the data-source connection transition",
    description:
      "Evaluate whether the Step 2 → Step 3 pattern and related feedback justify prioritizing setup friction while preserving alternative explanations.",
  },
  summary: {
    text: "Core Conversion is below its previous-period baseline, the largest transition decline appears before data-source connection, the deterioration is concentrated in the affected segment, and related setup feedback increased. These signals appear together in this mock diagnostic and do not establish a cause.",
    evidenceReferenceIds: [
      "conversion-metric",
      "conversion-dropoff",
      "conversion-segment",
      "conversion-feedback",
    ],
  },
  evidenceUsed: [
    {
      id: "conversion-metric",
      sourceType: "metric",
      sourceId: coreConversionDiagnosticCase.metric.id,
      relevance: "Defines the relative Core Conversion decline and comparison period.",
    },
    {
      id: "conversion-dropoff",
      sourceType: "behavior-signal",
      sourceId: "behavior-data-source-connection-dropoff",
      relevance: "Locates the largest transition change in the selected activation journey.",
    },
    {
      id: "conversion-segment",
      sourceType: "behavior-signal",
      sourceId: "segment-web-self-serve-v3.2",
      relevance: "Shows where the deterioration is most concentrated.",
    },
    {
      id: "conversion-feedback",
      sourceType: "feedback-signal",
      sourceId: "feedback-data-source-connection-setup",
      relevance: "Adds qualitative reports about unclear permissions and lost setup progress.",
    },
  ],
  possibleExplanations: [
    {
      id: "conversion-explanation-setup-friction",
      statement:
        "Permission uncertainty or lost setup state during data-source connection may be contributing to the Step 2 → Step 3 decline.",
      qualification: "possible-not-confirmed",
      evidenceRelationship: "supporting",
      confidence: "medium",
      confidenceRationale:
        "The transition and feedback signals are aligned, but the case does not include a controlled usability or connector-level comparison.",
      evidenceReferenceIds: ["conversion-dropoff", "conversion-feedback"],
      uncertainty:
        "The current evidence cannot separate interface friction from connector mix or acquisition differences.",
    },
    {
      id: "conversion-explanation-mix-or-instrumentation",
      statement:
        "Connector mix, acquisition mix, or a measurement change could also contribute to the conversion pattern.",
      qualification: "alternative-to-rule-out",
      evidenceRelationship: "context-only",
      confidence: "low",
      confidenceRationale:
        "These are plausible alternatives, but the current DiagnosticCase contains no direct evidence that confirms them.",
      evidenceReferenceIds: ["conversion-metric", "conversion-segment"],
      uncertainty:
        "Connector-level completion, matched acquisition cohorts, and event-integrity checks are still missing.",
    },
  ],
  workingHypothesis: {
    id: "hypothesis-conversion-setup-friction-v1",
    statement:
      "If permission uncertainty or lost setup state contributes to the decline, clearer permission context and preserved progress should improve Step 2 → Step 3 completion for the affected segment.",
    status: "unvalidated",
    evidenceReferenceIds: ["conversion-dropoff", "conversion-feedback"],
  },
  recommendedValidations: [
    {
      validationId: "verify-conversion-events",
      priority: "primary",
      rationale: "Rule out a measurement change before interpreting the decline as user behavior.",
    },
    {
      validationId: "inspect-step-transition",
      priority: "primary",
      rationale: "Compare the transition by date and connector type within the same context.",
    },
    {
      validationId: "validate-setup-hypothesis",
      priority: "supporting",
      rationale: "Use linked feedback and focused usability work to test the setup-friction explanation.",
    },
  ],
  limitations: [
    "All signals in this draft are mock data.",
    "No live funnel query, event audit, or controlled usability validation has been run.",
  ],
};

export const investigationResults: Record<string, InvestigationResult> = {
  [retentionInvestigation.diagnosticCaseId]: retentionInvestigation,
  [coreConversionInvestigation.diagnosticCaseId]: coreConversionInvestigation,
};

export function getInvestigationResult(diagnosticCaseId: string): InvestigationResult | undefined {
  return investigationResults[diagnosticCaseId];
}
