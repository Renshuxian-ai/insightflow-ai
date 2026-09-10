import type { DiagnosticCase } from "@/lib/diagnostics/types";

import type { AgentMessage } from "./types";

const investigationResultShape = `{
  "focus": { "title": "string", "description": "string" },
  "summary": { "text": "string", "evidenceReferenceIds": ["reference-id"] },
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
      "evidenceReferenceIds": ["reference-id"],
      "uncertainty": "string"
    }
  ],
  "workingHypothesis": {
    "statement": "string",
    "evidenceReferenceIds": ["reference-id"]
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
      content: `Review this DiagnosticCase and decide whether to inspect available evidence with tools.\n\nDiagnosticCase JSON:\n${JSON.stringify(diagnosticCase, null, 2)}`,
    },
  ];
}

export function buildFinalGenerationMessage(): AgentMessage {
  return {
    role: "user",
    content: [
      "Use the DiagnosticCase and any tool observations above to produce one final InvestigationResult JSON object.",
      "Treat evidence as facts, possibleExplanations as unconfirmed inference, and workingHypothesis as unvalidated.",
      "Every evidence reference sourceId must exactly match an ID in the DiagnosticCase.",
      "Every recommended validationId must exactly match a nextValidations ID in the DiagnosticCase.",
      "Return no Markdown or explanatory text outside JSON.",
      `Required JSON shape:\n${investigationResultShape}`,
    ].join("\n\n"),
  };
}
