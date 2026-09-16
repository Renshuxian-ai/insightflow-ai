import "server-only";

import { getInvestigationValidationOptions } from "@/components/diagnostics/investigation-validation-options";
import { generateDatasetInvestigation } from "@/lib/ai/dataset-investigation-generator";
import { parseInvestigationResult } from "@/lib/ai/output-schema";
import { parseDatasetDiagnosticCase } from "@/lib/diagnostics/server/dataset-diagnostic-case-schema";
import { feedbackTopics } from "@/lib/feedback/mock-feedback-data";
import {
  buildValidationPlan,
  getValidationPlanTemplate,
} from "@/lib/validations/mock-data";
import type { ActionablePMReview } from "@/lib/validations/types";

import { createAnalyticsDiagnosticCase } from "./analytics-diagnostic-adapter";
import { parseAnalyticsInvestigationContext } from "./analytics-context-parser";
import { buildFeedbackInvestigationContext } from "./feedback-investigation-adapter";

function assertFixture(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Feedback investigation fixture failed: ${message}`);
  }
}

export async function runFeedbackInvestigationGeneratorFixtures() {
  const topic = feedbackTopics[0];

  assertFixture(topic, "the Search relevance mock topic must exist.");

  const rawContext = buildFeedbackInvestigationContext(topic);
  const analyticsContext = parseAnalyticsInvestigationContext(
    JSON.stringify(rawContext),
  );

  assertFixture(
    analyticsContext?.surface === "feedback" &&
      analyticsContext.topic.name === "Search relevance" &&
      analyticsContext.topic.mentions === 38 &&
      analyticsContext.topic.change === 37 &&
      analyticsContext.evidenceQuotes.length === 3,
    "the parser must preserve the Feedback topic, volume, trend, and quotes.",
  );
  assertFixture(
    parseAnalyticsInvestigationContext(
      JSON.stringify({
        ...rawContext,
        topic: { ...rawContext.topic, name: "" },
      }),
    ) === null,
    "the parser must reject a missing topic name.",
  );
  assertFixture(
    parseAnalyticsInvestigationContext(
      JSON.stringify({
        ...rawContext,
        topic: { ...rawContext.topic, mentions: -1 },
      }),
    ) === null,
    "the parser must reject an invalid mention count.",
  );
  assertFixture(
    parseAnalyticsInvestigationContext(
      JSON.stringify({ ...rawContext, evidenceQuotes: [] }),
    ) === null,
    "the parser must reject an empty evidence quote array.",
  );

  const diagnosticCase = parseDatasetDiagnosticCase(
    createAnalyticsDiagnosticCase(analyticsContext),
  );

  assertFixture(
    diagnosticCase.primarySignal?.metric === "feedback_topic" &&
      diagnosticCase.primarySignal.segmentDimension === "feedback topic" &&
      diagnosticCase.primarySignal.segment === "Search relevance" &&
      diagnosticCase.primarySignal.currentValue === 38 &&
      diagnosticCase.primarySignal.affectedUsers === 38 &&
      Math.abs(
        diagnosticCase.primarySignal.currentValue -
          diagnosticCase.primarySignal.baselineValue -
          diagnosticCase.primarySignal.gap,
      ) < 0.001,
    "the DiagnosticCase must preserve a schema-compatible Feedback primary signal.",
  );
  assertFixture(
    diagnosticCase.metric.changeValue === 37 &&
      diagnosticCase.evidence.feedbackSignals[0]?.snippets.join("|") ===
        rawContext.evidenceQuotes.join("|"),
    "the DiagnosticCase must preserve relative topic growth and original user quotes.",
  );

  const modelOutput = {
    focus: {
      title: "Validate the Search relevance feedback increase",
      description:
        "Investigate the Search relevance feedback increase in the current period without asserting a cause.",
    },
    summary: {
      text: "Search relevance received 38 mentions and increased 37% versus the previous period.",
      evidenceReferenceIds: [
        "fixture-topic-volume-reference",
        "fixture-quote-reference",
      ],
    },
    evidenceUsed: [
      {
        id: "fixture-topic-volume-reference",
        sourceType: "behavior-signal",
        sourceId: "analytics-feedback-topic-volume-evidence",
        relevance: "Defines the measured Search relevance topic volume and growth.",
      },
      {
        id: "fixture-sentiment-reference",
        sourceType: "behavior-signal",
        sourceId: "analytics-feedback-sentiment-evidence",
        relevance: "Provides the aggregate negative sentiment classification.",
      },
      {
        id: "fixture-quote-reference",
        sourceType: "feedback-signal",
        sourceId: "analytics-feedback-user-quotes-evidence",
        relevance: "Preserves representative user language supporting the topic pattern.",
      },
      {
        id: "fixture-related-signal-reference",
        sourceType: "behavior-signal",
        sourceId: "analytics-feedback-related-signal-evidence",
        relevance: "Provides the linked conversion signal as supporting context only.",
      },
    ],
    possibleExplanations: [
      {
        id: "fixture-feedback-explanation",
        statement:
          "An unmeasured product experience may be associated with the increase in Search relevance feedback.",
        qualification: "possible-not-confirmed",
        evidenceRelationship: "context-only",
        confidence: "low",
        confidenceRationale:
          "The feedback evidence shows a growing topic but does not identify a causal driver.",
        evidenceReferenceIds: [
          "fixture-topic-volume-reference",
          "fixture-quote-reference",
        ],
        uncertainty:
          "Topic distribution and linked-signal timing have not yet been validated.",
      },
    ],
    workingHypothesis: {
      statement:
        "Segment and timing validation may identify where the Search relevance current period increase is concentrated.",
      evidenceReferenceIds: [
        "fixture-topic-volume-reference",
        "fixture-quote-reference",
      ],
    },
    recommendedValidations: diagnosticCase.nextValidations.map(
      (validation, index) => ({
        validationId: validation.id,
        priority: index === 0 ? ("primary" as const) : ("supporting" as const),
        rationale: `Validate the Search relevance current period signal with ${validation.label.toLocaleLowerCase("en-US")}.`,
      }),
    ),
    limitations: [
      "The topic is AI-grouped and has not been independently validated.",
      "The linked product signal does not establish causation.",
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
                    id: "fixture-feedback-analysis",
                    type: "function",
                    function: {
                      name: "feedback_analysis",
                      arguments: JSON.stringify({
                        topic: diagnosticCase.primarySignal?.segment,
                        sentiment: "negative",
                      }),
                    },
                  },
                  {
                    id: "fixture-feedback-retention-analysis",
                    type: "function",
                    function: {
                      name: "retention_analysis",
                      arguments: JSON.stringify({
                        metric: "D1 retention",
                        segment: diagnosticCase.context.segment.label,
                        period: "D1",
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
                    "The topic, quotes, and linked metric evidence are available.",
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
    const validationOptions = getInvestigationValidationOptions(
      diagnosticCase,
      result,
    );

    assertFixture(
      generation.fallback === null && result.source === "deepseek",
      "a valid Feedback DiagnosticCase must generate a validated InvestigationResult.",
    );
    assertFixture(
      validationOptions.length === 2 &&
        validationOptions[0]?.id === "feedback-segment-review" &&
        validationOptions[1]?.id === "feedback-related-signal-review",
      "the InvestigationResult must expose both Feedback validation options.",
    );

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
      primaryValidation && validationTemplate,
      "the primary Feedback validation option must have a matching template.",
    );

    const review: ActionablePMReview = {
      id: "fixture-feedback-review",
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
      validationPlan?.templateId === "feedback-segment-review" &&
        validationPlan.method.type === "feedback-review",
      "the primary Feedback option must connect to the existing Validation workflow.",
    );

    return {
      analyticsSurface: analyticsContext.surface,
      signalId: analyticsContext.signalId,
      primarySignal: diagnosticCase.primarySignal,
      feedbackEvidenceIds: diagnosticCase.evidence.feedbackSignals.map(
        (signal) => signal.id,
      ),
      investigationResultId: result.id,
      investigationSource: result.source,
      validationOptionIds: validationOptions.map((option) => option.id),
      validationPlanId: validationPlan.id,
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
