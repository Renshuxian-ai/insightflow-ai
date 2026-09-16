"use client";

import { useState } from "react";

import { useDatasetWorkspaceSession } from "@/components/datasets/dataset-workspace-session";
import { RUNTIME_SESSION_HEADER } from "@/lib/runtime-session";

import {
  defaultInvestigationModelId,
  getInvestigationModel,
  isInvestigationModelId,
} from "@/lib/ai/model-registry";
import type { AgentTrace, AgentTraceEventType } from "@/lib/ai/agent/types";
import { parseInvestigationResult } from "@/lib/ai/output-schema";
import type {
  InvestigationModelId,
  InvestigationModelOption,
} from "@/lib/ai/types";
import type { DiagnosticCase } from "@/lib/diagnostics/types";
import type { InvestigationResult } from "@/lib/investigations/types";
import { buildValidationPlan } from "@/lib/validations/mock-data";
import type {
  ActionablePMReview,
  PMReview,
  ReviewDecision,
  ValidationPlan,
  ValidationPlanTemplate,
} from "@/lib/validations/types";

import { AITransparency } from "./ai-transparency";
import { InvestigationDraft } from "./investigation-draft";
import { InvestigationTrace } from "./investigation-trace";
import { getInvestigationValidationOptions } from "./investigation-validation-options";
import { NextValidation } from "./next-validation";
import { PMReviewPanel } from "./pm-review";
import {
  ValidationPlanCard,
  type ValidationPlanUiStatus,
} from "./validation-plan";
import { ValidationResult } from "./validation-result";

type InvestigationAssistantProps = {
  diagnosticCase: DiagnosticCase;
  investigationCaseId?: string;
  initialInvestigation?: {
    result: InvestigationResult;
    trace: AgentTrace;
    createdAt: string;
  } | null;
  models: InvestigationModelOption[];
  validationPlanTemplates: ValidationPlanTemplate[];
};

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

const agentTraceEventTypes: AgentTraceEventType[] = [
  "model-request",
  "tool-call",
  "observation",
  "final-generation",
];

function isAgentTrace(value: unknown): value is AgentTrace {
  if (!isRecord(value) || !isRecord(value.limits) || !Array.isArray(value.events)) {
    return false;
  }

  const hasValidEvents = value.events.every(
    (event) =>
      isRecord(event) &&
      typeof event.id === "string" &&
      typeof event.detail === "string" &&
      typeof event.type === "string" &&
      agentTraceEventTypes.includes(event.type as AgentTraceEventType) &&
      (event.toolName === undefined || typeof event.toolName === "string"),
  );

  return (
    typeof value.id === "string" &&
    typeof value.diagnosticCaseId === "string" &&
    typeof value.modelId === "string" &&
    value.persistence === "session-only" &&
    typeof value.limits.maxToolRounds === "number" &&
    typeof value.limits.maxToolCalls === "number" &&
    hasValidEvents
  );
}

export function InvestigationAssistant({
  diagnosticCase,
  investigationCaseId,
  initialInvestigation,
  models,
  validationPlanTemplates,
}: InvestigationAssistantProps) {
  const { runtimeSessionId } = useDatasetWorkspaceSession();
  const selectableModels =
    diagnosticCase.source === "dataset"
      ? models.filter((model) => model.id === "deepseek-v3")
      : models;
  const [selectedModelId, setSelectedModelId] =
    useState<InvestigationModelId>(
      diagnosticCase.source === "dataset"
        ? "deepseek-v3"
        : models[0]?.id ?? defaultInvestigationModelId,
    );
  const [usedModelId, setUsedModelId] =
    useState<InvestigationModelId | null>(null);
  const [result, setResult] = useState<InvestigationResult | null>(
    initialInvestigation?.result ?? null,
  );
  const [investigationCreatedAt, setInvestigationCreatedAt] =
    useState<string | null>(initialInvestigation?.createdAt ?? null);
  const [agentTrace, setAgentTrace] = useState<AgentTrace | null>(
    initialInvestigation?.trace ?? null,
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [fallbackMessage, setFallbackMessage] = useState<string | null>(null);
  const [isDraftVisible, setIsDraftVisible] = useState(
    initialInvestigation !== undefined && initialInvestigation !== null,
  );
  const [decision, setDecision] = useState<ReviewDecision | null>(null);
  const [refinedHypothesis, setRefinedHypothesis] = useState("");
  const [note, setNote] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [selectedValidationId, setSelectedValidationId] = useState("");
  const [confirmedReview, setConfirmedReview] = useState<PMReview | null>(null);
  const [validationPlan, setValidationPlan] = useState<ValidationPlan | null>(null);
  const [validationPlanUiStatus, setValidationPlanUiStatus] =
    useState<ValidationPlanUiStatus>("draft");
  const [reviewError, setReviewError] = useState<string | null>(null);
  const workflowRegionId = result ? `investigation-workflow-${result.id}` : undefined;
  const usedModel = usedModelId ? getInvestigationModel(usedModelId) : null;

  const validationOptions = result
    ? getInvestigationValidationOptions(diagnosticCase, result)
    : [];

  function resetReviewWorkflow() {
    setDecision(null);
    setRefinedHypothesis("");
    setNote("");
    setRejectionReason("");
    setSelectedValidationId("");
    setConfirmedReview(null);
    setValidationPlan(null);
    setValidationPlanUiStatus("draft");
    setReviewError(null);
  }

  async function handleGenerateInvestigation() {
    setIsGenerating(true);
    setGenerationError(null);
    setFallbackMessage(null);

    try {
      const response = await fetch("/api/investigations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [RUNTIME_SESSION_HEADER]: runtimeSessionId,
        },
        body: JSON.stringify({
          diagnosticCaseId: diagnosticCase.id,
          modelId: selectedModelId,
          ...(investigationCaseId ? { investigationCaseId } : {}),
          ...(diagnosticCase.source === "dataset"
            ? { diagnosticCase }
            : {}),
        }),
      });
      const responseBody: unknown = await response.json();

      if (!response.ok || !isRecord(responseBody)) {
        throw new Error("Investigation generation failed.");
      }

      if (
        responseBody.requestedModelId !== selectedModelId ||
        !isInvestigationModelId(responseBody.usedModelId) ||
        !isAgentTrace(responseBody.trace) ||
        responseBody.trace.diagnosticCaseId !== diagnosticCase.id ||
        responseBody.trace.modelId !== responseBody.usedModelId
      ) {
        throw new Error("Investigation response metadata is invalid.");
      }

      const validatedResult = parseInvestigationResult(
        responseBody.result,
        diagnosticCase,
      );
      const fallback = isRecord(responseBody.fallback)
        ? responseBody.fallback
        : null;

      setResult(validatedResult);
      setInvestigationCreatedAt(new Date().toISOString());
      setAgentTrace(responseBody.trace);
      setUsedModelId(responseBody.usedModelId);
      setFallbackMessage(
        fallback && typeof fallback.message === "string"
          ? fallback.message
          : null,
      );
      setIsDraftVisible(true);
      resetReviewWorkflow();
    } catch {
      setGenerationError(
        diagnosticCase.source === "dataset"
          ? "A validated dataset investigation draft could not be generated."
          : "A validated investigation draft could not be generated. Try again.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  function handleDecisionChange(nextDecision: ReviewDecision) {
    setDecision(nextDecision);
    setConfirmedReview(null);
    setValidationPlan(null);
    setReviewError(null);

    if (nextDecision === "reject-suggestion") {
      setSelectedValidationId("");
    }
  }

  function createPlanFromReview(
    nextDecision: Exclude<ReviewDecision, "reject-suggestion">,
    nextValidationId: string,
  ) {
    if (!result) {
      return;
    }

    const reviewId = `pm-review-${result.id}`;
    const normalizedRefinement = refinedHypothesis.trim();
    const normalizedNote = note.trim() || null;

    if (!nextValidationId) {
      setReviewError("No recommended analysis is available for this result.");
      return;
    }

    const template = validationPlanTemplates.find(
      (item) => item.nextValidationId === nextValidationId,
    );

    if (!template) {
      setReviewError("No plan template is available for this recommended analysis.");
      return;
    }

    const review: ActionablePMReview = {
      id: reviewId,
      diagnosticCaseId: diagnosticCase.id,
      investigationResultId: result.id,
      sourceHypothesisId: result.workingHypothesis.id,
      decision: nextDecision,
      refinedHypothesis:
        normalizedRefinement &&
        normalizedRefinement !== result.workingHypothesis.statement
          ? normalizedRefinement
          : null,
      note: normalizedNote,
      selectedValidationId: nextValidationId,
      rejectionReason: null,
      persistence: "session-only",
    };
    const plan = buildValidationPlan(review, template, diagnosticCase, result);

    if (!plan) {
      setReviewError("The recommended analysis does not match this diagnostic case.");
      return;
    }

    setDecision(nextDecision);
    setSelectedValidationId(nextValidationId);
    setConfirmedReview(review);
    setValidationPlan(plan);
    setValidationPlanUiStatus("draft");
    setReviewError(null);
  }

  function handleGenerateValidationPlan() {
    const nextDecision =
      decision && decision !== "reject-suggestion"
        ? decision
        : "use-as-working-hypothesis";
    const nextValidationId =
      selectedValidationId || validationOptions[0]?.id || "";

    createPlanFromReview(nextDecision, nextValidationId);
  }

  function handleConfirmReview() {
    if (!result || !decision) {
      return;
    }

    if (decision !== "reject-suggestion") {
      createPlanFromReview(decision, selectedValidationId);
      return;
    }

    const normalizedReason = rejectionReason.trim();

    if (!normalizedReason) {
      setReviewError("Add a rejection reason before recording this decision.");
      return;
    }

    const review: PMReview = {
      id: `pm-review-${result.id}`,
      diagnosticCaseId: diagnosticCase.id,
      investigationResultId: result.id,
      sourceHypothesisId: result.workingHypothesis.id,
      decision,
      refinedHypothesis: null,
      note: note.trim() || null,
      selectedValidationId: null,
      rejectionReason: normalizedReason,
      persistence: "session-only",
    };

    setConfirmedReview(review);
    setValidationPlan(null);
    setValidationPlanUiStatus("draft");
    setReviewError(null);
  }

  function handleEditReview() {
    setConfirmedReview(null);
    setValidationPlan(null);
    setValidationPlanUiStatus("draft");
    setReviewError(null);
  }

  function handleStartValidation() {
    if (validationPlan) {
      setValidationPlanUiStatus("running");
    }
  }

  async function handleCompleteValidation() {
    if (
      !validationPlan ||
      validationPlanUiStatus !== "running" ||
      !result ||
      !investigationCreatedAt
    ) {
      return;
    }

    const validationCompletedAt = new Date().toISOString();

    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [RUNTIME_SESSION_HEADER]: runtimeSessionId,
        },
        body: JSON.stringify({
          ...(investigationCaseId ? { investigationCaseId } : {}),
          diagnosticCase,
          investigationResult: result,
          validationPlan,
          validationStatus: "completed",
          investigationCreatedAt,
          validationCompletedAt,
        }),
      });

      if (!response.ok) {
        throw new Error("Session report creation failed.");
      }

      setValidationPlanUiStatus("completed");
      setGenerationError(null);
    } catch {
      setGenerationError(
        "Validation could not be completed because its session report was not created.",
      );
    }
  }

  function handleRunNewInvestigation() {
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set("investigationRun", "new");
    window.location.assign(nextUrl.toString());
  }

  return (
    <section
      className="rounded-xl border border-[#dce3fb] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.02)] sm:p-6"
      aria-labelledby="investigation-assistant-title"
    >
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#3559e8]">
          Investigation workflow
        </p>
        <h2
          id="investigation-assistant-title"
          className="mt-1 text-lg font-semibold tracking-[-0.025em] text-[#172033]"
        >
          Decide what to investigate next
        </h2>
        <p className="mt-1.5 text-sm leading-6 text-[#68758b]">
          Start from a recommended direction, then create an evidence-linked
          draft for human review. The workflow does not make a causal
          conclusion.
        </p>
      </div>

      {!result ? (
        <NextValidation actions={diagnosticCase.nextValidations} />
      ) : null}

      <div className="mt-5 flex flex-col justify-between gap-4 border-t border-[#e7eaf0] pt-5 sm:flex-row sm:items-center">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#6072b8]">
            {result ? "Refresh draft" : "Step 2 · Create a draft"}
          </p>
          <p className="mt-1 text-xs leading-5 text-[#778196]">
            {result
              ? `${result.evidenceUsed.length} evidence references used in the current draft.`
              : `${diagnosticCase.evidence.behaviorSignals.length + diagnosticCase.evidence.feedbackSignals.length} evidence signals are available for this case.`}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
          <button
            type="button"
            className="inline-flex min-h-10 w-full shrink-0 items-center justify-center rounded-lg bg-[#3559e8] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2949ca] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3559e8] disabled:cursor-not-allowed disabled:bg-[#9cacef] sm:w-fit"
            disabled={isGenerating}
            aria-busy={isGenerating}
            onClick={result ? handleRunNewInvestigation : handleGenerateInvestigation}
          >
            {isGenerating
              ? "Generating investigation draft..."
              : result
                ? "Run new investigation"
                : "Create investigation draft"}
          </button>
        </div>
      </div>

      {isGenerating ? (
        <p className="mt-4 text-sm font-medium text-[#3559e8]" role="status">
          Generating investigation draft...
        </p>
      ) : null}

      {generationError ? (
        <p
          className="mt-4 rounded-lg border border-[#f6d4d0] bg-[#fff7f6] px-3 py-2 text-sm text-[#b42318]"
          role="alert"
        >
          {generationError}
        </p>
      ) : null}

      <InvestigationTrace
        diagnosticCase={diagnosticCase}
        result={result}
        trace={agentTrace}
      />

      {result && isDraftVisible ? (
        <div id={workflowRegionId}>
          <InvestigationDraft diagnosticCase={diagnosticCase} result={result} />
          <PMReviewPanel
            originalHypothesis={result.workingHypothesis.statement}
            decision={decision}
            refinedHypothesis={refinedHypothesis}
            note={note}
            rejectionReason={rejectionReason}
            selectedValidationId={selectedValidationId}
            validationOptions={validationOptions}
            confirmedReview={confirmedReview}
            error={reviewError}
            onDecisionChange={handleDecisionChange}
            onRefinedHypothesisChange={setRefinedHypothesis}
            onNoteChange={setNote}
            onRejectionReasonChange={setRejectionReason}
            onValidationChange={setSelectedValidationId}
            onGenerateValidationPlan={handleGenerateValidationPlan}
            onConfirm={handleConfirmReview}
            onEdit={handleEditReview}
          />
          {validationPlan ? (
            <ValidationPlanCard
              plan={validationPlan}
              diagnosticCase={diagnosticCase}
              executionStatus={validationPlanUiStatus}
              onStartValidation={handleStartValidation}
              onCompleteValidation={handleCompleteValidation}
            />
          ) : null}
          {validationPlan && validationPlanUiStatus === "completed" ? (
            <ValidationResult
              diagnosticCase={diagnosticCase}
              investigationResult={result}
              plan={validationPlan}
            />
          ) : null}
        </div>
      ) : null}

      <AITransparency
        diagnosticCase={diagnosticCase}
        fallbackMessage={fallbackMessage}
        isGenerating={isGenerating}
        limitations={result?.limitations ?? null}
        models={selectableModels}
        selectedModelId={selectedModelId}
        trace={agentTrace}
        usedModel={usedModel}
        onModelChange={(nextModelId) => {
          if (isInvestigationModelId(nextModelId)) {
            setSelectedModelId(nextModelId);
          }
        }}
      />
    </section>
  );
}
