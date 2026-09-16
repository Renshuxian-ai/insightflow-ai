import type { DiagnosticCase } from "@/lib/diagnostics/types";

import type { ToolExecutionResult, ToolName } from "../tools/types";
import type {
  LlmEvidenceEvaluation,
  LlmEvidenceEvaluator,
} from "./llm-evidence-evaluator";

export type EvidenceRuleEvaluation = {
  ruleScore: number;
  missingRequirements: string[];
};

export type EvidenceSufficiencyEvaluation = {
  status: "sufficient" | "insufficient";
  confidence: number;
  evidenceScore: number;
  missingEvidence: string[];
  recommendedNextTools: ToolName[];
};

export type EvidenceSufficiencyEvaluatorInput = {
  diagnosticCase: DiagnosticCase;
  toolObservations: readonly ToolExecutionResult[];
  availableTools: readonly ToolName[];
};

const EVIDENCE_THRESHOLD = 0.8;

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}

function successfulToolNames(
  toolObservations: readonly ToolExecutionResult[],
): Set<string> {
  return new Set(
    toolObservations
      .filter((result) => result.status === "success")
      .map((result) => result.toolName),
  );
}

function hasTool(toolNames: Set<string>, ...names: ToolName[]): boolean {
  return names.some((name) => toolNames.has(name));
}

function getSurface(
  diagnosticCase: DiagnosticCase,
): "retention" | "funnel" | "feedback" | null {
  if (diagnosticCase.metric.id.startsWith("retention-")) {
    return "retention";
  }

  if (diagnosticCase.metric.id === "funnel-conversion") {
    return "funnel";
  }

  if (diagnosticCase.metric.id === "feedback-topic-mentions") {
    return "feedback";
  }

  return null;
}

function evaluateRetentionRules(
  toolNames: Set<string>,
): EvidenceRuleEvaluation {
  const hasMetric = hasTool(toolNames, "retention_analysis", "query_metric");
  const hasSegment = hasTool(toolNames, "segment_analysis", "analyze_segment");
  const hasFeedback = hasTool(
    toolNames,
    "feedback_analysis",
    "search_feedback",
  );
  const hasFunnel = hasTool(toolNames, "funnel_analysis");
  const missingRequirements = [
    ...(hasMetric ? [] : ["retention metric comparison"]),
    ...(hasSegment ? [] : ["affected user segment"]),
  ];

  return {
    ruleScore: roundScore(
      (hasMetric ? 0.45 : 0) +
        (hasSegment ? 0.35 : 0) +
        (hasFeedback ? 0.1 : 0) +
        (hasFunnel ? 0.1 : 0),
    ),
    missingRequirements,
  };
}

function evaluateFunnelRules(
  toolNames: Set<string>,
  toolObservations: readonly ToolExecutionResult[],
): EvidenceRuleEvaluation {
  const funnelObservation = toolObservations.find(
    (result) => result.status === "success" && result.toolName === "funnel_analysis",
  );
  const hasTransition =
    typeof funnelObservation?.observation.facts.stepTransition === "string";
  const hasDropOff =
    typeof funnelObservation?.observation.facts.dropOffRate === "number" &&
    typeof funnelObservation.observation.facts.affectedUsers === "number";
  const hasSegment = hasTool(toolNames, "segment_analysis", "analyze_segment");
  const hasFeedback = hasTool(
    toolNames,
    "feedback_analysis",
    "search_feedback",
  );
  const ruleScore = roundScore(
    (hasTransition ? 0.35 : 0) +
      (hasDropOff ? 0.35 : 0) +
      (hasSegment ? 0.2 : 0) +
      (hasFeedback ? 0.1 : 0),
  );
  const missingRequirements = [
    ...(hasTransition ? [] : ["funnel step transition"]),
    ...(hasDropOff ? [] : ["funnel drop-off impact"]),
    ...(ruleScore >= EVIDENCE_THRESHOLD || hasSegment
      ? []
      : ["affected user segment"]),
  ];

  return { ruleScore, missingRequirements };
}

function evaluateFeedbackRules(
  toolObservations: readonly ToolExecutionResult[],
): EvidenceRuleEvaluation {
  const feedbackObservation = toolObservations.find(
    (result) =>
      result.status === "success" && result.toolName === "feedback_analysis",
  );
  const hasTopic =
    typeof feedbackObservation?.observation.facts.topic === "string" &&
    typeof feedbackObservation.observation.facts.mentions === "number";
  const quotes = feedbackObservation?.observation.facts.representativeQuotes;
  const hasQuotes = Array.isArray(quotes) && quotes.length > 0;
  const toolNames = successfulToolNames(toolObservations);
  const hasRetention = hasTool(toolNames, "retention_analysis");
  const hasFunnel = hasTool(toolNames, "funnel_analysis");

  return {
    ruleScore: roundScore(
      (hasTopic ? 0.4 : 0) +
        (hasQuotes ? 0.4 : 0) +
        (hasRetention ? 0.1 : 0) +
        (hasFunnel ? 0.1 : 0),
    ),
    missingRequirements: [
      ...(hasTopic ? [] : ["feedback topic volume"]),
      ...(hasQuotes ? [] : ["representative feedback quotes"]),
    ],
  };
}

export function evaluateEvidenceRules({
  diagnosticCase,
  toolObservations,
}: EvidenceSufficiencyEvaluatorInput): EvidenceRuleEvaluation {
  const surface = getSurface(diagnosticCase);
  const toolNames = successfulToolNames(toolObservations);

  if (surface === "retention") {
    return evaluateRetentionRules(toolNames);
  }

  if (surface === "funnel") {
    return evaluateFunnelRules(toolNames, toolObservations);
  }

  if (surface === "feedback") {
    return evaluateFeedbackRules(toolObservations);
  }

  return {
    ruleScore: 0,
    missingRequirements: ["supported analytics evidence"],
  };
}

function getRecommendedTools(
  missingRequirements: readonly string[],
  input: EvidenceSufficiencyEvaluatorInput,
): ToolName[] {
  const recommendations = new Set<ToolName>();
  const completedTools = successfulToolNames(input.toolObservations);
  const availableTools = new Set(input.availableTools);
  const recommend = (toolName: ToolName) => {
    if (availableTools.has(toolName) && !completedTools.has(toolName)) {
      recommendations.add(toolName);
    }
  };

  for (const requirement of missingRequirements) {
    if (requirement === "retention metric comparison") {
      recommend("retention_analysis");
    } else if (requirement === "affected user segment") {
      recommend("segment_analysis");
    } else if (
      requirement === "funnel step transition" ||
      requirement === "funnel drop-off impact"
    ) {
      recommend("funnel_analysis");
    } else if (
      requirement === "feedback topic volume" ||
      requirement === "representative feedback quotes"
    ) {
      recommend("feedback_analysis");
    }
  }

  return [...recommendations];
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

export async function evaluateEvidenceSufficiency(
  input: EvidenceSufficiencyEvaluatorInput,
  llmEvaluator: LlmEvidenceEvaluator,
): Promise<EvidenceSufficiencyEvaluation> {
  const rules = evaluateEvidenceRules(input);
  const llmEvaluation: LlmEvidenceEvaluation = await llmEvaluator(input);
  const isSufficient =
    rules.ruleScore >= EVIDENCE_THRESHOLD && llmEvaluation.sufficient;
  const missingEvidence = unique([
    ...rules.missingRequirements,
    ...(llmEvaluation.sufficient ? [] : llmEvaluation.missingEvidence),
  ]);
  let recommendedNextTools = getRecommendedTools(missingEvidence, input);

  if (!isSufficient && recommendedNextTools.length === 0) {
    const completedTools = successfulToolNames(input.toolObservations);

    recommendedNextTools = input.availableTools.filter(
      (toolName) => !completedTools.has(toolName),
    );
  }

  return {
    status: isSufficient ? "sufficient" : "insufficient",
    confidence: roundScore(
      isSufficient ? (rules.ruleScore + 1) / 2 : rules.ruleScore * 0.75,
    ),
    evidenceScore: rules.ruleScore,
    missingEvidence,
    recommendedNextTools,
  };
}
