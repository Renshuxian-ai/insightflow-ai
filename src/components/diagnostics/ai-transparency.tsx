"use client";

import type { AgentTrace } from "@/lib/ai/agent/types";
import type {
  InvestigationModelDefinition,
  InvestigationModelId,
  InvestigationModelOption,
} from "@/lib/ai/types";
import type { DiagnosticCase } from "@/lib/diagnostics/types";
import type { InvestigationResult } from "@/lib/investigations/types";

import { AgentTraceSummary } from "./agent-trace-summary";
import { DiagnosticTrace } from "./diagnostic-trace";

type AITransparencyProps = {
  diagnosticCase: DiagnosticCase;
  fallbackMessage: string | null;
  isGenerating: boolean;
  limitations: InvestigationResult["limitations"] | null;
  models: InvestigationModelOption[];
  selectedModelId: InvestigationModelId;
  trace: AgentTrace | null;
  usedModel: InvestigationModelDefinition | null;
  onModelChange: (modelId: string) => void;
};

export function AITransparency({
  diagnosticCase,
  fallbackMessage,
  isGenerating,
  limitations,
  models,
  selectedModelId,
  trace,
  usedModel,
  onModelChange,
}: AITransparencyProps) {
  return (
    <details className="group mt-6 rounded-xl border border-[#e2e6ef] bg-[#fafbfc]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-xl px-5 py-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3559e8] [&::-webkit-details-marker]:hidden">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#7e8798]">
            AI transparency
          </p>
          <p className="mt-1 text-sm font-semibold text-[#263247]">
            Data limitations, generation settings, and trace
          </p>
        </div>
        <span
          className="grid size-8 shrink-0 place-items-center rounded-lg border border-[#dfe3ea] bg-white text-[#68758b] transition-transform group-open:rotate-180"
          aria-hidden="true"
        >
          ↓
        </span>
      </summary>

      <div className="space-y-6 border-t border-[#e2e6ef] px-5 py-5">
        <section aria-labelledby="ai-transparency-generation-settings">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#6072b8]">
            Generation settings
          </p>
          <div className="mt-2 flex flex-col justify-between gap-3 rounded-lg border border-[#e7eaf0] bg-white p-4 sm:flex-row sm:items-center">
            <div>
              <h3
                id="ai-transparency-generation-settings"
                className="text-sm font-semibold text-[#263247]"
              >
                Draft model
              </h3>
              <p className="mt-1 text-xs leading-5 text-[#778196]">
                {usedModel
                  ? `Last generated with ${usedModel.label} (${usedModel.providerId} provider).`
                  : "The selected model will be used when the draft is created."}
              </p>
            </div>
            <select
              value={selectedModelId}
              onChange={(event) => onModelChange(event.target.value)}
              disabled={isGenerating}
              className="min-h-9 rounded-md border border-[#dce3eb] bg-white px-2.5 text-xs font-semibold text-[#344054] outline-none transition-colors focus:border-[#3559e8] focus:ring-2 focus:ring-[#dce3fb] disabled:cursor-not-allowed disabled:bg-[#f7f8fa]"
              aria-label="Investigation model"
            >
              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}
                </option>
              ))}
            </select>
          </div>

          {fallbackMessage ? (
            <p className="mt-3 rounded-lg border border-[#f2dfb0] bg-[#fffaf0] px-3 py-2 text-xs leading-5 text-[#8a5b00]">
              <span className="font-semibold">Provider fallback:</span>{" "}
              {fallbackMessage}
            </p>
          ) : null}
        </section>

        {limitations ? (
          <section
            className="border-t border-[#e2e6ef] pt-5"
            aria-labelledby="ai-transparency-limitations"
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#6072b8]">
              Data limitations
            </p>
            <h3
              id="ai-transparency-limitations"
              className="mt-1 text-sm font-semibold text-[#263247]"
            >
              What this investigation cannot establish yet
            </h3>
            <ul className="mt-3 space-y-2 text-xs leading-5 text-[#68758b]">
              {limitations.map((limitation) => (
                <li
                  key={limitation}
                  className="flex gap-2 rounded-lg border border-[#e7eaf0] bg-white px-3 py-2.5"
                >
                  <span className="text-[#98a1b1]" aria-hidden="true">
                    •
                  </span>
                  <span>{limitation}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="border-t border-[#e2e6ef] pt-5">
          <DiagnosticTrace
            traceSteps={diagnosticCase.traceSteps}
            source={diagnosticCase.source}
          />
        </div>

        {trace ? (
          <div className="border-t border-[#e2e6ef] pt-5">
            <AgentTraceSummary diagnosticCase={diagnosticCase} trace={trace} />
          </div>
        ) : null}
      </div>
    </details>
  );
}
