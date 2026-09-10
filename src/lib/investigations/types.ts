export type ConfidenceLevel = "low" | "medium" | "high";

export type EvidenceReference = {
  id: string;
  sourceType: "metric" | "context" | "behavior-signal" | "feedback-signal";
  sourceId: string;
  relevance: string;
};

export type InvestigationResult = {
  id: string;
  diagnosticCaseId: string;
  source: "mock";
  status: "prototype-draft";
  focus: {
    title: string;
    description: string;
  };
  summary: {
    text: string;
    evidenceReferenceIds: string[];
  };
  evidenceUsed: EvidenceReference[];
  possibleExplanations: Array<{
    id: string;
    statement: string;
    qualification: "possible-not-confirmed" | "alternative-to-rule-out";
    evidenceRelationship: "supporting" | "context-only";
    confidence: ConfidenceLevel;
    confidenceRationale: string;
    evidenceReferenceIds: string[];
    uncertainty: string;
  }>; 
  workingHypothesis: {
    id: string;
    statement: string;
    status: "unvalidated";
    evidenceReferenceIds: string[];
  };
  recommendedValidations: Array<{
    validationId: string;
    priority: "primary" | "supporting";
    rationale: string;
  }>;
  limitations: string[];
};
