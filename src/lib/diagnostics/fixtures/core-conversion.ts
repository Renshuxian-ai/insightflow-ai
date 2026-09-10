import { formatDirectionalPercentageChange, formatPercentageMagnitude } from "../../metric-formatters";
import type { BehaviorSignal, DiagnosticCase, DiagnosticMetric } from "../types";

const coreConversionMetric: DiagnosticMetric = {
  id: "core-conversion",
  label: "Core Conversion",
  currentValue: "26.8%",
  previousValue: "27.4%",
  changeValue: -2.3,
  changeType: "relative-percent",
  comparison: "vs. previous 30 days",
};

const coreConversionContext: DiagnosticCase["context"] = {
  dateRange: { id: "last-30-days", label: "Last 30 days" },
  segment: { id: "new-self-serve-workspaces", label: "New Self-Serve Workspaces" },
  platform: { id: "web", label: "Web" },
  version: { id: "v3.2", label: "V3.2" },
};

const evidenceIds = {
  metric: "metric-core-conversion-change",
  behavior: "behavior-data-source-connection-dropoff",
  segment: "segment-web-self-serve-v3.2",
  feedback: "feedback-data-source-connection-setup",
} as const;

const relativeChange = formatPercentageMagnitude(coreConversionMetric.changeValue);

const coreConversionMetricSignal: BehaviorSignal = {
  id: evidenceIds.metric,
  label: coreConversionMetric.label,
  value: `${coreConversionMetric.currentValue} · ${formatDirectionalPercentageChange(coreConversionMetric.changeValue)} relative`,
  finding: "The selected activation journey converted below its previous-period baseline.",
  detail: `${coreConversionMetric.previousValue} → ${coreConversionMetric.currentValue}. Displayed rates are rounded to one decimal; the ${relativeChange} decline is a relative change, not a percentage-point change.`,
  source: "Core conversion comparison · Mock data",
};

export const coreConversionDropoffSignal: BehaviorSignal = {
  id: evidenceIds.behavior,
  label: "Largest drop-off",
  value: "Step 2 → Step 3",
  finding: "The largest transition decline appears between Workspace creation and data-source connection.",
  detail: "Step completion moved from 65.0% to 62.0%; adjacent steps changed by less than one percentage point.",
  source: "Activation journey comparison · Mock data",
};

const coreConversionSegmentSignal: BehaviorSignal = {
  id: evidenceIds.segment,
  label: "Affected segment",
  value: "Largest decline",
  finding: `${coreConversionContext.platform.label} ${coreConversionContext.segment.label.toLowerCase()} on ${coreConversionContext.version.label} show the strongest deterioration.`,
  detail: "The pattern is concentrated in the selected segment rather than distributed evenly across comparable workspaces.",
  source: "Segment comparison · Mock data",
};

export const coreConversionDiagnosticCase: DiagnosticCase = {
  id: "core-conversion-decline",
  source: "mock",
  status: "ready",
  severity: "MEDIUM",
  title: "Core conversion declined",
  metric: coreConversionMetric,
  context: coreConversionContext,
  summary: {
    changed: `${coreConversionMetric.label} fell from ${coreConversionMetric.previousValue} to ${coreConversionMetric.currentValue}, down ${relativeChange} relative to the previous period.`,
    affected: `${coreConversionContext.platform.label} · ${coreConversionContext.segment.label} · ${coreConversionContext.version.label} showed the strongest deterioration.`,
    started: "The decline appears in cohorts entering after the selected release window.",
  },
  evidence: {
    behaviorSignals: [
      coreConversionMetricSignal,
      coreConversionDropoffSignal,
      coreConversionSegmentSignal,
    ],
    feedbackSignals: [
      {
        id: evidenceIds.feedback,
        topic: "Data source connection setup",
        mentionCount: 31,
        change: "+42%",
        sentiment: "Negative",
        finding: "More feedback mentioned unclear permissions or lost setup progress.",
        source: `${coreConversionContext.dateRange.label} · 31 mock feedback items`,
        snippets: [
          "I returned from the connection screen and was back at the start, so I was not sure it worked.",
          "I could not tell why those permissions were needed, so I stopped.",
        ],
      },
    ],
  },
  reasoning: {
    observation: {
      statement: "Core conversion is below its previous-period baseline. The largest transition decline appears before data-source connection, the deterioration is concentrated in the affected segment, and related setup feedback also increased.",
      evidenceIds: [evidenceIds.metric, evidenceIds.behavior, evidenceIds.segment, evidenceIds.feedback],
    },
    inference: {
      statement: "The decline may be associated with increased uncertainty or lost setup state during data-source connection. Acquisition mix, connector mix, or instrumentation changes remain possible explanations.",
      evidenceIds: [evidenceIds.behavior, evidenceIds.segment, evidenceIds.feedback],
      status: "Possible explanation · Not confirmed",
    },
    hypothesis: {
      statement: "Explaining required permissions before authorization and preserving setup progress after the redirect may improve Step 2 → Step 3 completion for the affected segment.",
      evidenceIds: [evidenceIds.behavior, evidenceIds.feedback],
      status: "Unvalidated hypothesis",
    },
  },
  traceSteps: [
    {
      id: "trace-conversion-metric",
      label: "Conversion signal checked",
      description: "Compared the mock Core Conversion signal with its previous-period baseline.",
      status: "mock-checked",
      evidenceIds: [evidenceIds.metric],
    },
    {
      id: "trace-conversion-behavior",
      label: "Behavior evidence checked",
      description: "Reviewed the mock activation-journey evidence linked to this case.",
      status: "mock-checked",
      evidenceIds: [evidenceIds.behavior],
    },
    {
      id: "trace-conversion-segment",
      label: "Affected segment checked",
      description: "Reviewed the mock platform, user-scope, and release-version breakdown.",
      status: "mock-checked",
      evidenceIds: [evidenceIds.segment],
    },
    {
      id: "trace-conversion-feedback",
      label: "Related feedback checked",
      description: "Reviewed the linked mock setup feedback and representative snippets.",
      status: "mock-checked",
      evidenceIds: [evidenceIds.feedback],
    },
  ],
  nextValidations: [
    {
      id: "verify-conversion-events",
      label: "Verify conversion events",
      description: "Check whether the selected release changed or missed connection events.",
    },
    {
      id: "inspect-step-transition",
      label: "Inspect Step 2 → Step 3",
      description: "Compare the transition by date and connector type within the same context.",
    },
    {
      id: "compare-versions",
      label: "Compare V3.1 vs V3.2",
      description: "Match acquisition channel and workspace size before comparing versions.",
    },
    {
      id: "validate-setup-hypothesis",
      label: "Validate setup hypothesis",
      description: "Review linked feedback and run a focused usability validation.",
    },
  ],
};
