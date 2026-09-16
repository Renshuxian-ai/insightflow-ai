import { DATASET_PRIMARY_ANOMALY_ID } from "@/lib/diagnostics/dataset-diagnostic-case";
import type {
  BehaviorSignal,
  DiagnosticCase,
  FeedbackSignal,
} from "@/lib/diagnostics/types";

import type {
  AnalyticsActivityInvestigationContext,
  AnalyticsFeedbackInvestigationContext,
  AnalyticsFunnelInvestigationContext,
  AnalyticsInvestigationContext,
  AnalyticsRetentionInvestigationContext,
  AnalyticsRetentionInterval,
} from "./investigation-context";

function formatRate(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatGap(value: number) {
  const sign = value > 0 ? "+" : "";

  return `${sign}${value.toFixed(1)} pp`;
}

function formatRelativeChange(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function evidenceSource(
  datasetBacked: boolean,
  source: string,
): string {
  return datasetBacked ? `Uploaded dataset · ${source}` : source;
}

function getActivityDiagnosticCase(
  context: AnalyticsActivityInvestigationContext,
): DiagnosticCase | null {
  const activity = context.activity;

  if (activity.gap >= 0) {
    return null;
  }

  const metricEvidenceId = "analytics-activity-dau-evidence";
  const windowEvidenceId = "analytics-activity-window-evidence";
  const finding = `Average daily active users declined from ${activity.baselineValue.toFixed(1)} in ${activity.previousPeriod} to ${activity.currentValue.toFixed(1)} in ${activity.currentPeriod} (${activity.gap.toFixed(1)} users).`;

  return {
    id: DATASET_PRIMARY_ANOMALY_ID,
    source: "dataset",
    status: "ready",
    severity: Math.abs(activity.gap) >= 20 ? "HIGH" : "MEDIUM",
    title: "Daily active users declined",
    primarySignal: {
      metric: "daily_active_users",
      interval: activity.currentPeriod,
      segmentDimension: "analysis window",
      segment: "All observed users",
      currentValue: activity.currentValue,
      baselineValue: activity.baselineValue,
      gap: activity.gap,
      affectedUsers: activity.affectedUsers,
    },
    metric: {
      id: "activity-dau",
      label: "Daily active users",
      currentValue: activity.currentValue.toFixed(1),
      previousValue: activity.baselineValue.toFixed(1),
      changeValue: activity.gap,
      comparison: `${activity.currentPeriod} vs. ${activity.previousPeriod}`,
    },
    context: {
      dateRange: {
        id: "analytics-activity-window",
        label: `${activity.currentPeriod} vs. ${activity.previousPeriod}`,
      },
      segment: {
        id: "analytics-activity-all-users",
        label: "All observed users",
      },
      platform: { id: "analytics-activity-platform", label: "All platforms" },
      version: { id: "analytics-activity-version", label: "Not segmented" },
    },
    summary: {
      changed: finding,
      affected: `${activity.affectedUsers.toLocaleString("en-US")} average daily active users are represented in the current window.`,
      started:
        "The uploaded activity evidence does not identify the product change that caused the decline.",
    },
    evidence: {
      behaviorSignals: [
        {
          id: metricEvidenceId,
          label: "Average daily active users",
          value: `${activity.currentValue.toFixed(1)} users`,
          finding,
          detail: `The measured gap is ${activity.gap.toFixed(1)} users against the adjacent baseline window.`,
          source: evidenceSource(true, "Trends Analytics 路 DAU comparison"),
        },
        {
          id: windowEvidenceId,
          label: "Activity comparison windows",
          value: activity.currentPeriod,
          finding: `The signal compares ${activity.currentPeriod} with ${activity.previousPeriod}.`,
          detail:
            "The comparison uses aggregate activity evidence and does not establish causation.",
          source: evidenceSource(true, "Trends Analytics 路 activity windows"),
        },
      ],
      feedbackSignals: [],
    },
    reasoning: {
      observation: {
        statement: finding,
        evidenceIds: [metricEvidenceId, windowEvidenceId],
      },
      inference: {
        statement:
          "The observed activity decline warrants investigation before attributing it to a product change.",
        evidenceIds: [metricEvidenceId, windowEvidenceId],
        status: "Supported by uploaded activity evidence",
      },
      hypothesis: {
        statement:
          "The current evidence does not identify a cause; segment and event-level validation are required before proposing one.",
        evidenceIds: [metricEvidenceId],
        status: "Cause not determined",
      },
    },
    traceSteps: [
      {
        id: "analytics-activity-trace-primary-signal",
        label: "Primary signal: daily active users",
        description: `Anchored the investigation on the ${activity.gap.toFixed(1)} user DAU gap.`,
        status: "dataset-calculated",
        evidenceIds: [metricEvidenceId],
      },
      {
        id: "analytics-activity-trace-window-context",
        label: "Activity window context",
        description: "Added adjacent seven-day activity windows as supporting context.",
        status: "dataset-calculated",
        evidenceIds: [windowEvidenceId],
      },
    ],
    nextValidations: [
      {
        id: "analytics-activity-segment-review",
        label: "Compare activity by segment",
        description:
          "Compare activity changes across available user segments before proposing a cause.",
      },
      {
        id: "analytics-activity-event-review",
        label: "Review key event activity",
        description:
          "Check whether key event activity changed across the same comparison windows.",
      },
    ],
  };
}

function getDatasetRetentionDiagnosticCase(
  context: AnalyticsRetentionInvestigationContext,
  focusInterval: AnalyticsRetentionInterval,
): DiagnosticCase | null {
  const cohort = context.selectedCohort;
  const metricEvidence = context.metricEvidence.intervals.find(
    (interval) => interval.interval === focusInterval,
  );

  if (!cohort || !metricEvidence) {
    return null;
  }

  const metricEvidenceId = "analytics-retention-metric-evidence";
  const windowEvidenceId = "analytics-retention-window-evidence";
  const segmentEvidenceId = "analytics-retention-segment-evidence";
  const finding = `${focusInterval} retention changed from ${formatRate(metricEvidence.baselineRate)} in the baseline window to ${formatRate(metricEvidence.currentRate)} in the current window (${formatGap(metricEvidence.gapPercentagePoints)}).`;
  const segment =
    context.segmentEvidence?.dimension !== "analysis window"
      ? context.segmentEvidence
      : null;
  const segmentInterval =
    focusInterval === "D1" || focusInterval === "D7" || focusInterval === "D30"
      ? focusInterval
      : "D7";
  const segmentCurrentValue = segment?.retention[segmentInterval] ?? null;
  const segmentBaselineValue =
    segment?.comparisonRetention[segmentInterval] ?? null;
  const segmentGap =
    segmentCurrentValue !== null && segmentBaselineValue !== null
      ? segmentCurrentValue - segmentBaselineValue
      : null;
  const hasSegmentPrimary = Boolean(
    segment && segmentGap !== null && segmentGap < 0,
  );
  const segmentFinding =
    segment && segmentCurrentValue !== null && segmentBaselineValue !== null
      ? `${segment.segment} ${segment.dimension} evidence shows ${formatRate(segmentCurrentValue)} ${segmentInterval} retention, compared with ${formatRate(segmentBaselineValue)} for ${segment.comparisonSegment} (${formatGap(segmentCurrentValue - segmentBaselineValue)}).`
      : null;

  if (metricEvidence.gapPercentagePoints >= 0 && !hasSegmentPrimary) {
    return null;
  }
  const windowSignals: [BehaviorSignal, ...BehaviorSignal[]] = [
    {
      id: metricEvidenceId,
      label: `${focusInterval} retention decline`,
      value: `${formatRate(metricEvidence.currentRate)} · ${formatGap(metricEvidence.gapPercentagePoints)}`,
      finding,
      detail: `${metricEvidence.currentRetainedUsers.toLocaleString("en-US")} retained users are represented in the current evidence, compared with ${metricEvidence.baselineRetainedUsers.toLocaleString("en-US")} in the baseline evidence.`,
      source: evidenceSource(true, "Retention Analytics · interval comparison"),
    },
    {
      id: windowEvidenceId,
      label: "Retention comparison window",
      value: cohort.date,
      finding: `${cohort.users.toLocaleString("en-US")} users are represented in the current estimated analysis window.`,
      detail: context.metricEvidence.window,
      source: evidenceSource(true, "Retention Analytics · estimated windows"),
    },
  ];
  const segmentSignal: BehaviorSignal | null =
    hasSegmentPrimary &&
    segment &&
    segmentFinding &&
    segmentCurrentValue !== null &&
    segmentGap !== null
      ? {
          id: segmentEvidenceId,
          label: `${segment.dimension} · ${segment.segment}`,
          value: `${formatRate(segmentCurrentValue)} · ${formatGap(segmentGap)}`,
          finding: segmentFinding,
          detail: `${segment.users.toLocaleString("en-US")} affected users are represented by this uploaded segment evidence.`,
          source: evidenceSource(
            true,
            "Retention Analytics · segment breakdown",
          ),
        }
      : null;
  const behaviorSignals: [BehaviorSignal, ...BehaviorSignal[]] = segmentSignal
    ? [segmentSignal, ...windowSignals]
    : windowSignals;

  return {
    id: DATASET_PRIMARY_ANOMALY_ID,
    source: "dataset",
    status: "ready",
    severity:
      Math.abs(
        hasSegmentPrimary && segmentGap !== null
          ? segmentGap
          : metricEvidence.gapPercentagePoints,
      ) >= 20
        ? "HIGH"
        : "MEDIUM",
    title:
      hasSegmentPrimary && segment
        ? `${segment.segment} shows lower ${segmentInterval} retention compared with baseline`
        : `${focusInterval} retention declined`,
    ...(context.investigationTarget
      ? {
          investigationTarget: {
            id: context.investigationTarget.id,
            title: context.investigationTarget.title,
            relatedSegment: context.investigationTarget.relatedSegment,
          },
        }
      : {}),
    primarySignal:
      hasSegmentPrimary && segment && segmentCurrentValue !== null && segmentBaselineValue !== null && segmentGap !== null
        ? {
            metric: "retention",
            interval: segmentInterval,
            segmentDimension: segment.dimension,
            segment: segment.segment,
            currentValue: segmentCurrentValue,
            baselineValue: segmentBaselineValue,
            gap: segmentGap,
            affectedUsers: segment.users,
          }
        : {
            metric: "retention",
            interval: focusInterval,
            segmentDimension: "analysis window",
            segment: "Current window",
            currentValue: metricEvidence.currentRate,
            baselineValue: metricEvidence.baselineRate,
            gap: metricEvidence.gapPercentagePoints,
            affectedUsers: cohort.users,
          },
    metric: {
      id: `retention-${focusInterval.toLocaleLowerCase("en-US")}`,
      label: `${focusInterval} Retention`,
      currentValue: formatRate(metricEvidence.currentRate),
      previousValue: formatRate(metricEvidence.baselineRate),
      changeValue: metricEvidence.gapPercentagePoints,
      changeType: "percentage-points",
      comparison: context.metricEvidence.window,
    },
    context: {
      dateRange: {
        id: "analytics-retention-window",
        label: cohort.date,
      },
      segment: {
        id: "analytics-retention-current-window",
        label: hasSegmentPrimary && segment
          ? `${segment.dimension}: ${segment.segment}`
          : "Current analysis window",
      },
      platform: {
        id: "analytics-retention-platform",
        label:
          hasSegmentPrimary && segment?.dimension.toLocaleLowerCase("en-US") === "platform"
            ? segment.segment
            : "All platforms",
      },
      version: {
        id: "analytics-retention-version",
        label: "Not segmented",
      },
    },
    summary: {
      changed: finding,
      affected:
        hasSegmentPrimary && segment
          ? `${segment.users.toLocaleString("en-US")} users are represented by the ${segment.dimension} segment evidence for ${segment.segment}.`
          : `${cohort.users.toLocaleString("en-US")} users are represented in the current estimated window.`,
      started:
        "The uploaded retention evidence does not identify when or why the decline began.",
    },
    evidence: {
      behaviorSignals,
      feedbackSignals: [],
    },
    reasoning: {
      observation: {
        statement: segmentFinding ? `${segmentFinding} ${finding}` : finding,
        evidenceIds: hasSegmentPrimary
          ? [segmentEvidenceId, metricEvidenceId, windowEvidenceId]
          : [metricEvidenceId, windowEvidenceId],
      },
      inference: {
        statement: hasSegmentPrimary && segment
          ? `${segment.segment} ${segmentInterval} retention is lower than the observed benchmark and requires investigation.`
          : `${focusInterval} retention is lower in the current window and requires investigation.`,
        evidenceIds: hasSegmentPrimary
          ? [segmentEvidenceId, metricEvidenceId]
          : [metricEvidenceId, windowEvidenceId],
        status: "Supported by uploaded retention evidence",
      },
      hypothesis: {
        statement:
          "The available evidence does not identify a cause; behavioral validation is required before proposing one.",
        evidenceIds: [metricEvidenceId],
        status: "Cause not determined",
      },
    },
    traceSteps: [
      ...(hasSegmentPrimary && segment && segmentGap !== null
        ? [{
            id: "analytics-retention-trace-segment",
            label: `Primary signal: ${segment.segment} ${segmentInterval} retention`,
            description: `Anchored the investigation on ${segment.segment} ${segmentInterval} retention compared with ${segment.comparisonSegment} (${formatGap(segmentGap)}).`,
            status: "dataset-calculated" as const,
            evidenceIds: [segmentEvidenceId],
          }]
        : [{
            id: "analytics-retention-trace-primary-signal",
            label: `Primary signal: ${focusInterval} retention`,
            description: `Anchored the investigation on the ${formatGap(metricEvidence.gapPercentagePoints)} ${focusInterval} retention gap.`,
            status: "dataset-calculated" as const,
            evidenceIds: [metricEvidenceId],
          }]),
      {
        id: "analytics-retention-trace-window-context",
        label: "Estimated window context",
        description:
          "Added the current and baseline windows as supporting comparison context.",
        status: "dataset-calculated",
        evidenceIds: [windowEvidenceId],
      },
    ],
    nextValidations: [
      {
        id: "analytics-compare-onboarding-funnel",
        label: "Compare onboarding funnel",
        description:
          "Compare onboarding completion and drop-off for the current and baseline analysis windows.",
      },
      {
        id: "analytics-review-feature-adoption",
        label: "Review feature adoption",
        description:
          "Check whether feature adoption differs between the current and baseline windows.",
      },
      {
        id: "analytics-analyze-user-engagement",
        label: "Analyze user engagement",
        description:
          "Compare engagement evidence before forming a causal hypothesis.",
      },
    ],
  };
}

function getRetentionDiagnosticCase(
  context: AnalyticsRetentionInvestigationContext,
): DiagnosticCase | null {
  const cohort = context.selectedCohort;
  const segment = context.segmentEvidence;
  const focusInterval: AnalyticsRetentionInterval =
    context.selectedInterval ?? "D7";
  const metricEvidence = context.metricEvidence.intervals.find(
    (interval) => interval.interval === focusInterval,
  );

  if (context.datasetEvidence?.source === "uploaded-dataset") {
    return getDatasetRetentionDiagnosticCase(context, focusInterval);
  }

  if (!cohort || !segment || !metricEvidence) {
    return null;
  }

  const segmentInterval =
    focusInterval === "D1" || focusInterval === "D7" || focusInterval === "D30"
      ? focusInterval
      : "D7";
  const segmentCurrentValue = segment.retention[segmentInterval];
  const segmentBaselineValue = segment.comparisonRetention[segmentInterval];

  const metricEvidenceId = "analytics-retention-metric-evidence";
  const cohortEvidenceId = "analytics-retention-cohort-evidence";
  const segmentEvidenceId = "analytics-retention-segment-evidence";
  const segmentGap = segmentCurrentValue - segmentBaselineValue;

  if (segmentGap >= 0) {
    return null;
  }

  const metricFinding = `${cohort.date} cohort ${focusInterval} retention is ${formatRate(metricEvidence.currentRate)}, compared with the ${formatRate(metricEvidence.baselineRate)} baseline (${formatGap(metricEvidence.gapPercentagePoints)}).`;
  const segmentFinding = `${segment.segment} ${segment.dimension} evidence shows ${formatRate(segmentCurrentValue)} ${segmentInterval} retention, compared with ${formatRate(segmentBaselineValue)} for ${segment.comparisonSegment} (${formatGap(segmentGap)}).`;
  const behaviorSignals: [BehaviorSignal, ...BehaviorSignal[]] = [
    {
      id: metricEvidenceId,
      label: `${focusInterval} Retention`,
      value: `${formatRate(metricEvidence.currentRate)} · ${formatGap(metricEvidence.gapPercentagePoints)}`,
      finding: metricFinding,
      detail: `${metricEvidence.currentRetainedUsers} retained users compared with ${metricEvidence.baselineRetainedUsers} in the baseline evidence.`,
      source: "Retention Analytics · cohort comparison",
    },
    {
      id: segmentEvidenceId,
      label: `${segment.dimension} · ${segment.segment}`,
      value: `${formatRate(segmentCurrentValue)} · ${formatGap(segmentGap)}`,
      finding: segmentFinding,
      detail: `${segment.users.toLocaleString("en-US")} affected users are represented by this segment evidence.`,
      source: "Retention Analytics · segment breakdown",
    },
    {
      id: cohortEvidenceId,
      label: "Selected retention cohort",
      value: cohort.date,
      finding: `${cohort.users.toLocaleString("en-US")} users entered the selected cohort.`,
      detail: `${focusInterval} is the investigation interval for this Analytics context.`,
      source: "Retention Analytics · cohort matrix",
    },
  ];
  const severity = Math.abs(segmentGap) >= 20 ? "HIGH" : "MEDIUM";

  return {
    id: DATASET_PRIMARY_ANOMALY_ID,
    source: "dataset",
    status: "ready",
    severity,
    title: `${segment.segment} shows lower ${segmentInterval} retention compared with baseline`,
    ...(context.investigationTarget
      ? {
          investigationTarget: {
            id: context.investigationTarget.id,
            title: context.investigationTarget.title,
            relatedSegment: context.investigationTarget.relatedSegment,
          },
        }
      : {}),
    primarySignal: {
      metric: "retention",
      interval: segmentInterval,
      segmentDimension: segment.dimension,
      segment: segment.segment,
      currentValue: segmentCurrentValue,
      baselineValue: segmentBaselineValue,
      gap: segmentGap,
      affectedUsers: segment.users,
    },
    metric: {
      id: `retention-${focusInterval.toLocaleLowerCase("en-US")}`,
      label: `${focusInterval} Retention`,
      currentValue: formatRate(metricEvidence.currentRate),
      previousValue: formatRate(metricEvidence.baselineRate),
      changeValue: metricEvidence.gapPercentagePoints,
      changeType: "percentage-points",
      comparison: `${cohort.date} cohort vs. retention baseline`,
    },
    context: {
      dateRange: {
        id: "analytics-retention-cohort",
        label: `Selected cohort: ${cohort.date}`,
      },
      segment: {
        id: "analytics-retention-segment",
        label: `${segment.dimension}: ${segment.segment}`,
      },
      platform: {
        id: "analytics-retention-platform",
        label:
          segment.dimension.toLocaleLowerCase("en-US") === "platform"
            ? segment.segment
            : "All platforms",
      },
      version: {
        id: "analytics-retention-version",
        label: "Not segmented",
      },
    },
    summary: {
      changed: segmentFinding,
      affected: `${segment.users.toLocaleString("en-US")} users are represented by the ${segment.dimension} segment evidence for ${segment.segment}.`,
      started:
        "The selected Retention Analytics evidence does not establish when or why the difference began.",
    },
    evidence: {
      behaviorSignals,
      feedbackSignals: [],
    },
    reasoning: {
      observation: {
        statement: `${segmentFinding} ${metricFinding}`,
        evidenceIds: [segmentEvidenceId, metricEvidenceId, cohortEvidenceId],
      },
      inference: {
        statement:
          "The selected cohort and segment contain a retention gap that warrants further investigation.",
        evidenceIds: [metricEvidenceId, segmentEvidenceId],
        status: "Supported by Retention Analytics evidence",
      },
      hypothesis: {
        statement:
          "The current evidence does not identify a cause; behavior and engagement checks are required before proposing one.",
        evidenceIds: [metricEvidenceId, segmentEvidenceId],
        status: "Cause not determined",
      },
    },
    traceSteps: [
      {
        id: "analytics-retention-trace-segment",
        label: `Primary signal: ${segment.segment} ${segmentInterval} retention`,
        description: `Anchored the investigation on ${segment.segment} ${segmentInterval} retention at ${formatRate(segmentCurrentValue)}, compared with ${segment.comparisonSegment} at ${formatRate(segmentBaselineValue)} (${formatGap(segmentGap)}).`,
        status: "dataset-calculated",
        evidenceIds: [segmentEvidenceId],
      },
      {
        id: "analytics-retention-trace-cohort",
        label: "Cohort retention supporting context",
        description: `Added ${focusInterval} retention for the ${cohort.date} cohort and its baseline as supporting context only.`,
        status: "dataset-calculated",
        evidenceIds: [metricEvidenceId, cohortEvidenceId],
      },
    ],
    nextValidations: [
      {
        id: "analytics-compare-onboarding-funnel",
        label: "Compare onboarding funnel",
        description:
          "Compare onboarding completion and drop-off for the selected cohort and segment against the baseline.",
      },
      {
        id: "analytics-review-feature-adoption",
        label: "Review feature adoption",
        description:
          "Check whether feature adoption differs for the selected cohort without treating the difference as a confirmed cause.",
      },
      {
        id: "analytics-analyze-user-engagement",
        label: "Analyze user engagement",
        description:
          "Compare engagement behavior for the selected cohort and segment before forming a causal hypothesis.",
      },
    ],
  };
}

function getFunnelDiagnosticCase(
  context: AnalyticsFunnelInvestigationContext,
): DiagnosticCase {
  const { from, to } = context.funnelStepTransition;
  const datasetBacked = context.datasetEvidence?.source === "uploaded-dataset";
  const transitionLabel = `${from.label} → ${to.label}`;
  const primaryEvidenceId = "analytics-funnel-primary-dropoff-evidence";
  const versionEvidenceId = "analytics-funnel-version-context-evidence";
  const comparisonEvidenceId =
    "analytics-funnel-transition-comparison-evidence";
  const transitionFinding = `${transitionLabel} completion is ${formatRate(context.currentCompletionRate)} in ${context.currentVersion}, compared with ${formatRate(context.baselineCompletionRate)} in ${context.previousVersion} (${formatGap(context.gap)}).`;
  const behaviorSignals: [BehaviorSignal, ...BehaviorSignal[]] = [
    {
      id: primaryEvidenceId,
      label: `${to.label} drop-off`,
      value: `${context.dropOffUsers.toLocaleString("en-US")} users lost`,
      finding: `${context.dropOffUsers.toLocaleString("en-US")} users were lost at the ${transitionLabel} transition in ${context.currentVersion}.`,
      detail:
        "This is the largest measured step-level drop-off in the current funnel journey.",
      source: evidenceSource(datasetBacked, "Funnel Analytics · step drop-off"),
    },
    {
      id: versionEvidenceId,
      label: "Funnel version context",
      value: `${context.currentVersion} vs. ${context.previousVersion}`,
      finding: `The current funnel signal compares ${context.currentVersion} with ${context.previousVersion}.`,
      detail:
        "The version comparison provides supporting context and does not establish a cause.",
      source: evidenceSource(datasetBacked, "Funnel Analytics · version context"),
    },
    {
      id: comparisonEvidenceId,
      label: "Transition completion comparison",
      value: `${formatRate(context.currentCompletionRate)} · ${formatGap(context.gap)}`,
      finding: transitionFinding,
      detail: `The baseline completion rate for the same transition is ${formatRate(context.baselineCompletionRate)}.`,
      source: evidenceSource(
        datasetBacked,
        "Funnel Analytics · transition comparison",
      ),
    },
  ];

  return {
    id: DATASET_PRIMARY_ANOMALY_ID,
    source: "dataset",
    status: "ready",
    severity: Math.abs(context.gap) >= 20 ? "HIGH" : "MEDIUM",
    title: datasetBacked
      ? `Conversion dropped at ${transitionLabel}`
      : `${to.label} has the largest funnel drop-off`,
    primarySignal: {
      metric: "funnel_conversion",
      interval: transitionLabel,
      segmentDimension: "Funnel step",
      segment: to.label,
      currentValue: context.currentCompletionRate,
      baselineValue: context.baselineCompletionRate,
      gap: context.gap,
      affectedUsers: context.dropOffUsers,
    },
    metric: {
      id: "funnel-conversion",
      label: "Funnel conversion",
      currentValue: formatRate(context.currentCompletionRate),
      previousValue: formatRate(context.baselineCompletionRate),
      changeValue: context.gap,
      changeType: "percentage-points",
      comparison: `${context.currentVersion} vs. ${context.previousVersion}`,
    },
    context: {
      dateRange: {
        id: "analytics-funnel-comparison-window",
        label: "Funnel version comparison",
      },
      segment: {
        id: "analytics-funnel-transition",
        label: transitionLabel,
      },
      platform: {
        id: "analytics-funnel-platform",
        label: "All platforms",
      },
      version: {
        id: "analytics-funnel-version",
        label: `${context.currentVersion} vs. ${context.previousVersion}`,
      },
    },
    summary: {
      changed: transitionFinding,
      affected: `${context.dropOffUsers.toLocaleString("en-US")} users were lost at the selected transition in the current funnel.`,
      started:
        "The supplied Funnel Analytics evidence does not establish when or why the drop-off began.",
    },
    evidence: {
      behaviorSignals,
      feedbackSignals: [],
    },
    reasoning: {
      observation: {
        statement: `${transitionFinding} ${context.dropOffUsers.toLocaleString("en-US")} users were lost at this transition.`,
        evidenceIds: [
          primaryEvidenceId,
          comparisonEvidenceId,
          versionEvidenceId,
        ],
      },
      inference: {
        statement: `The measured funnel loss is concentrated at the ${transitionLabel} transition and requires investigation.`,
        evidenceIds: [primaryEvidenceId, comparisonEvidenceId],
        status: "Supported by Funnel Analytics evidence",
      },
      hypothesis: {
        statement:
          "The current evidence does not identify a cause; step-level behavior and event-quality checks are required before proposing one.",
        evidenceIds: [primaryEvidenceId, comparisonEvidenceId],
        status: "Cause not determined",
      },
    },
    traceSteps: [
      {
        id: "analytics-funnel-trace-primary-dropoff",
        label: `Primary signal: ${transitionLabel}`,
        description: `Anchored the investigation on the ${context.dropOffUsers.toLocaleString("en-US")}-user drop-off at ${transitionLabel}.`,
        status: "dataset-calculated",
        evidenceIds: [primaryEvidenceId],
      },
      {
        id: "analytics-funnel-trace-comparison",
        label: "Transition comparison context",
        description: `Added the ${context.currentVersion} and ${context.previousVersion} completion rates as supporting comparison evidence.`,
        status: "dataset-calculated",
        evidenceIds: [comparisonEvidenceId, versionEvidenceId],
      },
    ],
    nextValidations: [
      {
        id: "funnel-dropoff-analysis",
        label: "Analyze funnel step completion",
        description:
          "Validate whether the largest drop-off remains concentrated at the selected funnel transition.",
      },
      {
        id: "funnel-segment-comparison",
        label: "Compare affected user segments",
        description:
          "Compare the selected transition across user segments using the same funnel definition.",
      },
    ],
  };
}

function getFeedbackDiagnosticCase(
  context: AnalyticsFeedbackInvestigationContext,
): DiagnosticCase | null {
  if (context.topic.change === null) {
    return null;
  }
  const topicVolumeEvidenceId = "analytics-feedback-topic-volume-evidence";
  const sentimentEvidenceId = "analytics-feedback-sentiment-evidence";
  const quoteEvidenceId = "analytics-feedback-user-quotes-evidence";
  const relatedSignalEvidenceId = "analytics-feedback-related-signal-evidence";
  const previousMentionEstimate =
    context.topic.mentions / (1 + context.topic.change / 100);
  const mentionGap = context.topic.mentions - previousMentionEstimate;
  const sentimentLabel =
    context.topic.sentiment === "negative" ? "Negative" : "Mixed";
  const datasetBacked = context.datasetEvidence?.source === "uploaded-dataset";
  const topicFinding = `${context.topic.name} received ${context.topic.mentions.toLocaleString("en-US")} mentions, ${formatRelativeChange(context.topic.change)} compared with the previous period.`;
  const behaviorSignals: [BehaviorSignal, ...BehaviorSignal[]] = [
    {
      id: topicVolumeEvidenceId,
      label: `${context.topic.name} mention volume`,
      value: `${context.topic.mentions.toLocaleString("en-US")} mentions`,
      finding: topicFinding,
      detail:
        "The topic is an AI-grouped feedback pattern and should be validated against its underlying evidence.",
      source: evidenceSource(
        datasetBacked,
        "Feedback Intelligence · topic aggregation",
      ),
    },
    {
      id: sentimentEvidenceId,
      label: `${context.topic.name} sentiment`,
      value: sentimentLabel,
      finding: `${context.topic.name} is classified as ${context.topic.sentiment} sentiment in the current aggregate feedback evidence.`,
      detail:
        "Sentiment classification describes the supplied feedback pattern and does not establish its cause.",
      source: evidenceSource(
        datasetBacked,
        "Feedback Intelligence · sentiment aggregation",
      ),
    },
  ];

  if (context.relatedSignal) {
    behaviorSignals.push({
      id: relatedSignalEvidenceId,
      label: context.relatedSignal.name,
      value: formatRelativeChange(context.relatedSignal.change),
      finding: `${context.relatedSignal.name} changed ${formatRelativeChange(context.relatedSignal.change)} in the linked product signal.`,
      detail:
        "The linked timing is supporting context only and does not prove that the feedback topic caused the product signal.",
      source: evidenceSource(
        datasetBacked,
        "Feedback Intelligence · linked Analytics signal",
      ),
    });
  }
  const feedbackSignals: [FeedbackSignal] = [
    {
      id: quoteEvidenceId,
      topic: context.topic.name,
      mentionCount: context.topic.mentions,
      change: formatRelativeChange(context.topic.change),
      sentiment: sentimentLabel,
      finding: `${context.evidenceQuotes.length} representative user quote${context.evidenceQuotes.length === 1 ? "" : "s"} support the ${context.topic.name} feedback pattern.`,
      source: evidenceSource(
        datasetBacked,
        "Feedback Intelligence · representative user feedback",
      ),
      snippets: [...context.evidenceQuotes],
    },
  ];

  return {
    id: DATASET_PRIMARY_ANOMALY_ID,
    source: "dataset",
    status: "ready",
    severity:
      context.topic.sentiment === "negative" && context.topic.change >= 25
        ? "HIGH"
        : "MEDIUM",
    title: datasetBacked
      ? `${sentimentLabel} feedback increased for ${context.topic.name}`
      : `${context.topic.name} feedback is increasing`,
    primarySignal: {
      metric: "feedback_topic",
      interval: "current period",
      segmentDimension: "feedback topic",
      segment: context.topic.name,
      currentValue: context.topic.mentions,
      baselineValue: previousMentionEstimate,
      gap: mentionGap,
      affectedUsers: context.topic.mentions,
    },
    metric: {
      id: "feedback-topic-mentions",
      label: "Feedback topic mentions",
      currentValue: `${context.topic.mentions.toLocaleString("en-US")} mentions`,
      previousValue: `${previousMentionEstimate.toFixed(1)} estimated mentions`,
      changeValue: context.topic.change,
      changeType: "relative-percent",
      comparison: "Current feedback period vs. previous period",
    },
    context: {
      dateRange: {
        id: "analytics-feedback-comparison-period",
        label: "Current feedback period vs. previous period",
      },
      segment: {
        id: "analytics-feedback-affected-segment",
        label: context.affectedSegment,
      },
      platform: {
        id: "analytics-feedback-platform",
        label: "All platforms",
      },
      version: {
        id: "analytics-feedback-version",
        label: "All versions",
      },
    },
    summary: {
      changed: topicFinding,
      affected: `${context.affectedSegment} is the affected segment attached to this feedback pattern.`,
      started:
        "The available feedback evidence does not establish when the underlying product issue began or what caused it.",
    },
    evidence: {
      behaviorSignals,
      feedbackSignals,
    },
    reasoning: {
      observation: {
        statement: context.relatedSignal
          ? `${topicFinding} The linked signal ${context.relatedSignal.name} changed ${formatRelativeChange(context.relatedSignal.change)}.`
          : `${topicFinding} No linked product signal is available in the uploaded dataset evidence.`,
        evidenceIds: [
          topicVolumeEvidenceId,
          sentimentEvidenceId,
          quoteEvidenceId,
          ...(context.relatedSignal ? [relatedSignalEvidenceId] : []),
        ],
      },
      inference: {
        statement: context.relatedSignal
          ? `${context.topic.name} is an increasing feedback pattern for ${context.affectedSegment} that warrants investigation alongside the linked product signal.`
          : `${context.topic.name} is an increasing feedback pattern for ${context.affectedSegment} that warrants investigation without assuming a product-metric relationship.`,
        evidenceIds: [
          topicVolumeEvidenceId,
          sentimentEvidenceId,
          quoteEvidenceId,
          ...(context.relatedSignal ? [relatedSignalEvidenceId] : []),
        ],
        status: "Supported by aggregate feedback and linked-signal evidence",
      },
      hypothesis: {
        statement:
          "The current evidence does not identify a cause; topic distribution and linked-signal timing must be validated first.",
        evidenceIds: [topicVolumeEvidenceId, quoteEvidenceId],
        status: "Cause not determined",
      },
    },
    traceSteps: [
      {
        id: "analytics-feedback-trace-primary-topic",
        label: `Primary signal: ${context.topic.name}`,
        description: `Anchored the investigation on ${context.topic.mentions.toLocaleString("en-US")} mentions and ${formatRelativeChange(context.topic.change)} topic growth.`,
        status: "dataset-calculated",
        evidenceIds: [
          topicVolumeEvidenceId,
          sentimentEvidenceId,
          quoteEvidenceId,
        ],
      },
      ...(context.relatedSignal
        ? [{
            id: "analytics-feedback-trace-related-signal",
            label: "Linked product signal context",
            description: `Added ${context.relatedSignal.name} as supporting context without treating the relationship as causal.`,
            status: "dataset-calculated" as const,
            evidenceIds: [relatedSignalEvidenceId],
          }]
        : []),
    ],
    nextValidations: [
      {
        id: "feedback-segment-review",
        label: "Review feedback by affected segment",
        description: `Compare ${context.topic.name} feedback prevalence for ${context.affectedSegment} against other available segments.`,
      },
      ...(context.relatedSignal
        ? [{
            id: "feedback-related-signal-review",
            label: "Compare the linked product signal",
            description: `Check whether ${context.relatedSignal.name} and ${context.topic.name} changed in the same period before proposing a relationship.`,
          }]
        : [{
            id: "feedback-product-signal-review",
            label: "Find a related product signal",
            description: `Compare ${context.topic.name} with available product metrics before proposing a relationship.`,
          }]),
    ],
  };
}

export function createAnalyticsDiagnosticCase(
  context: AnalyticsInvestigationContext,
  options: { diagnosticCaseId?: string } = {},
): DiagnosticCase | null {
  let diagnosticCase: DiagnosticCase | null;

  if (context.surface === "activity") {
    diagnosticCase = getActivityDiagnosticCase(context);
  } else if (context.surface === "retention") {
    diagnosticCase = getRetentionDiagnosticCase(context);
  } else if (context.surface === "funnel") {
    diagnosticCase = getFunnelDiagnosticCase(context);
  } else {
    diagnosticCase = getFeedbackDiagnosticCase(context);
  }

  return diagnosticCase && options.diagnosticCaseId
    ? { ...diagnosticCase, id: options.diagnosticCaseId }
    : diagnosticCase;
}
