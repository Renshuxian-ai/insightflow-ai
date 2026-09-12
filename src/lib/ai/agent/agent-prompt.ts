import type { DiagnosticCase } from "@/lib/diagnostics/types";

import type { AgentMessage } from "./types";

const investigationResultShape = `{
  "focus": { "title": "string", "description": "string" },
  "summary": {
    "text": "string",
    "evidenceReferenceIds": ["one-or-more evidenceUsed.id values"]
  },
  "evidenceUsed": [
    {
      "id": "reference-id",
      "sourceType": "metric | context | behavior-signal | feedback-signal",
      "sourceId": "exact DiagnosticCase source ID",
      "relevance": "string"
    }
  ],
  "possibleExplanations": [
    {
      "id": "explanation-id",
      "statement": "string",
      "qualification": "possible-not-confirmed | alternative-to-rule-out",
      "evidenceRelationship": "supporting | context-only",
      "confidence": "low | medium | high",
      "confidenceRationale": "string",
      "evidenceReferenceIds": ["one-or-more evidenceUsed.id values"],
      "uncertainty": "string"
    }
  ],
  "workingHypothesis": {
    "statement": "string",
    "evidenceReferenceIds": ["one-or-more evidenceUsed.id values"]
  },
  "recommendedValidations": [
    {
      "validationId": "exact nextValidations ID",
      "priority": "primary | supporting",
      "rationale": "string"
    }
  ],
  "limitations": ["string"]
}`;

const investigationOutputContract = [
  "InvestigationResult output contract (all requirements are mandatory):",
  "- Return every field shown in the required JSON shape. Every string must be non-empty after trimming.",
  "- Do not generate server-owned metadata: investigation id, diagnosticCaseId, source, status, workingHypothesis.id, or workingHypothesis.status.",
  "- Array sizes: evidenceUsed 1-12 items; possibleExplanations 1-6; recommendedValidations 1 through the number of DiagnosticCase.nextValidations; limitations 1-8; every evidenceReferenceIds array 1-20.",
  "- Character limits: focus.title <= 240; focus.description <= 2000; summary.text <= 2000.",
  "- Character limits: evidenceUsed[*].id and sourceId <= 120; evidenceUsed[*].relevance <= 800.",
  "- Character limits: possibleExplanations[*].id <= 120; statement, confidenceRationale, and uncertainty <= 2000.",
  "- Character limits: workingHypothesis.statement <= 2000; recommendedValidations[*].validationId <= 120; recommendedValidations[*].rationale <= 800.",
  "- Character limits: every evidenceReferenceIds item <= 120; every limitations item <= 120.",
  "- Exact enums: sourceType is metric, context, behavior-signal, or feedback-signal; qualification is possible-not-confirmed or alternative-to-rule-out; evidenceRelationship is supporting or context-only; confidence is low, medium, or high; priority is primary or supporting.",
  "- IDs must be unique within evidenceUsed, possibleExplanations, and recommendedValidations.",
  "Grounding reference contract:",
  "- evidenceUsed is required. Give each item a unique model-created id, and set its sourceId to an exact metric, context, behavior-signal, or feedback-signal ID from the DiagnosticCase. Do not invent sourceId values.",
  "- summary.evidenceReferenceIds is required and must not be omitted. Select 1-20 evidenceUsed[*].id values that directly support the factual claims in summary.text.",
  "- possibleExplanations[*].evidenceReferenceIds is required for every explanation and must not be omitted. Select 1-20 evidenceUsed[*].id values relevant to that explanation while keeping the explanation explicitly unconfirmed.",
  "- workingHypothesis.evidenceReferenceIds is required and must not be omitted. Select 1-20 evidenceUsed[*].id values relevant to the unvalidated hypothesis.",
  "- evidenceReferenceIds contain evidenceUsed[*].id values, not DiagnosticCase source IDs. DiagnosticCase source IDs belong only in evidenceUsed[*].sourceId.",
  "- Evidence must remain factual. Do not present an inference or hypothesis as evidence, and do not create an evidenceUsed item for an unsupported inference.",
  "- Every recommendedValidations[*].validationId must exactly match a DiagnosticCase.nextValidations ID.",
].join("\n");

export function buildInitialAgentMessages(
  diagnosticCase: DiagnosticCase,
): AgentMessage[] {
  return [
    {
      role: "system",
      content: [
        "You are an evidence-grounded product investigation assistant.",
        "Use only facts in the supplied DiagnosticCase and tool observations.",
        "Tools return observations, not causal conclusions.",
        "Do not invent metrics, values, dates, releases, segments, events, feedback, or causal claims.",
        "If a tool can clarify the case, call only an available tool with IDs from the DiagnosticCase.",
        "If no tool is needed, return the final InvestigationResult JSON with no Markdown.",
      ].join(" "),
    },
    {
      role: "user",
      content: [
        "Review this DiagnosticCase and decide whether to inspect available evidence with tools.",
        "If you return a final result now, it must follow this contract:",
        investigationOutputContract,
        `Required JSON shape:\n${investigationResultShape}`,
        `DiagnosticCase JSON:\n${JSON.stringify(diagnosticCase, null, 2)}`,
      ].join("\n\n"),
    },
  ];
}

export function buildFinalGenerationMessage(): AgentMessage {
  return {
    role: "user",
    content: [
      "Use the DiagnosticCase and any tool observations above to produce one final InvestigationResult JSON object.",
      "Treat evidence as facts, possibleExplanations as unconfirmed inference, and workingHypothesis as unvalidated.",
      "Do not omit summary.evidenceReferenceIds, possibleExplanations[*].evidenceReferenceIds, or workingHypothesis.evidenceReferenceIds.",
      "Return no Markdown or explanatory text outside JSON.",
      investigationOutputContract,
      `Required JSON shape:\n${investigationResultShape}`,
    ].join("\n\n"),
  };
}
