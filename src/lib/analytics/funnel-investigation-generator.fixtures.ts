import "server-only";

import { generateDatasetInvestigation } from "@/lib/ai/dataset-investigation-generator";
import { parseInvestigationResult } from "@/lib/ai/output-schema";
import { createAnalyticsDiagnosticCase } from "@/lib/analytics/analytics-diagnostic-adapter";
import { parseAnalyticsInvestigationContext } from "@/lib/analytics/analytics-context-parser";
import { parseDatasetDiagnosticCase } from "@/lib/diagnostics/server/dataset-diagnostic-case-schema";
import {
  buildValidationPlan,
  getValidationPlanTemplate,
  getValidationPlanTemplates,
} from "@/lib/validations/mock-data";
import type { ActionablePMReview } from "@/lib/validations/types";

function assertFixture(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Funnel investigation fixture failed: ${message}`);
  }
}

export async function runFunnelInvestigationGeneratorFixtures() {
  const rawContext = {
    surface: "funnel",
    signalId: "funnel:v3-2:complete-step2:complete-step3",
    funnelStepTransition: {
      from: {
        eventName: "complete_step2",
        label: "Complete Step2",
      },
      to: {
        eventName: "complete_step3",
        label: "Complete Step3",
      },
    },
    currentVersion: "V3.2",
    previousVersion: "V3.1",
    currentCompletionRate: 32.5,
    baselineCompletionRate: 100,
    gap: -67.5,
    dropOffUsers: 27,
  };
  const analyticsContext = parseAnalyticsInvestigationContext(
    JSON.stringify(rawContext),
  );

  assertFixture(
    analyticsContext?.surface === "funnel",
    "the parser must accept a valid Funnel analyticsContext.",
  );
  assertFixture(
    parseAnalyticsInvestigationContext(
      JSON.stringify({ ...rawContext, gap: -60 }),
    ) === null,
    "the parser must reject a Funnel context with an inconsistent gap.",
  );

  const diagnosticCase = parseDatasetDiagnosticCase(
    createAnalyticsDiagnosticCase(analyticsContext),
  );

  assertFixture(
    diagnosticCase.primarySignal?.metric === "funnel_conversion" &&
      diagnosticCase.primarySignal.segment === "Complete Step3" &&
      diagnosticCase.primarySignal.interval ===
        "Complete Step2 → Complete Step3" &&
      diagnosticCase.primarySignal.currentValue === 32.5 &&
      diagnosticCase.primarySignal.baselineValue === 100 &&
      diagnosticCase.primarySignal.gap === -67.5 &&
      diagnosticCase.primarySignal.affectedUsers === 27,
    "the DiagnosticCase must preserve the primary funnel transition signal.",
  );
  assertFixture(
    diagnosticCase.evidence.behaviorSignals.map((signal) => signal.id).join(",") ===
      [
        "analytics-funnel-primary-dropoff-evidence",
        "analytics-funnel-version-context-evidence",
        "analytics-funnel-transition-comparison-evidence",
      ].join(","),
    "the DiagnosticCase must contain primary, version, and comparison evidence.",
  );

  const interval = diagnosticCase.primarySignal.interval;
  const segment = diagnosticCase.primarySignal.segment;
  const anchor = `${segment} at ${interval}`;
  const modelOutput = {
    focus: {
      title: `Validate ${anchor}`,
      description: `Investigate the measured funnel drop-off for ${anchor} without asserting a cause.`,
    },
    summary: {
      text: `${anchor} fell from 100% baseline completion to 32.5%, with 27 users lost.`,
      evidenceReferenceIds: ["fixture-primary-reference"],
    },
    evidenceUsed: [
      {
        id: "fixture-primary-reference",
        sourceType: "behavior-signal",
        sourceId: "analytics-funnel-primary-dropoff-evidence",
        relevance: "Defines the primary measured funnel transition drop-off.",
      },
      {
        id: "fixture-comparison-reference",
        sourceType: "behavior-signal",
        sourceId: "analytics-funnel-transition-comparison-evidence",
        relevance: "Provides the current and baseline transition comparison.",
      },
    ],
    possibleExplanations: [
      {
        id: "fixture-funnel-explanation",
        statement:
          "An unmeasured step-level behavior may be associated with the observed drop-off.",
        qualification: "possible-not-confirmed",
        evidenceRelationship: "context-only",
        confidence: "low",
        confidenceRationale:
          "The funnel evidence measures the transition difference but not its cause.",
        evidenceReferenceIds: ["fixture-primary-reference"],
        uncertainty:
          "No segment, event-quality, or product-experience validation has been completed.",
      },
    ],
    workingHypothesis: {
      statement: `Step-level validation may identify where ${anchor} is concentrated.`,
      evidenceReferenceIds: ["fixture-primary-reference"],
    },
    recommendedValidations: diagnosticCase.nextValidations.map(
      (validation, index) => ({
        validationId: validation.id,
        priority: index === 0 ? ("primary" as const) : ("supporting" as const),
        rationale: `Use this analysis to validate ${anchor} before proposing a cause.`,
      }),
    ),
    limitations: [
      "The available funnel evidence does not establish a cause.",
      "No qualitative feedback evidence is included.",
    ],
  };
  const originalFetch = globalThis.fetch;
  const previousApiKey = process.env.DEEPSEEK_API_KEY;
  let providerRequestCount = 0;

  process.env.DEEPSEEK_API_KEY = "fixture-only-key";
  globalThis.fetch = async () => {
    providerRequestCount += 1;

    if (providerRequestCount === 1) {
      return new Response(
        JSON.stringify({
          choices: [
            {
              finish_reason: "tool_calls",
              message: {
                content: null,
                tool_calls: [
                  {
                    id: "fixture-funnel-analysis",
                    type: "function",
                    function: {
                      name: "funnel_analysis",
                      arguments: JSON.stringify({ step: interval }),
                    },
                  },
                  {
                    id: "fixture-funnel-segment-analysis",
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
                ],
              },
            },
          ],
          usage: { completion_tokens: 120 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    if (providerRequestCount === 2) {
      return new Response(
        JSON.stringify({
          choices: [
            {
              finish_reason: "stop",
              message: {
                content: JSON.stringify({
                  sufficient: true,
                  reasoning:
                    "Transition, drop-off, and segment evidence are available.",
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
        usage: { completion_tokens: 500 },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };

  try {
    const generation = await generateDatasetInvestigation(diagnosticCase);
    const result = parseInvestigationResult(generation.result, diagnosticCase);

    assertFixture(
      generation.fallback === null && result.source === "deepseek",
      "a valid Funnel DiagnosticCase must generate a validated InvestigationResult.",
    );
    const validationTemplates = getValidationPlanTemplates(diagnosticCase.id);
    const primaryValidation = result.recommendedValidations.find(
      (validation) => validation.priority === "primary",
    );
    const validationTemplate = primaryValidation
      ? getValidationPlanTemplate(
          diagnosticCase.id,
          primaryValidation.validationId,
        )
      : undefined;

    assertFixture(
      primaryValidation?.validationId === "funnel-dropoff-analysis" &&
        validationTemplate?.id === "funnel-dropoff-analysis" &&
        diagnosticCase.nextValidations.every((validation) =>
          validationTemplates.some(
            (template) => template.nextValidationId === validation.id,
          ),
        ),
      "every Funnel nextValidation must have a matching validation template.",
    );

    const review: ActionablePMReview = {
      id: "fixture-funnel-review",
      diagnosticCaseId: diagnosticCase.id,
      investigationResultId: result.id,
      sourceHypothesisId: result.workingHypothesis.id,
      decision: "use-as-working-hypothesis",
      refinedHypothesis: null,
      note: null,
      selectedValidationId: primaryValidation.validationId,
      rejectionReason: null,
      persistence: "session-only",
    };
    const validationPlan = buildValidationPlan(
      review,
      validationTemplate,
      diagnosticCase,
      result,
    );

    assertFixture(
      validationPlan?.templateId === "funnel-dropoff-analysis" &&
        validationPlan.sourceValidationId === "funnel-dropoff-analysis" &&
        validationPlan.method.type === "funnel-review" &&
        validationPlan.status === "draft" &&
        validationPlan.executionStatus === "not-run",
      "the primary Funnel recommendation must generate a draft ValidationPlan.",
    );

    globalThis.fetch = async () => {
      throw new TypeError("Fixture provider failure");
    };

    const fallbackGeneration = await generateDatasetInvestigation(diagnosticCase);
    const fallbackResult = parseInvestigationResult(
      fallbackGeneration.result,
      diagnosticCase,
    );
    const fallbackText = JSON.stringify(fallbackResult).toLocaleLowerCase("en-US");

    assertFixture(
      fallbackGeneration.fallback !== null &&
        !fallbackText.includes("retention gap") &&
        !fallbackText.includes("cohort") &&
        !fallbackText.includes("d7"),
      "the Funnel deterministic fallback must not use Retention-specific wording.",
    );

    return {
      analyticsSurface: analyticsContext.surface,
      primarySignal: diagnosticCase.primarySignal,
      evidenceIds: diagnosticCase.evidence.behaviorSignals.map(
        (signal) => signal.id,
      ),
      investigationResultId: result.id,
      investigationSource: result.source,
      validationTemplateIds: diagnosticCase.nextValidations.map(
        (validation) => validation.id,
      ),
      validationPlanId: validationPlan.id,
      validationPlanStatus: validationPlan.status,
      deterministicFallbackSurfaceSafe: true,
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
