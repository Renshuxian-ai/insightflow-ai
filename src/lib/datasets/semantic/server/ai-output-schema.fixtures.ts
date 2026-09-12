import { SEMANTIC_TYPE_IDS } from "../semantic-type-registry";
import type { SemanticInferenceContext } from "../types";
import {
  SemanticAiOutputValidationError,
  stampSemanticAiSuggestions,
  validateSemanticAiSuggestionOutput,
} from "./ai-output-schema";

type SemanticAiOutputValidationFixture = {
  name: string;
  output: unknown;
  expectedPath: string | null;
  expectedSuggestionCount: number;
};

const fixtureContext: SemanticInferenceContext = {
  physicalSchema: {
    datasetId: "semantic-ai-fixture",
    physicalSchemaVersion: 1,
    schemaFingerprint: "semantic-ai-fixture-schema",
    selectedSheetName: null,
  },
  profileScope: {
    totalRows: 10,
    profiledRows: 10,
    isComplete: true,
  },
  physicalWarnings: [],
  fields: [
    {
      stableFieldKey: "event_name__1",
      fieldName: "event name",
      detectedPhysicalType: "string",
      physicalTypeConfidence: 1,
      nullRate: 0,
      distinctCount: 4,
      isDistinctCountExact: true,
      distinctRate: 0.4,
      safeStatistics: { kind: "none", valuesRedacted: false },
      sanitizedSamples: [],
      sampleSummary: {
        observedSampleCount: 0,
        includedSampleCount: 0,
        redactedSampleCount: 0,
        minimumTextLength: null,
        maximumTextLength: null,
        policy: "no-samples",
      },
      neighboringFieldNames: [],
      heuristicCandidates: [],
      physicalWarnings: [],
    },
    {
      stableFieldKey: "occurred_at__2",
      fieldName: "occurred at",
      detectedPhysicalType: "datetime",
      physicalTypeConfidence: 1,
      nullRate: 0,
      distinctCount: 10,
      isDistinctCountExact: true,
      distinctRate: 1,
      safeStatistics: { kind: "none", valuesRedacted: false },
      sanitizedSamples: [],
      sampleSummary: {
        observedSampleCount: 0,
        includedSampleCount: 0,
        redactedSampleCount: 0,
        minimumTextLength: null,
        maximumTextLength: null,
        policy: "no-samples",
      },
      neighboringFieldNames: [],
      heuristicCandidates: [],
      physicalWarnings: [],
    },
  ],
};

function createValidOutput() {
  return [
    {
      stableFieldKey: "event_name__1",
      semanticRole: "dimension",
      semanticType: SEMANTIC_TYPE_IDS.eventName,
      businessMeaning: "Tracked product event name",
      semanticConfidence: 0.92,
      explanation: "The field name and string profile indicate an event label.",
      alternatives: [],
      ambiguity: null,
    },
  ];
}

export const semanticAiOutputValidationFixtures: readonly SemanticAiOutputValidationFixture[] = [
  {
    name: "accepts a valid semantic AI output",
    output: createValidOutput(),
    expectedPath: null,
    expectedSuggestionCount: 1,
  },
  {
    name: "rejects an unknown stableFieldKey",
    output: [{ ...createValidOutput()[0], stableFieldKey: "unknown__3" }],
    expectedPath: "semanticAiSuggestions[0].stableFieldKey",
    expectedSuggestionCount: 0,
  },
  {
    name: "rejects duplicate stableFieldKey values",
    output: [...createValidOutput(), { ...createValidOutput()[0] }],
    expectedPath: "semanticAiSuggestions",
    expectedSuggestionCount: 0,
  },
  {
    name: "rejects an invalid semantic role",
    output: [{ ...createValidOutput()[0], semanticRole: "primary-key" }],
    expectedPath: "semanticAiSuggestions[0].semanticRole",
    expectedSuggestionCount: 0,
  },
  {
    name: "rejects an invalid semantic type",
    output: [{ ...createValidOutput()[0], semanticType: "customer-name" }],
    expectedPath: "semanticAiSuggestions[0].semanticType",
    expectedSuggestionCount: 0,
  },
  {
    name: "rejects confidence above one",
    output: [{ ...createValidOutput()[0], semanticConfidence: 1.01 }],
    expectedPath: "semanticAiSuggestions[0].semanticConfidence",
    expectedSuggestionCount: 0,
  },
  {
    name: "rejects an overlong business meaning",
    output: [{ ...createValidOutput()[0], businessMeaning: "x".repeat(161) }],
    expectedPath: "semanticAiSuggestions[0].businessMeaning",
    expectedSuggestionCount: 0,
  },
  {
    name: "rejects a missing business meaning for known semantics",
    output: [{ ...createValidOutput()[0], businessMeaning: null }],
    expectedPath: "semanticAiSuggestions[0].businessMeaning",
    expectedSuggestionCount: 0,
  },
  {
    name: "rejects an overlong explanation",
    output: [{ ...createValidOutput()[0], explanation: "x".repeat(501) }],
    expectedPath: "semanticAiSuggestions[0].explanation",
    expectedSuggestionCount: 0,
  },
  {
    name: "rejects an alternative that duplicates the primary candidate",
    output: [
      {
        ...createValidOutput()[0],
        alternatives: [
          {
            semanticRole: "dimension",
            semanticType: SEMANTIC_TYPE_IDS.eventName,
            businessMeaning: "Another event label",
            semanticConfidence: 0.5,
            reason: "The same candidate cannot be an alternative.",
          },
        ],
      },
    ],
    expectedPath: "semanticAiSuggestions[0].alternatives",
    expectedSuggestionCount: 0,
  },
  {
    name: "rejects an incompatible role and type",
    output: [{ ...createValidOutput()[0], semanticRole: "measure" }],
    expectedPath: "semanticAiSuggestions[0]",
    expectedSuggestionCount: 0,
  },
  {
    name: "accepts a high-confidence unknown candidate with explicit ambiguity",
    output: [
      {
        ...createValidOutput()[0],
        semanticRole: "unknown",
        semanticType: SEMANTIC_TYPE_IDS.unknown,
        businessMeaning: null,
        semanticConfidence: 0.8,
        ambiguity: "The available profile is not conclusive.",
      },
    ],
    expectedPath: null,
    expectedSuggestionCount: 1,
  },
  {
    name: "accepts a partial output when inference-context fields are missing",
    output: createValidOutput(),
    expectedPath: null,
    expectedSuggestionCount: 1,
  },
  {
    name: "rejects server-trusted fields in model output",
    output: [{ ...createValidOutput()[0], id: "model-controlled-id" }],
    expectedPath: "semanticAiSuggestions[0]",
    expectedSuggestionCount: 0,
  },
];

export function runSemanticAiOutputValidationFixtures(): void {
  for (const fixture of semanticAiOutputValidationFixtures) {
    try {
      const outputs = validateSemanticAiSuggestionOutput(
        fixture.output,
        fixtureContext,
      );

      if (fixture.expectedPath !== null) {
        throw new Error(`Fixture unexpectedly passed: ${fixture.name}.`);
      }

      if (outputs.length !== fixture.expectedSuggestionCount) {
        throw new Error(`Fixture returned an unexpected suggestion count: ${fixture.name}.`);
      }

      const stampedSuggestions = stampSemanticAiSuggestions(outputs);

      if (
        stampedSuggestions.some(
          (suggestion) =>
            suggestion.inferenceSource !== "ai" ||
            suggestion.id !==
              `semantic-suggestion_${suggestion.stableFieldKey}_ai-v1`,
        )
      ) {
        throw new Error(`Fixture did not receive server-trusted metadata: ${fixture.name}.`);
      }
    } catch (error) {
      if (fixture.expectedPath === null) {
        throw new Error(`Fixture unexpectedly failed: ${fixture.name}.`, {
          cause: error,
        });
      }

      if (!(error instanceof SemanticAiOutputValidationError)) {
        throw new Error(`Fixture threw an unexpected error: ${fixture.name}.`, {
          cause: error,
        });
      }

      if (error.diagnostic.path !== fixture.expectedPath) {
        throw new Error(
          `Fixture produced ${error.diagnostic.path} instead of ${fixture.expectedPath}: ${fixture.name}.`,
        );
      }

      continue;
    }
  }
}
