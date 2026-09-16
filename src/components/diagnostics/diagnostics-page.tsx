import { investigationModelOptions } from "@/lib/ai/model-registry";
import type { DiagnosticCase } from "@/lib/diagnostics/types";
import type { DiagnosticReturnTarget } from "@/lib/diagnostics/diagnostic-navigation";
import type { AgentTrace } from "@/lib/ai/agent/types";
import type { InvestigationResult } from "@/lib/investigations/types";
import { getValidationPlanTemplates } from "@/lib/validations/mock-data";

import { DiagnosticEvidence } from "./diagnostic-evidence";
import {
  ExistingInvestigationNotice,
  type ExistingInvestigationLifecycle,
} from "./existing-investigation-notice";
import { DiagnosticHeader } from "./diagnostic-header";
import { DiagnosticReasoning } from "./diagnostic-reasoning";
import { DiagnosticStepNav } from "./diagnostic-step-nav";
import { DiagnosticSummary } from "./diagnostic-summary";
import { InvestigationAssistant } from "./investigation-assistant";

type DiagnosticsPageProps = {
  diagnosticCase: DiagnosticCase;
  sourceLabel?: string;
  investigationCaseId?: string;
  existingInvestigation?: ExistingInvestigationLifecycle | null;
  initialInvestigation?: {
    result: InvestigationResult;
    trace: AgentTrace;
    createdAt: string;
  } | null;
  returnTarget?: DiagnosticReturnTarget;
};

export function DiagnosticsPage({
  diagnosticCase,
  sourceLabel,
  investigationCaseId,
  existingInvestigation,
  initialInvestigation,
  returnTarget = { href: "/", label: "Overview" },
}: DiagnosticsPageProps) {
  const validationPlanTemplates = getValidationPlanTemplates(diagnosticCase.id);
  const investigationStateKey = [
    investigationCaseId ?? "unpersisted",
    diagnosticCase.id,
    diagnosticCase.primarySignal?.metric ?? diagnosticCase.metric.id,
    diagnosticCase.primarySignal?.interval ?? "no-interval",
    diagnosticCase.primarySignal?.segment ?? "no-segment",
  ].join(":");

  return (
    <main className="mx-auto w-full max-w-[1480px] px-5 py-7 sm:px-7 lg:px-10 lg:py-9 xl:pr-[13rem]">
      <DiagnosticStepNav />
      <DiagnosticHeader
        diagnosticCase={diagnosticCase}
        sourceLabel={sourceLabel}
        returnTarget={returnTarget}
      />

      <div className="mt-6 space-y-6">
        {existingInvestigation ? (
          <ExistingInvestigationNotice investigation={existingInvestigation} />
        ) : null}
        <div id="investigation-summary" className="scroll-mt-6">
          <DiagnosticSummary diagnosticCase={diagnosticCase} />
        </div>
        <div id="investigation-evidence-basis" className="scroll-mt-6">
          <DiagnosticEvidence diagnosticCase={diagnosticCase} />
        </div>
        <DiagnosticReasoning reasoning={diagnosticCase.reasoning} />
        <div id="investigation-analysis-direction" className="scroll-mt-6">
          <InvestigationAssistant
            key={investigationStateKey}
            diagnosticCase={diagnosticCase}
            investigationCaseId={investigationCaseId}
            initialInvestigation={initialInvestigation}
            models={investigationModelOptions}
            validationPlanTemplates={validationPlanTemplates}
          />
        </div>
      </div>
    </main>
  );
}
