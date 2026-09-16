import type { AgentTrace, AgentTraceEvent } from "@/lib/ai/agent/types";
import type { DiagnosticCase } from "@/lib/diagnostics/types";
import type {
  EvidenceReference,
  InvestigationResult,
} from "@/lib/investigations/types";

type InvestigationTraceProps = {
  diagnosticCase: DiagnosticCase;
  result: InvestigationResult | null;
  trace: AgentTrace | null;
};

type TraceStatus = "Completed" | "Skipped" | "Unavailable";

type TimelineStep = {
  id: string;
  action: string;
  description: string;
  source: string;
  status: TraceStatus;
};

const statusStyles: Record<TraceStatus, string> = {
  Completed: "bg-[#eaf8f0] text-[#27714b]",
  Skipped: "bg-[#f2f4f8] text-[#68758b]",
  Unavailable: "bg-[#fff1f0] text-[#b42318]",
};

function getEventStatus(event: AgentTraceEvent): TraceStatus {
  if (event.toolResult?.status === "rejected") {
    return "Skipped";
  }

  if (event.toolResult?.status === "error") {
    return "Unavailable";
  }

  return "Completed";
}

function getToolEvidenceLabel(toolName: string) {
  if (toolName === "query_metric") {
    return "metric evidence";
  }

  if (toolName === "analyze_segment") {
    return "segment evidence";
  }

  if (toolName === "search_feedback") {
    return "feedback evidence";
  }

  return "tool evidence";
}

function buildTimeline(
  trace: AgentTrace,
  diagnosticCase: DiagnosticCase,
): TimelineStep[] {
  const startedStep: TimelineStep = {
    id: `${trace.id}-started`,
    action: "Investigation started",
    description: diagnosticCase.investigationTarget
      ? `Started from the selected target: ${diagnosticCase.investigationTarget.title}.`
      : `Started from the ${diagnosticCase.metric.label} diagnostic signal.`,
    source: "Agent",
    status: "Completed",
  };
  const eventSteps = trace.events.map((event, index): TimelineStep => {
    if (event.type === "model-request") {
      return {
        id: event.id,
        action:
          index === 0
            ? `Analyzing ${diagnosticCase.metric.label} signal`
            : "Reviewing available evidence",
        description: event.detail,
        source: "Agent",
        status: "Completed",
      };
    }

    if (event.type === "tool-call") {
      const observation = trace.events[index + 1];

      return {
        id: event.id,
        action: `Calling ${event.toolName ?? "analysis tool"}`,
        description: event.detail,
        source: event.toolName ?? "Tool",
        status:
          observation?.type === "observation" &&
          observation.toolName === event.toolName
            ? getEventStatus(observation)
            : "Completed",
      };
    }

    if (event.type === "observation") {
      return {
        id: event.id,
        action: `Received ${getToolEvidenceLabel(event.toolName ?? "")}`,
        description: event.detail,
        source: event.toolName ?? "Tool",
        status: getEventStatus(event),
      };
    }

    return {
      id: event.id,
      action: "Updated investigation hypothesis",
      description: event.detail,
      source: "Investigation draft",
      status: "Completed",
    };
  });

  return [startedStep, ...eventSteps];
}

function resolveEvidence(
  reference: EvidenceReference,
  diagnosticCase: DiagnosticCase,
) {
  if (
    reference.sourceType === "metric" &&
    reference.sourceId === diagnosticCase.metric.id
  ) {
    return {
      label: diagnosticCase.metric.label,
      value: [
        `Current ${diagnosticCase.metric.currentValue}`,
        diagnosticCase.metric.previousValue
          ? `Baseline ${diagnosticCase.metric.previousValue}`
          : null,
      ]
        .filter(Boolean)
        .join(" · "),
    };
  }

  if (reference.sourceType === "context") {
    const contextItem = Object.values(diagnosticCase.context).find(
      (item) => item.id === reference.sourceId,
    );

    if (contextItem) {
      return { label: "Diagnostic context", value: contextItem.label };
    }
  }

  if (reference.sourceType === "behavior-signal") {
    const signal = diagnosticCase.evidence.behaviorSignals.find(
      (item) => item.id === reference.sourceId,
    );

    if (signal) {
      return { label: signal.label, value: signal.finding };
    }
  }

  if (reference.sourceType === "feedback-signal") {
    const signal = diagnosticCase.evidence.feedbackSignals.find(
      (item) => item.id === reference.sourceId,
    );

    if (signal) {
      return { label: signal.topic, value: signal.finding };
    }
  }

  return { label: "Evidence reference", value: reference.relevance };
}

function getSourceTool(
  reference: EvidenceReference,
  completedTools: ReadonlySet<string>,
): string | null {
  if (reference.sourceType === "metric" && completedTools.has("query_metric")) {
    return "query_metric";
  }

  if (
    (reference.sourceType === "context" ||
      reference.sourceType === "behavior-signal") &&
    completedTools.has("analyze_segment")
  ) {
    return "analyze_segment";
  }

  if (
    reference.sourceType === "feedback-signal" &&
    completedTools.has("search_feedback")
  ) {
    return "search_feedback";
  }

  return null;
}

export function InvestigationTrace({
  diagnosticCase,
  result,
  trace,
}: InvestigationTraceProps) {
  if (!trace) {
    return (
      <section className="mt-5 rounded-xl border border-[#e2e6ef] bg-[#fafbfc] p-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#6072b8]">
          Investigation trace
        </p>
        <p className="mt-2 text-sm text-[#778196]">
          No investigation trace available
        </p>
      </section>
    );
  }

  const timeline = buildTimeline(trace, diagnosticCase);
  const toolObservations = trace.events.filter(
    (event) => event.type === "observation" && event.toolName,
  );
  const completedTools = new Set(
    toolObservations
      .filter((event) => event.toolResult?.status === "success")
      .map((event) => event.toolName!),
  );
  const addedEvidence =
    result?.evidenceUsed.flatMap((reference) => {
      const sourceTool = getSourceTool(reference, completedTools);

      return sourceTool ? [{ reference, sourceTool }] : [];
    }) ?? [];

  return (
    <section
      className="mt-5 rounded-xl border border-[#dfe4f2] bg-[#fafbff] p-5"
      aria-labelledby={`investigation-trace-${trace.id}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#6072b8]">
            Investigation trace
          </p>
          <h3
            id={`investigation-trace-${trace.id}`}
            className="mt-1 text-sm font-semibold text-[#263247]"
          >
            How the investigation draft was built
          </h3>
        </div>
        <span className="rounded-md bg-[#edf1ff] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.06em] text-[#6072b8]">
          Session only
        </span>
      </div>

      <ol className="mt-5 space-y-0">
        {timeline.map((step, index) => (
          <li key={step.id} className="relative flex gap-3 pb-4 last:pb-0">
            {index < timeline.length - 1 ? (
              <span
                className="absolute left-[13px] top-7 h-[calc(100%-1.25rem)] w-px bg-[#dce3f2]"
                aria-hidden="true"
              />
            ) : null}
            <span className="relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border border-[#d5def5] bg-white text-[10px] font-bold text-[#5268bd]">
              {index + 1}
            </span>
            <article className="min-w-0 flex-1 rounded-lg border border-[#e7eaf0] bg-white px-3.5 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-[#344056]">
                    {step.action}
                  </p>
                  <p className="mt-1 text-[10px] text-[#8a94a6]">
                    Source: {step.source}
                  </p>
                </div>
                <span
                  className={`rounded-md px-2 py-1 text-[9px] font-bold uppercase tracking-[0.06em] ${statusStyles[step.status]}`}
                >
                  {step.status}
                </span>
              </div>
              <p className="mt-2 text-[11px] leading-5 text-[#68758b]">
                {step.description}
              </p>
            </article>
          </li>
        ))}
      </ol>

      {toolObservations.length > 0 ? (
        <div className="mt-5 border-t border-[#e2e6ef] pt-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#6072b8]">
            Tool calls
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {toolObservations.map((observation) => {
              const status = getEventStatus(observation);
              const linkedEvidence = addedEvidence
                .filter(
                  ({ sourceTool }) => sourceTool === observation.toolName,
                )
                .slice(0, 3);

              return (
                <article
                  key={observation.id}
                  className="rounded-lg border border-[#e7eaf0] bg-white p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-[0.07em] text-[#8a94a6]">
                        Tool call
                      </p>
                      <p className="mt-1 font-mono text-xs font-semibold text-[#344056]">
                        {observation.toolName}
                      </p>
                    </div>
                    <span
                      className={`rounded-md px-2 py-1 text-[9px] font-bold uppercase tracking-[0.06em] ${statusStyles[status]}`}
                    >
                      {status}
                    </span>
                  </div>
                  <p className="mt-3 text-[9px] font-bold uppercase tracking-[0.07em] text-[#8a94a6]">
                    Observation
                  </p>
                  <p className="mt-1.5 text-[11px] leading-5 text-[#5f6b7e]">
                    {observation.detail}
                  </p>
                  {linkedEvidence.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {linkedEvidence.map(({ reference }) => {
                        const evidence = resolveEvidence(
                          reference,
                          diagnosticCase,
                        );

                        return (
                          <div
                            key={reference.id}
                            className="rounded-md bg-[#f7f8fa] px-2.5 py-2"
                          >
                            <p className="text-[10px] font-semibold text-[#526078]">
                              {evidence.label}
                            </p>
                            <p className="mt-1 text-[10px] leading-4 text-[#778196]">
                              {evidence.value}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </div>
      ) : null}

      {addedEvidence.length > 0 ? (
        <div className="mt-5 border-t border-[#e2e6ef] pt-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#6072b8]">
            Evidence added to draft
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {addedEvidence.map(({ reference, sourceTool }) => {
              const evidence = resolveEvidence(reference, diagnosticCase);

              return (
                <article
                  key={reference.id}
                  className="rounded-lg border border-[#e2e8f3] bg-white px-3.5 py-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold text-[#344056]">
                        {evidence.label}
                      </p>
                      <p className="mt-1 text-[10px] text-[#8a94a6]">
                        Source: {sourceTool}
                      </p>
                    </div>
                    <span className="rounded-md bg-[#eef2ff] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.06em] text-[#5268bd]">
                      Evidence added
                    </span>
                  </div>
                  <p className="mt-2 text-[11px] leading-5 text-[#5f6b7e]">
                    {evidence.value}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      ) : null}

      <p className="mt-4 text-[10px] leading-4 text-[#98a1b1]">
        Trace descriptions show bounded investigation actions and validated
        evidence references. Prompts and raw model responses are not displayed.
      </p>
    </section>
  );
}
