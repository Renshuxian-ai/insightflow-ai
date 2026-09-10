import type { DiagnosticCase } from "@/lib/diagnostics/types";
import { getInvestigationResult } from "@/lib/investigations/mock-data";
import { getValidationPlanTemplates } from "@/lib/validations/mock-data";

import { DiagnosticEvidence } from "./diagnostic-evidence";
import { DiagnosticHeader } from "./diagnostic-header";
import { DiagnosticReasoning } from "./diagnostic-reasoning";
import { DiagnosticSummary } from "./diagnostic-summary";
import { DiagnosticTrace } from "./diagnostic-trace";
import { InvestigationAssistant } from "./investigation-assistant";

type DiagnosticsPageProps = {
  diagnosticCase: DiagnosticCase;
};

export function DiagnosticsPage({ diagnosticCase }: DiagnosticsPageProps) {
  const investigationResult = getInvestigationResult(diagnosticCase.id);
  const validationPlanTemplates = getValidationPlanTemplates(diagnosticCase.id);

  return (
    <main className="mx-auto w-full max-w-[1280px] px-5 py-7 sm:px-7 lg:px-10 lg:py-9">
      <DiagnosticHeader diagnosticCase={diagnosticCase} />

      <div className="mt-6 space-y-6">
        <DiagnosticSummary summary={diagnosticCase.summary} />
        <DiagnosticEvidence evidence={diagnosticCase.evidence} />
        <DiagnosticReasoning reasoning={diagnosticCase.reasoning} />
        <DiagnosticTrace traceSteps={diagnosticCase.traceSteps} />
        <InvestigationAssistant
          key={diagnosticCase.id}
          diagnosticCase={diagnosticCase}
          result={investigationResult}
          validationPlanTemplates={validationPlanTemplates}
        />
      </div>
    </main>
  );
}
