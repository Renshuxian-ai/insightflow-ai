import {
  isSemanticTypeCompatibleWithRole,
  semanticTypeRegistry,
  SEMANTIC_ROLES,
  SEMANTIC_TYPE_IDS,
} from "../semantic-type-registry";
import type { SemanticInferenceContext } from "../types";
import {
  SemanticAiOutputValidationError,
  stampSemanticAiSuggestions,
  unwrapSemanticAiSuggestionResponse,
  validateSemanticAiSuggestionOutput,
} from "./ai-output-schema";
import { SEMANTIC_AI_OUTPUT_CONTRACT } from "./semantic-ai-output-contract";

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
      semanticType: SEMANTIC_TYPE_IDS.eventName,
      businessMeaning: "Tracked product event name",
      semanticConfidence: 0.92,
      explanation: "The field name and string profile indicate an event label.",
      alternatives: [],
      ambiguity: null,
    },
  ];
}

function createValidAlternative(
  semanticType: string = SEMANTIC_TYPE_IDS.metric,
) {
  return {
    semanticType,
    businessMeaning: "Product metric",
    semanticConfidence: 0.5,
    reason: "Numeric values could represent a product metric.",
  };
}

export const semanticAiOutputValidationFixtures: readonly SemanticAiOutputValidationFixture[] = [
  {
    name: "rejects a non-array suggestions value",
    output: {},
    expectedPath: "semanticAiSuggestions",
    expectedSuggestionCount: 0,
  },
  {
    name: "accepts a valid semantic AI output",
    output: createValidOutput(),
    expectedPath: null,
    expectedSuggestionCount: 1,
  },
  {
    name: "rejects a missing stableFieldKey",
    output: [{
      semanticType: SEMANTIC_TYPE_IDS.eventName,
      businessMeaning: "Tracked product event name",
      semanticConfidence: 0.92,
      explanation: "The field name indicates an event label.",
    }],
    expectedPath: "semanticAiSuggestions[0].stableFieldKey",
    expectedSuggestionCount: 0,
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
    name: "rejects model-controlled semanticRole",
    output: [{ ...createValidOutput()[0], semanticRole: "dimension" }],
    expectedPath: "semanticAiSuggestions[0].semanticRole",
    expectedSuggestionCount: 0,
  },
  {
    name: "rejects a missing semanticType",
    output: [{
      stableFieldKey: "event_name__1",
      businessMeaning: "Tracked product event name",
      semanticConfidence: 0.92,
      explanation: "The field name indicates an event label.",
    }],
    expectedPath: "semanticAiSuggestions[0].semanticType",
    expectedSuggestionCount: 0,
  },
  {
    name: "rejects an invalid semantic type",
    output: [{ ...createValidOutput()[0], semanticType: "customer-name" }],
    expectedPath: "semanticAiSuggestions[0].semanticType",
    expectedSuggestionCount: 0,
  },
  {
    name: "rejects a missing confidence",
    output: [{
      stableFieldKey: "event_name__1",
      semanticType: SEMANTIC_TYPE_IDS.eventName,
      businessMeaning: "Tracked product event name",
      explanation: "The field name indicates an event label.",
    }],
    expectedPath: "semanticAiSuggestions[0].semanticConfidence",
    expectedSuggestionCount: 0,
  },
  {
    name: "rejects confidence below zero",
    output: [{ ...createValidOutput()[0], semanticConfidence: -0.01 }],
    expectedPath: "semanticAiSuggestions[0].semanticConfidence",
    expectedSuggestionCount: 0,
  },
  {
    name: "rejects a missing business meaning",
    output: [{
      stableFieldKey: "event_name__1",
      semanticType: SEMANTIC_TYPE_IDS.eventName,
      semanticConfidence: 0.92,
      explanation: "The field name indicates an event label.",
    }],
    expectedPath: "semanticAiSuggestions[0].businessMeaning",
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
    output: [{
      ...createValidOutput()[0],
      businessMeaning: "x".repeat(
        SEMANTIC_AI_OUTPUT_CONTRACT.businessMeaning.hardMax + 1,
      ),
    }],
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
    name: "accepts text above generation target and within hard max",
    output: [{
      ...createValidOutput()[0],
      explanation: "x".repeat(
        SEMANTIC_AI_OUTPUT_CONTRACT.explanation.generationTarget + 1,
      ),
    }],
    expectedPath: null,
    expectedSuggestionCount: 1,
  },
  {
    name: "rejects an overlong explanation",
    output: [{
      ...createValidOutput()[0],
      explanation: "x".repeat(
        SEMANTIC_AI_OUTPUT_CONTRACT.explanation.hardMax + 1,
      ),
    }],
    expectedPath: "semanticAiSuggestions[0].explanation",
    expectedSuggestionCount: 0,
  },
  {
    name: "rejects an overlong ambiguity",
    output: [{
      ...createValidOutput()[0],
      ambiguity: "x".repeat(
        SEMANTIC_AI_OUTPUT_CONTRACT.ambiguity.hardMax + 1,
      ),
    }],
    expectedPath: "semanticAiSuggestions[0].ambiguity",
    expectedSuggestionCount: 0,
  },
  {
    name: "rejects a non-string ambiguity",
    output: [{ ...createValidOutput()[0], ambiguity: 42 }],
    expectedPath: "semanticAiSuggestions[0].ambiguity",
    expectedSuggestionCount: 0,
  },
  {
    name: "rejects a non-array alternatives value",
    output: [{ ...createValidOutput()[0], alternatives: {} }],
    expectedPath: "semanticAiSuggestions[0].alternatives",
    expectedSuggestionCount: 0,
  },
  {
    name: "rejects too many alternatives",
    output: [{
      ...createValidOutput()[0],
      alternatives: [
        createValidAlternative(SEMANTIC_TYPE_IDS.metric),
        {
          ...createValidAlternative(SEMANTIC_TYPE_IDS.retention),
          businessMeaning: "Retention outcome",
        },
      ],
    }],
    expectedPath: "semanticAiSuggestions[0].alternatives",
    expectedSuggestionCount: 0,
  },
  {
    name: "rejects an overlong alternative reason",
    output: [{
      ...createValidOutput()[0],
      alternatives: [{
        semanticType: SEMANTIC_TYPE_IDS.metric,
        businessMeaning: "Product metric",
        semanticConfidence: 0.5,
        reason: "x".repeat(
          SEMANTIC_AI_OUTPUT_CONTRACT.alternativeReason.hardMax + 1,
        ),
      }],
    }],
    expectedPath: "semanticAiSuggestions[0].alternatives[0].reason",
    expectedSuggestionCount: 0,
  },
  {
    name: "rejects an invalid alternative semanticType",
    output: [{
      ...createValidOutput()[0],
      alternatives: [createValidAlternative("not-registered")],
    }],
    expectedPath: "semanticAiSuggestions[0].alternatives[0].semanticType",
    expectedSuggestionCount: 0,
  },
  {
    name: "rejects a missing alternative semanticType",
    output: [{
      ...createValidOutput()[0],
      alternatives: [{
        businessMeaning: "Product metric",
        semanticConfidence: 0.5,
        reason: "Numeric values could represent a product metric.",
      }],
    }],
    expectedPath: "semanticAiSuggestions[0].alternatives[0].semanticType",
    expectedSuggestionCount: 0,
  },
  {
    name: "rejects a missing alternative business meaning",
    output: [{
      ...createValidOutput()[0],
      alternatives: [{
        semanticType: SEMANTIC_TYPE_IDS.metric,
        semanticConfidence: 0.5,
        reason: "Numeric values could represent a product metric.",
      }],
    }],
    expectedPath: "semanticAiSuggestions[0].alternatives[0].businessMeaning",
    expectedSuggestionCount: 0,
  },
  {
    name: "rejects a missing alternative confidence",
    output: [{
      ...createValidOutput()[0],
      alternatives: [{
        semanticType: SEMANTIC_TYPE_IDS.metric,
        businessMeaning: "Product metric",
        reason: "Numeric values could represent a product metric.",
      }],
    }],
    expectedPath: "semanticAiSuggestions[0].alternatives[0].semanticConfidence",
    expectedSuggestionCount: 0,
  },
  {
    name: "rejects a missing alternative reason",
    output: [{
      ...createValidOutput()[0],
      alternatives: [{
        semanticType: SEMANTIC_TYPE_IDS.metric,
        businessMeaning: "Product metric",
        semanticConfidence: 0.5,
      }],
    }],
    expectedPath: "semanticAiSuggestions[0].alternatives[0].reason",
    expectedSuggestionCount: 0,
  },
  {
    name: "rejects an alternative confidence above one",
    output: [{
      ...createValidOutput()[0],
      alternatives: [{
        ...createValidAlternative(),
        semanticConfidence: 1.01,
      }],
    }],
    expectedPath: "semanticAiSuggestions[0].alternatives[0].semanticConfidence",
    expectedSuggestionCount: 0,
  },
  {
    name: "rejects an overlong alternative business meaning",
    output: [{
      ...createValidOutput()[0],
      alternatives: [{
        ...createValidAlternative(),
        businessMeaning: "x".repeat(
          SEMANTIC_AI_OUTPUT_CONTRACT.businessMeaning.hardMax + 1,
        ),
      }],
    }],
    expectedPath: "semanticAiSuggestions[0].alternatives[0].businessMeaning",
    expectedSuggestionCount: 0,
  },
  {
    name: "rejects an alternative that duplicates the primary candidate",
    output: [
      {
        ...createValidOutput()[0],
        alternatives: [
          {
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
    name: "rejects duplicate semantic alternatives",
    output: [{
      ...createValidOutput()[0],
      alternatives: [
        createValidAlternative(),
        createValidAlternative(),
      ],
    }],
    expectedPath: "semanticAiSuggestions[0].alternatives",
    expectedSuggestionCount: 0,
  },
  {
    name: "accepts a high-confidence unknown candidate with explicit ambiguity",
    output: [
      {
        ...createValidOutput()[0],
        semanticType: SEMANTIC_TYPE_IDS.unknown,
        semanticRole: "dimension",
        businessMeaning: null,
        semanticConfidence: 0.8,
        ambiguity: "The available profile is not conclusive.",
      },
    ],
    expectedPath: null,
    expectedSuggestionCount: 1,
  },
  {
    name: "rejects an unknown candidate without ambiguity",
    output: [{
      ...createValidOutput()[0],
      semanticType: SEMANTIC_TYPE_IDS.unknown,
      businessMeaning: null,
      ambiguity: undefined,
    }],
    expectedPath: "semanticAiSuggestions[0].ambiguity",
    expectedSuggestionCount: 0,
  },
  {
    name: "rejects an unknown candidate with a specific business meaning",
    output: [{
      ...createValidOutput()[0],
      semanticType: SEMANTIC_TYPE_IDS.unknown,
      businessMeaning: "Unsupported meaning",
      ambiguity: "The profile is inconclusive.",
    }],
    expectedPath: "semanticAiSuggestions[0].businessMeaning",
    expectedSuggestionCount: 0,
  },
  {
    name: "accepts an unknown alternative with null business meaning",
    output: [{
      ...createValidOutput()[0],
      alternatives: [{
        semanticType: SEMANTIC_TYPE_IDS.unknown,
        businessMeaning: null,
        semanticConfidence: 0.8,
        reason: "The available profile may not support a reliable mapping.",
      }],
    }],
    expectedPath: null,
    expectedSuggestionCount: 1,
  },
  {
    name: "rejects an unknown alternative with a business meaning",
    output: [{
      ...createValidOutput()[0],
      alternatives: [{
        semanticType: SEMANTIC_TYPE_IDS.unknown,
        businessMeaning: "Unsupported specific meaning",
        semanticConfidence: 0.8,
        reason: "The profile is inconclusive.",
      }],
    }],
    expectedPath: "semanticAiSuggestions[0].alternatives[0].businessMeaning",
    expectedSuggestionCount: 0,
  },
  {
    name: "accepts omitted optional ambiguity and alternatives",
    output: [{
      stableFieldKey: "event_name__1",
      semanticType: SEMANTIC_TYPE_IDS.eventName,
      businessMeaning: "Tracked product event name",
      semanticConfidence: 0.92,
      explanation: "The field name and string values indicate an event label.",
    }],
    expectedPath: null,
    expectedSuggestionCount: 1,
  },
  {
    name: "rejects a missing required explanation",
    output: [{
      stableFieldKey: "event_name__1",
      semanticType: SEMANTIC_TYPE_IDS.eventName,
      businessMeaning: "Tracked product event name",
      semanticConfidence: 0.92,
    }],
    expectedPath: "semanticAiSuggestions[0].explanation",
    expectedSuggestionCount: 0,
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
  {
    name: "rejects an extra model property",
    output: [{ ...createValidOutput()[0], unexpected: true }],
    expectedPath: "semanticAiSuggestions[0]",
    expectedSuggestionCount: 0,
  },
  {
    name: "rejects semanticRole inside an alternative",
    output: [{
      ...createValidOutput()[0],
      alternatives: [{
        ...createValidAlternative(),
        semanticRole: "measure",
      }],
    }],
    expectedPath: "semanticAiSuggestions[0].alternatives[0].semanticRole",
    expectedSuggestionCount: 0,
  },
  {
    name: "rejects an extra alternative property",
    output: [{
      ...createValidOutput()[0],
      alternatives: [{
        ...createValidAlternative(),
        explanation: "This property is not part of the alternative contract.",
      }],
    }],
    expectedPath: "semanticAiSuggestions[0].alternatives[0]",
    expectedSuggestionCount: 0,
  },
];

function assertEnvelopeContract(): void {
  const validResponse = { suggestions: createValidOutput() };

  if (unwrapSemanticAiSuggestionResponse(validResponse) !== validResponse.suggestions) {
    throw new Error("The semantic AI response envelope did not unwrap suggestions.");
  }

  for (const fixture of [
    {
      value: {},
      expectedPath: "semanticAiResponse.suggestions",
    },
    {
      value: { suggestions: [], extra: true },
      expectedPath: "semanticAiResponse",
    },
    {
      value: [],
      expectedPath: "semanticAiResponse",
    },
  ]) {
    try {
      unwrapSemanticAiSuggestionResponse(fixture.value);
    } catch (error) {
      if (
        error instanceof SemanticAiOutputValidationError &&
        error.diagnostic.path === fixture.expectedPath
      ) {
        continue;
      }

      throw new Error("The semantic response envelope fixture failed unexpectedly.", {
        cause: error,
      });
    }

    throw new Error("The semantic response envelope accepted invalid output.");
  }
}

function assertServerDerivedRoles(): void {
  for (const definition of Object.values(semanticTypeRegistry)) {
    const compatibleRoles = SEMANTIC_ROLES.filter((role) =>
      isSemanticTypeCompatibleWithRole(definition.id, role),
    );
    const isUnknown = definition.id === SEMANTIC_TYPE_IDS.unknown;

    if (
      (!isUnknown && compatibleRoles.length !== 1) ||
      (isUnknown && compatibleRoles.length !== SEMANTIC_ROLES.length)
    ) {
      throw new Error(
        `Unexpected semantic role cardinality for ${definition.id}.`,
      );
    }

    const outputs = validateSemanticAiSuggestionOutput(
      [{
        stableFieldKey: "event_name__1",
        semanticType: definition.id,
        businessMeaning: isUnknown ? null : definition.label,
        semanticConfidence: 0.8,
        explanation: "The profile provides bounded observable evidence.",
        ambiguity: isUnknown ? "No reliable semantic type was identified." : null,
      }],
      fixtureContext,
    );
    const suggestion = stampSemanticAiSuggestions(outputs)[0];

    if (suggestion?.semanticRole !== definition.role) {
      throw new Error(
        `The server did not derive the registered role for ${definition.id}.`,
      );
    }
  }

  const alternativeOutput = validateSemanticAiSuggestionOutput(
    [{
      ...createValidOutput()[0],
      alternatives: [createValidAlternative(SEMANTIC_TYPE_IDS.metric)],
    }],
    fixtureContext,
  );
  const alternative = stampSemanticAiSuggestions(alternativeOutput)[0]
    ?.alternatives[0];

  if (alternative?.semanticRole !== "measure") {
    throw new Error("The server did not derive the registered alternative role.");
  }

  const partialUnknownOutput = validateSemanticAiSuggestionOutput(
    [{
      ...createValidOutput()[0],
      semanticType: SEMANTIC_TYPE_IDS.unknown,
      semanticRole: "dimension",
      businessMeaning: null,
      ambiguity: "The role is identifiable, but the specific type is not.",
    }],
    fixtureContext,
  );

  if (stampSemanticAiSuggestions(partialUnknownOutput)[0]?.semanticRole !== "dimension") {
    throw new Error("The server did not preserve an allowed unknown-type role choice.");
  }

  const partialUnknownAlternativeOutput = validateSemanticAiSuggestionOutput(
    [{
      ...createValidOutput()[0],
      alternatives: [{
        semanticType: SEMANTIC_TYPE_IDS.unknown,
        semanticRole: "classification",
        businessMeaning: null,
        semanticConfidence: 0.7,
        reason: "Only a broad classification role can be supported.",
      }],
    }],
    fixtureContext,
  );

  if (
    stampSemanticAiSuggestions(partialUnknownAlternativeOutput)[0]
      ?.alternatives[0]?.semanticRole !== "classification"
  ) {
    throw new Error(
      "The server did not preserve an allowed unknown alternative role choice.",
    );
  }
}

export function runSemanticAiOutputValidationFixtures(): void {
  assertEnvelopeContract();
  assertServerDerivedRoles();

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
