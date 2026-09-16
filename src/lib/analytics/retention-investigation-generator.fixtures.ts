import "server-only";

import { generateDatasetInvestigation } from "@/lib/ai/dataset-investigation-generator";
import { parseInvestigationResult } from "@/lib/ai/output-schema";
import { createAnalyticsDiagnosticCase } from "@/lib/analytics/analytics-diagnostic-adapter";
import { buildRetentionInvestigationContext } from "@/lib/analytics/retention-investigation-adapter";
import { getInvestigationEvidencePresentation } from "@/components/diagnostics/investigation-evidence-presentation";
import { getInvestigationValidationOptions } from "@/components/diagnostics/investigation-validation-options";
import { parseDatasetDiagnosticCase } from "@/lib/diagnostics/server/dataset-diagnostic-case-schema";
import { getValidationPlanTemplates } from "@/lib/validations/mock-data";

function assertFixture(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Retention investigation fixture failed: ${message}`);
  }
}

function getUserPrompt(requestBody: unknown): string {
  assertFixture(
    typeof requestBody === "object" && requestBody !== null,
    "provider request body must be an object.",
  );

  const messages = Reflect.get(requestBody, "messages");
  assertFixture(Array.isArray(messages), "provider request must contain messages.");

  const userMessage = messages.find(
    (message) =>
      typeof message === "object" &&
      message !== null &&
      Reflect.get(message, "role") === "user",
  );
  const content =
    typeof userMessage === "object" && userMessage !== null
      ? Reflect.get(userMessage, "content")
      : null;

  assertFixture(typeof content === "string", "provider request must contain a user prompt.");
  return content;
}

function getProviderToolNames(requestBody: unknown): string[] {
  assertFixture(
    typeof requestBody === "object" && requestBody !== null,
    "provider request body must be an object.",
  );

  const tools = Reflect.get(requestBody, "tools");
  assertFixture(Array.isArray(tools), "tool-selection request must contain tools.");

  return tools.map((tool) => {
    const toolFunction =
      typeof tool === "object" && tool !== null
        ? Reflect.get(tool, "function")
        : null;
    const name =
      typeof toolFunction === "object" && toolFunction !== null
        ? Reflect.get(toolFunction, "name")
        : null;

    assertFixture(typeof name === "string", "provider tool must have a name.");
    return name;
  });
}

function getSuccessfulToolObservations(requestBody: unknown) {
  assertFixture(
    typeof requestBody === "object" && requestBody !== null,
    "provider request body must be an object.",
  );

  const messages = Reflect.get(requestBody, "messages");
  assertFixture(Array.isArray(messages), "provider request must contain messages.");

  return messages.flatMap((message) => {
    if (
      typeof message !== "object" ||
      message === null ||
      Reflect.get(message, "role") !== "tool"
    ) {
      return [];
    }

    const content = Reflect.get(message, "content");
    assertFixture(typeof content === "string", "tool message content must be JSON.");
    const parsed = JSON.parse(content) as unknown;

    assertFixture(
      typeof parsed === "object" && parsed !== null,
      "tool message must contain an observation object.",
    );
    assertFixture(
      Reflect.get(parsed, "status") === "success",
      "fixture tool execution must succeed.",
    );

    return [parsed];
  });
}

export async function runRetentionInvestigationGeneratorFixtures() {
  const analyticsContext = {
    ...buildRetentionInvestigationContext({
      cohort: {
      date: "2026-09-16",
      users: 2_380,
      segment: "All users",
      d1Retention: 62,
      d7Retention: 41,
      d30Retention: 20,
      changeFromPrevious: -13,
      anomalyDetected: true,
      intervals: [
        { day: 0, rate: 100, users: 2_380 },
        { day: 1, rate: 62, users: 1_476 },
        { day: 3, rate: 54, users: 1_285 },
        { day: 7, rate: 41, users: 976 },
        { day: 14, rate: 31, users: 738 },
        { day: 30, rate: 20, users: 476 },
      ],
    },
    selectedInterval: "D3",
    segment: {
      dimension: "User type",
      selected: {
        name: "Free",
        users: 15_000,
        D1: 60,
        D7: 38,
        D30: 19,
      },
      baseline: {
        name: "Enterprise",
        users: 1_500,
        D1: 91,
        D7: 78,
        D30: 62,
      },
    },
    baseline: [
      { day: 0, rate: 100, users: 2_380 },
      { day: 1, rate: 70.8, users: 1_685 },
      { day: 3, rate: 63, users: 1_499 },
      { day: 7, rate: 54, users: 1_285 },
      { day: 14, rate: 43, users: 1_023 },
      { day: 30, rate: 31, users: 738 },
    ],
    retentionValues: [
      { day: 0, rate: 100, users: 2_380 },
      { day: 1, rate: 62, users: 1_476 },
      { day: 3, rate: 54, users: 1_285 },
      { day: 7, rate: 41, users: 976 },
      { day: 14, rate: 31, users: 738 },
      { day: 30, rate: 20, users: 476 },
    ],
      definition: {
        event: "signup_completed",
        returningEvent: "app_opened",
        period: "Weekly",
        window: "30 days",
        segment: "All users",
      },
    }),
    investigationTarget: {
      id: "retention-investigation-target-1",
      title: "Investigate Free onboarding completion",
      relatedSegment: "User type: Free",
      sourceSurface: "retention" as const,
    },
  };
  const diagnosticCase = parseDatasetDiagnosticCase(
    createAnalyticsDiagnosticCase(analyticsContext),
  );
  const d7TraceDiagnosticCase = parseDatasetDiagnosticCase(
    createAnalyticsDiagnosticCase({
      ...analyticsContext,
      selectedInterval: "D7",
    }),
  );
  const [primaryTraceStep, cohortContextTraceStep] =
    d7TraceDiagnosticCase.traceSteps;

  assertFixture(
    primaryTraceStep?.id === "analytics-retention-trace-segment" &&
      primaryTraceStep.label.includes("Primary signal") &&
      primaryTraceStep.description.includes("Free D7 retention") &&
      primaryTraceStep.description.includes("38.0%") &&
      primaryTraceStep.description.includes("Enterprise") &&
      primaryTraceStep.description.includes("78.0%") &&
      primaryTraceStep.evidenceIds.join(",") ===
        "analytics-retention-segment-evidence",
    "Diagnostic Trace must place the Free D7 primary signal first.",
  );
  assertFixture(
    cohortContextTraceStep?.id === "analytics-retention-trace-cohort" &&
      cohortContextTraceStep.label.includes("supporting context") &&
      cohortContextTraceStep.description.includes("D7 retention") &&
      cohortContextTraceStep.description.includes("supporting context only") &&
      cohortContextTraceStep.evidenceIds.join(",") ===
        "analytics-retention-metric-evidence,analytics-retention-cohort-evidence",
    "Diagnostic Trace must place cohort D7 evidence second as supporting context.",
  );
  const legacyDiagnosticCase = { ...diagnosticCase };

  delete legacyDiagnosticCase.primarySignal;
  assertFixture(
    parseDatasetDiagnosticCase(legacyDiagnosticCase).primarySignal === undefined,
    "legacy Dataset DiagnosticCase must remain valid without primarySignal.",
  );
  const modelOutput = {
    focus: {
      title: "Validate the Free D7 retention gap",
      description:
        "Investigate why Free D7 retention is 38% versus the 78% segment baseline without asserting a cause.",
    },
    summary: {
      text: "Free D7 retention is 38%, 40 percentage points below the segment baseline.",
      evidenceReferenceIds: ["fixture-segment-reference"],
    },
    evidenceUsed: [
      {
        id: "fixture-segment-reference",
        sourceType: "behavior-signal",
        sourceId: "analytics-retention-segment-evidence",
        relevance: "Defines the primary Free D7 retention gap and comparison segment.",
      },
      {
        id: "fixture-cohort-reference",
        sourceType: "behavior-signal",
        sourceId: "analytics-retention-cohort-evidence",
        relevance: "Provides the selected cohort as supporting context only.",
      },
      {
        id: "fixture-tool-retention-reference",
        sourceType: "behavior-signal",
        sourceId: "analytics-retention-metric-evidence",
        relevance: "Provides the retention analysis tool comparison.",
      },
      {
        id: "fixture-metric-reference",
        sourceType: "metric",
        sourceId: "retention-d3",
        relevance: "Provides the selected cohort D3 comparison as secondary context.",
      },
    ],
    possibleExplanations: [
      {
        id: "fixture-explanation",
        statement:
          "Differences in onboarding or engagement may be associated with the observed retention gap.",
        qualification: "possible-not-confirmed",
        evidenceRelationship: "context-only",
        confidence: "low",
        confidenceRationale:
          "Retention differences are observed, but no behavior-level cause has been measured.",
        evidenceReferenceIds: ["fixture-segment-reference"],
        uncertainty:
          "No onboarding funnel, feature adoption, or engagement comparison has been completed.",
      },
    ],
    workingHypothesis: {
      statement:
        "Behavior-level validation may identify where the Free D7 retention gap is concentrated.",
      evidenceReferenceIds: ["fixture-segment-reference"],
    },
    recommendedValidations: [
      {
        validationId: "analytics-compare-onboarding-funnel",
        priority: "primary",
        rationale: "Check whether onboarding progression helps validate the primary Free D7 gap.",
      },
      {
        validationId: "analytics-review-feature-adoption",
        priority: "supporting",
        rationale: "Compare feature adoption as supporting context for the primary Free D7 gap.",
      },
      {
        validationId: "analytics-analyze-user-engagement",
        priority: "supporting",
        rationale: "Measure engagement as supporting context for the primary Free D7 gap.",
      },
    ],
    limitations: [
      "No causal driver has been validated.",
      "No qualitative feedback evidence is included.",
    ],
  };
  const originalFetch = globalThis.fetch;
  const previousApiKey = process.env.DEEPSEEK_API_KEY;
  const capturedRequestBodies: unknown[] = [];
  const fixtureFetch: typeof fetch = async (_input, init) => {
    capturedRequestBodies.push(JSON.parse(String(init?.body)) as unknown);

    if (capturedRequestBodies.length === 1) {
      return new Response(
        JSON.stringify({
          choices: [
            {
              finish_reason: "tool_calls",
              message: {
                content: null,
                tool_calls: [
                  {
                    id: "fixture-segment-analysis",
                    type: "function",
                    function: {
                      name: "segment_analysis",
                      arguments: JSON.stringify({
                        dimension:
                          diagnosticCase.primarySignal?.segmentDimension,
                        value: diagnosticCase.primarySignal?.segment,
                      }),
                    },
                  },
                  {
                    id: "fixture-retention-analysis",
                    type: "function",
                    function: {
                      name: "retention_analysis",
                      arguments: JSON.stringify({
                        metric: diagnosticCase.primarySignal?.metric,
                        segment: diagnosticCase.primarySignal?.segment,
                        period: diagnosticCase.primarySignal?.interval,
                      }),
                    },
                  },
                  {
                    id: "fixture-feedback-analysis",
                    type: "function",
                    function: {
                      name: "feedback_analysis",
                      arguments: JSON.stringify({
                        topic: "Onboarding clarity",
                      }),
                    },
                  },
                ],
              },
            },
          ],
          usage: { completion_tokens: 120 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    if (capturedRequestBodies.length === 2) {
      return new Response(
        JSON.stringify({
          choices: [
            {
              finish_reason: "stop",
              message: {
                content: JSON.stringify({
                  sufficient: true,
                  reasoning:
                    "Metric, segment, and supporting feedback evidence are available.",
                  missingEvidence: [],
                }),
              },
            },
          ],
          usage: { completion_tokens: 80 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        choices: [
          {
            finish_reason: "stop",
            message: { content: JSON.stringify(modelOutput) },
          },
        ],
        usage: { completion_tokens: 600 },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };

  process.env.DEEPSEEK_API_KEY = "fixture-only-key";
  globalThis.fetch = fixtureFetch;

  try {
    const generation = await generateDatasetInvestigation(diagnosticCase);
    const result = parseInvestigationResult(generation.result, diagnosticCase);
    const firstRequest = capturedRequestBodies[0];
    const enrichedRequest = capturedRequestBodies[2];
    const userPrompt = getUserPrompt(firstRequest);
    const providerToolNames = getProviderToolNames(firstRequest).sort();
    const toolObservations = getSuccessfulToolObservations(enrichedRequest);
    const metricSignal = diagnosticCase.evidence.behaviorSignals.find(
      (signal) => signal.id === "analytics-retention-metric-evidence",
    );
    const segmentSignal = diagnosticCase.evidence.behaviorSignals.find(
      (signal) => signal.id === "analytics-retention-segment-evidence",
    );
    const primaryEvidenceReference = result.evidenceUsed.find(
      (evidence) =>
        evidence.sourceId === "analytics-retention-segment-evidence",
    );
    const cohortEvidenceReference = result.evidenceUsed.find(
      (evidence) =>
        evidence.sourceId === "analytics-retention-cohort-evidence",
    );
    const validationOptions = getInvestigationValidationOptions(
      diagnosticCase,
      result,
    );
    const validationPlanTemplates = getValidationPlanTemplates(
      diagnosticCase.id,
    );

    assertFixture(
      primaryEvidenceReference !== undefined &&
        cohortEvidenceReference !== undefined,
      "fixture result must preserve the primary and cohort evidence references.",
    );

    const primaryEvidencePresentation =
      getInvestigationEvidencePresentation(
        primaryEvidenceReference,
        diagnosticCase,
      );
    const cohortEvidencePresentation =
      getInvestigationEvidencePresentation(
        cohortEvidenceReference,
        diagnosticCase,
      );

    assertFixture(generation.fallback === null, "valid output must not use fallback.");
    assertFixture(result.source === "deepseek", "result must come from the AI generation path.");
    assertFixture(
      diagnosticCase.primarySignal?.metric === "retention" &&
        diagnosticCase.primarySignal.interval === "D7" &&
        diagnosticCase.primarySignal.segmentDimension === "User type" &&
        diagnosticCase.primarySignal.segment === "Free" &&
        diagnosticCase.primarySignal.currentValue === 38 &&
        diagnosticCase.primarySignal.baselineValue === 78 &&
        diagnosticCase.primarySignal.gap === -40 &&
        diagnosticCase.primarySignal.affectedUsers === 15_000,
      "Retention DiagnosticCase must preserve the dynamic primary segment signal.",
    );
    assertFixture(
      diagnosticCase.metric.id === "retention-d3",
      "selected cohort D3 metric must remain available as secondary evidence.",
    );
    assertFixture(
      diagnosticCase.investigationTarget?.id ===
        analyticsContext.investigationTarget.id &&
        diagnosticCase.investigationTarget.title ===
          analyticsContext.investigationTarget.title &&
        diagnosticCase.investigationTarget.relatedSegment ===
          analyticsContext.investigationTarget.relatedSegment,
      "DiagnosticCase must preserve the selected investigation target.",
    );
    assertFixture(
      userPrompt.includes(analyticsContext.investigationTarget.id) &&
        userPrompt.includes(analyticsContext.investigationTarget.title) &&
        userPrompt.includes(analyticsContext.investigationTarget.relatedSegment),
      "agent reasoning input must include the selected investigation target.",
    );
    assertFixture(
      userPrompt.includes("Primary signal is the investigation anchor.") &&
        userPrompt.includes('"segment": "Free"') &&
        userPrompt.includes('"interval": "D7"'),
      "agent reasoning input must explicitly anchor the primary signal.",
    );
    assertFixture(
      metricSignal !== undefined &&
        userPrompt.includes(metricSignal.id) &&
        userPrompt.includes(metricSignal.finding) &&
        userPrompt.includes(diagnosticCase.metric.previousValue ?? ""),
      "AI input must contain retention evidence and its baseline comparison.",
    );
    assertFixture(
      segmentSignal !== undefined &&
        userPrompt.includes(segmentSignal.id) &&
        userPrompt.includes(segmentSignal.finding) &&
        userPrompt.includes(segmentSignal.detail) &&
        userPrompt.includes(diagnosticCase.context.segment.label),
      "AI input must contain the selected segment context.",
    );
    assertFixture(
      capturedRequestBodies.length === 3,
      "agent must select tools, evaluate evidence, and request a final draft.",
    );
    assertFixture(
      providerToolNames.join(",") ===
        "feedback_analysis,retention_analysis,segment_analysis",
      "onboarding target must select the segment analysis tool.",
    );
    assertFixture(
      !providerToolNames.includes("search_feedback"),
      "Retention investigation must not expose search_feedback.",
    );
    assertFixture(
      toolObservations.length === 3,
      "all selected tool observations must be supplied to final generation.",
    );
    assertFixture(
      generation.trace.events.filter((event) => event.type === "tool-call").length ===
        3 &&
        generation.trace.events.filter((event) => event.type === "observation").length ===
          3,
      "agent trace must record the target-selected tool call and observation.",
    );
    assertFixture(
      toolObservations.every((toolResult) => {
        const observation = Reflect.get(toolResult, "observation");
        const sourceReferences =
          typeof observation === "object" && observation !== null
            ? Reflect.get(observation, "sourceReferences")
            : null;

        return (
          Array.isArray(sourceReferences) &&
          sourceReferences.some(
            (sourceReference) =>
              typeof sourceReference === "object" &&
              sourceReference !== null &&
              result.evidenceUsed.some(
                (evidence) =>
                  evidence.sourceType === Reflect.get(sourceReference, "sourceType") &&
                  evidence.sourceId === Reflect.get(sourceReference, "sourceId"),
              ),
          )
        );
      }),
      "every successful tool observation must be represented in evidenceUsed.",
    );
    assertFixture(
      result.focus.title.includes("Free") &&
        result.focus.title.includes("D7") &&
        !result.focus.title.includes("D3") &&
        result.summary.text.includes("Free") &&
        result.summary.text.includes("D7") &&
        !result.summary.text.includes("D3") &&
        result.workingHypothesis.statement.includes("Free") &&
        result.workingHypothesis.statement.includes("D7"),
      "focus, summary, and hypothesis must remain anchored to the Free D7 gap.",
    );
    assertFixture(
      result.recommendedValidations.every(
        (validation) =>
          validation.rationale.includes("Free") &&
          validation.rationale.includes("D7"),
      ),
      "recommended validations must address the primary signal first.",
    );
    assertFixture(
      validationOptions[0]?.id === "analytics-compare-onboarding-funnel" &&
        validationOptions[0].priority === "primary" &&
        validationOptions[0].label === "Compare onboarding funnel" &&
        validationOptions[0].description ===
          "Compare onboarding completion and drop-off for the selected cohort and segment against the baseline.",
      "Human Review must use the primary draft validation as its default recommended analysis.",
    );
    assertFixture(
      validationOptions.map((validation) => validation.id).join(",") ===
        "analytics-compare-onboarding-funnel,analytics-review-feature-adoption,analytics-analyze-user-engagement" &&
        validationOptions.every((validation) =>
          validationPlanTemplates.some(
            (template) => template.nextValidationId === validation.id,
          ),
        ),
      "all Retention draft validation steps must remain selectable and plan-compatible.",
    );
    assertFixture(
      result.evidenceUsed.some(
        (evidence) =>
          evidence.sourceId === "analytics-retention-cohort-evidence" &&
          evidence.relevance.includes("supporting context"),
      ),
      "cohort evidence must remain available as supporting context.",
    );
    assertFixture(
      primaryEvidencePresentation.badgeLabel === "PRIMARY SIGNAL",
      "Free D7 evidence must render with the PRIMARY SIGNAL badge.",
    );
    assertFixture(
      cohortEvidencePresentation.badgeLabel === "SUPPORTING CONTEXT" &&
        cohortEvidencePresentation.whyUsed ===
          "Provides cohort-level supporting context for the primary Free D7 retention signal.",
      "cohort evidence must render as supporting context with primary-signal-aware copy.",
    );
    assertFixture(
      segmentSignal?.finding ===
        "Free User type evidence shows 38.0% D7 retention, compared with 78.0% for Enterprise (-40.0 pp)." &&
        primaryEvidenceReference.id === "fixture-segment-reference" &&
        primaryEvidenceReference.sourceId ===
          "analytics-retention-segment-evidence" &&
        cohortEvidenceReference.id === "fixture-cohort-reference" &&
        cohortEvidenceReference.sourceId ===
          "analytics-retention-cohort-evidence",
      "Evidence Basis presentation must not alter evidence content or references.",
    );
    assertFixture(
      result.workingHypothesis.status === "unvalidated" &&
        result.possibleExplanations.every(
          (explanation) =>
            explanation.qualification !== undefined &&
            explanation.evidenceRelationship === "context-only",
        ),
      "the generated result must not present an unverified causal conclusion.",
    );

    globalThis.fetch = async () => {
      throw new TypeError("Fixture provider failure");
    };

    const fallbackGeneration = await generateDatasetInvestigation(diagnosticCase);
    const fallbackResult = parseInvestigationResult(
      fallbackGeneration.result,
      diagnosticCase,
    );
    const displayedFallbackEvidence = fallbackResult.evidenceUsed.filter(
      (evidence) =>
        fallbackResult.workingHypothesis.evidenceReferenceIds.includes(
          evidence.id,
        ),
    );
    const fallbackRelevances = displayedFallbackEvidence.map(
      (evidence) => evidence.relevance,
    );
    const fallbackMetricEvidence = displayedFallbackEvidence.find(
      (evidence) => evidence.sourceType === "metric",
    );
    const fallbackCohortEvidence = displayedFallbackEvidence.find(
      (evidence) =>
        evidence.sourceId === "analytics-retention-cohort-evidence",
    );
    const fallbackSegmentEvidence = displayedFallbackEvidence.find(
      (evidence) =>
        evidence.sourceId === "analytics-retention-segment-evidence",
    );

    assertFixture(
      fallbackGeneration.fallback !== null &&
        fallbackResult.source === "mock",
      "provider failure must use the deterministic Investigation fallback.",
    );
    assertFixture(
      fallbackRelevances.length > 0 &&
        new Set(fallbackRelevances).size === fallbackRelevances.length,
      "Validation Result fallback evidence must not display duplicate relevance descriptions.",
    );
    assertFixture(
      fallbackMetricEvidence?.relevance.includes("metric change") === true &&
        fallbackCohortEvidence?.relevance.includes("cohort timing") === true &&
        fallbackCohortEvidence.relevance.includes("baseline-comparison") &&
        fallbackSegmentEvidence?.relevance.includes(
          "user-segment behavior difference",
        ) === true,
      "fallback evidence relevance must distinguish metric, cohort, and segment roles.",
    );

    return {
      analyticsSurface: analyticsContext.surface,
      investigationTarget: diagnosticCase.investigationTarget,
      primarySignal: diagnosticCase.primarySignal,
      secondaryCohortMetric: diagnosticCase.metric.id,
      diagnosticCaseId: diagnosticCase.id,
      resultId: result.id,
      resultSource: result.source,
      verifiedAiInput: {
        retentionEvidence: true,
        baselineComparison: true,
        segmentContext: true,
      },
      toolCalling: true,
      allowedTools: providerToolNames,
      selectedTool: "segment_analysis",
      successfulToolObservations: toolObservations.length,
      evidenceEnriched: true,
      primarySignalAnchored: true,
      diagnosticTraceOrder: [
        primaryTraceStep.id,
        cohortContextTraceStep.id,
      ],
      cohortD7TraceRole: "supporting-context",
      legacyDiagnosticCaseCompatible: true,
      cohortEvidenceRole: "supporting-context",
      evidenceBasisPresentation: {
        primaryBadge: primaryEvidencePresentation.badgeLabel,
        cohortBadge: cohortEvidencePresentation.badgeLabel,
        cohortWhyUsed: cohortEvidencePresentation.whyUsed,
      },
      evidenceReferencesUnchanged: true,
      recommendedAnalysis: validationOptions[0],
      optionalAnalysisDirections: validationOptions.slice(1),
      validationStepsConnected: true,
      fallbackEvidenceRelevances: fallbackRelevances,
      fallbackEvidenceDescriptionsUnique: true,
      causalConclusion: false,
    };
  } finally {
    globalThis.fetch = originalFetch;
    if (previousApiKey === undefined) {
      delete process.env.DEEPSEEK_API_KEY;
    } else {
      process.env.DEEPSEEK_API_KEY = previousApiKey;
    }
  }
}
