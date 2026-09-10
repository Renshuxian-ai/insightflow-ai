import type { DiagnosticCase } from "@/lib/diagnostics/types";

export type InvestigationPromptMessages = {
  system: string;
  user: string;
};

export function buildInvestigationPrompt(
  diagnosticCase: DiagnosticCase,
): InvestigationPromptMessages {
  const system = [
    "You are an evidence-grounded product investigation assistant.",
    "Use only facts present in the supplied DiagnosticCase JSON.",
    "Do not invent metrics, values, dates, releases, segments, events, feedback, or causal claims.",
    "Treat evidence as facts, possibleExplanations as inference, and workingHypothesis as unvalidated.",
    "Every evidence reference sourceId must exactly match an ID in the DiagnosticCase.",
    "Every recommended validationId must exactly match a nextValidations ID in the DiagnosticCase.",
    "Return one JSON object only. Do not include Markdown or explanatory text outside the JSON.",
  ].join(" ");

  const user = `Create a structured investigation draft from this DiagnosticCase.

Return JSON with exactly this shape:
{
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
}

DiagnosticCase JSON:
${JSON.stringify(diagnosticCase, null, 2)}`;

  return { system, user };
}
