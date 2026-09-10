import type { AgentTrace, AgentTraceEvent } from "@/lib/ai/agent/types";
import type { DiagnosticCase } from "@/lib/diagnostics/types";

type AgentTraceSummaryProps = {
  diagnosticCase: DiagnosticCase;
  trace: AgentTrace | null;
};

type TraceStep = {
  id: string;
  label: string;
  status: "Checked" | "Skipped" | "Unavailable" | "Completed";
};

function getToolStepLabel(
  event: AgentTraceEvent,
  diagnosticCase: DiagnosticCase,
): string {
  if (event.toolName === "query_metric") {
    return `Checked ${diagnosticCase.metric.label} metric`;
  }

  if (event.toolName === "analyze_segment") {
    return "Compared affected segments";
  }

  if (event.toolName === "search_feedback") {
    return "Reviewed feedback signals";
  }

  return "Checked an additional investigation signal";
}

function getToolStepStatus(event: AgentTraceEvent): TraceStep["status"] {
  if (event.toolResult?.status === "rejected") {
    return "Skipped";
  }

  if (event.toolResult?.status === "error") {
    return "Unavailable";
  }

  return "Checked";
}

function getTraceSteps(
  trace: AgentTrace,
  diagnosticCase: DiagnosticCase,
): TraceStep[] {
  const toolSteps = trace.events
    .filter((event) => event.type === "observation" && event.toolName)
    .map((event) => ({
      id: event.id,
      label: getToolStepLabel(event, diagnosticCase),
      status: getToolStepStatus(event),
    }));
  const finalEvent = trace.events.find(
    (event) => event.type === "final-generation",
  );

  return finalEvent
    ? [
        ...toolSteps,
        {
          id: finalEvent.id,
          label: "Generated investigation draft",
          status: "Completed" as const,
        },
      ]
    : toolSteps;
}

export function AgentTraceSummary({
  diagnosticCase,
  trace,
}: AgentTraceSummaryProps) {
  if (!trace) {
    return null;
  }

  const steps = getTraceSteps(trace, diagnosticCase);

  if (steps.length === 0) {
    return null;
  }

  return (
    <section
      className="mt-6 rounded-xl border border-[#e2e6ef] bg-[#fafbfc] p-5"
      aria-labelledby={`agent-trace-summary-${trace.id}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#6072b8]">
            Investigation trace
          </p>
          <h3
            id={`agent-trace-summary-${trace.id}`}
            className="mt-1 text-sm font-semibold text-[#263247]"
          >
            Signals checked before generating this draft
          </h3>
        </div>
        <span className="rounded-md bg-[#f2f4f8] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.06em] text-[#778196]">
          Session only
        </span>
      </div>

      <ol className="mt-4 grid gap-2 md:grid-cols-2">
        {steps.map((step, index) => (
          <li
            key={step.id}
            className="flex items-center gap-3 rounded-lg border border-[#e7eaf0] bg-white px-3 py-2.5"
          >
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#edf1ff] text-[10px] font-bold text-[#5268bd]">
              {index + 1}
            </span>
            <span className="min-w-0 flex-1 text-xs font-medium text-[#465268]">
              {step.label}
            </span>
            <span className="shrink-0 text-[9px] font-bold uppercase tracking-[0.06em] text-[#7c879a]">
              {step.status}
            </span>
          </li>
        ))}
      </ol>

      <p className="mt-3 text-[11px] leading-5 text-[#8a94a6]">
        This summary shows the investigation steps only. Prompts, raw model responses, and internal payloads are not displayed.
      </p>
    </section>
  );
}
