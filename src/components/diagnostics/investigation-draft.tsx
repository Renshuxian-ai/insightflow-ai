import type { DiagnosticCase } from "@/lib/diagnostics/types";
import { formatDirectionalPercentageChange } from "@/lib/metric-formatters";
import type {
  ConfidenceLevel,
  EvidenceReference,
  InvestigationResult,
} from "@/lib/investigations/types";

type InvestigationDraftProps = {
  diagnosticCase: DiagnosticCase;
  result: InvestigationResult;
};

const sourceTypeLabels: Record<EvidenceReference["sourceType"], string> = {
  metric: "Metric",
  context: "Context",
  "behavior-signal": "Behavior signal",
  "feedback-signal": "Feedback signal",
};

const confidenceStyles: Record<ConfidenceLevel, string> = {
  low: "bg-[#f2f4f8] text-[#647087]",
  medium: "bg-[#fff6e4] text-[#92601b]",
  high: "bg-[#eaf8f0] text-[#27714b]",
};

function resolveEvidenceReference(reference: EvidenceReference, diagnosticCase: DiagnosticCase) {
  if (reference.sourceType === "metric" && diagnosticCase.metric.id === reference.sourceId) {
    return {
      label: diagnosticCase.metric.label,
      value: `${diagnosticCase.metric.currentValue} · ${formatDirectionalPercentageChange(diagnosticCase.metric.changeValue)} ${diagnosticCase.metric.comparison}`,
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
      return { label: signal.label, value: `${signal.value} · ${signal.finding}` };
    }
  }

  if (reference.sourceType === "feedback-signal") {
    const signal = diagnosticCase.evidence.feedbackSignals.find(
      (item) => item.id === reference.sourceId,
    );

    if (signal) {
      return {
        label: signal.topic,
        value: `${signal.change} · ${signal.finding}`,
      };
    }
  }

  return { label: "Unavailable reference", value: reference.sourceId };
}

function getLinkedEvidenceLabels(
  referenceIds: string[],
  evidenceById: Map<string, EvidenceReference>,
  diagnosticCase: DiagnosticCase,
) {
  return referenceIds
    .map((referenceId) => evidenceById.get(referenceId))
    .filter((reference): reference is EvidenceReference => Boolean(reference))
    .map((reference) => resolveEvidenceReference(reference, diagnosticCase).label);
}

export function InvestigationDraft({ diagnosticCase, result }: InvestigationDraftProps) {
  const evidenceById = new Map(result.evidenceUsed.map((reference) => [reference.id, reference]));

  return (
    <div className="mt-5 border-t border-[#e7eaf0] pt-5" id={`investigation-draft-${result.id}`}>
      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <article className="rounded-lg border border-[#dfe4f2] bg-[#f8f9ff] p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#6072b8]">
            Investigation focus
          </p>
          <h3 className="mt-2 text-sm font-semibold text-[#263247]">{result.focus.title}</h3>
          <p className="mt-2 text-xs leading-5 text-[#68758b]">{result.focus.description}</p>
        </article>

        <article className="rounded-lg border border-[#e9ecf1] bg-[#fafbfc] p-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#3559e8]">
              Investigation summary
            </p>
            <span className="rounded-md bg-[#edf1ff] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.06em] text-[#6072b8]">
              Evidence-linked observation
            </span>
          </div>
          <p className="mt-2 text-sm font-medium leading-6 text-[#344056]">{result.summary.text}</p>
          <p className="mt-2 text-[11px] text-[#98a1b1]">
            Uses {result.summary.evidenceReferenceIds.length} references · Observation only · Not a causal conclusion
          </p>
        </article>
      </div>

      <section className="mt-5" aria-labelledby={`evidence-used-${result.id}`}>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#3559e8]">Evidence used</p>
            <h3 id={`evidence-used-${result.id}`} className="mt-1 text-sm font-semibold text-[#263247]">
              References from this DiagnosticCase
            </h3>
          </div>
          <p className="text-[11px] text-[#98a1b1]">Referenced, not copied into a second evidence source</p>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {result.evidenceUsed.map((reference) => {
            const resolved = resolveEvidenceReference(reference, diagnosticCase);

            return (
              <article key={reference.id} className="rounded-lg border border-[#e9ecf1] bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold text-[#344056]">{resolved.label}</h4>
                  <span className="rounded-md bg-[#f2f4f8] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.06em] text-[#778196]">
                    {sourceTypeLabels[reference.sourceType]}
                  </span>
                </div>
                <p className="mt-2 text-xs font-medium leading-5 text-[#5f6b80]">{resolved.value}</p>
                <p className="mt-2 text-[11px] leading-5 text-[#8a94a6]">Why used: {reference.relevance}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mt-5" aria-labelledby={`possible-explanations-${result.id}`}>
        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#a86713]">
          Possible explanations
        </p>
        <h3 id={`possible-explanations-${result.id}`} className="mt-1 text-sm font-semibold text-[#263247]">
          Inference · Possible, not confirmed
        </h3>

        <div className="mt-3 space-y-3">
          {result.possibleExplanations.map((explanation) => (
            <article key={explanation.id} className="rounded-lg border border-[#eadfca] bg-[#fffcf6] p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-[#fff6e4] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.06em] text-[#92601b]">
                  {explanation.qualification === "alternative-to-rule-out"
                    ? "Alternative to rule out"
                    : "Possible · Not confirmed"}
                </span>
              </div>
              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                <p className="max-w-3xl text-sm font-semibold leading-6 text-[#344056]">{explanation.statement}</p>
                <span
                  className={`w-fit shrink-0 rounded-md px-2 py-1 text-[9px] font-bold uppercase tracking-[0.06em] ${confidenceStyles[explanation.confidence]}`}
                >
                  {explanation.evidenceRelationship === "context-only"
                    ? "Not yet evidenced"
                    : `${explanation.confidence} support`}
                </span>
              </div>
              <p className="mt-2 text-xs leading-5 text-[#68758b]">{explanation.confidenceRationale}</p>
              <p className="mt-2 text-xs leading-5 text-[#92601b]">
                Unresolved: {explanation.uncertainty}
              </p>
              <p className="mt-2 text-[11px] text-[#98a1b1]">
                {explanation.evidenceRelationship === "context-only" ? "Prompting context" : "Supporting evidence"}: {getLinkedEvidenceLabels(
                  explanation.evidenceReferenceIds,
                  evidenceById,
                  diagnosticCase,
                ).join(" · ")}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-5" aria-labelledby={`recommended-validation-${result.id}`}>
        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#6c4bd1]">
          Recommended validation
        </p>
        <h3 id={`recommended-validation-${result.id}`} className="mt-1 text-sm font-semibold text-[#263247]">
          Move from a hypothesis to a test
        </h3>

        <article className="mt-3 rounded-lg border border-[#ddd6f5] bg-[#faf8ff] p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-[#f1edff] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.06em] text-[#6244bd]">
              {result.workingHypothesis.status === "unvalidated"
                ? "Unvalidated hypothesis"
                : result.workingHypothesis.status}
            </span>
            <span className="text-[11px] text-[#8a7bb5]">
              Linked evidence: {getLinkedEvidenceLabels(
                result.workingHypothesis.evidenceReferenceIds,
                evidenceById,
                diagnosticCase,
              ).join(" · ")}
            </span>
          </div>
          <p className="mt-2 text-sm font-medium leading-6 text-[#443b64]">{result.workingHypothesis.statement}</p>
        </article>

        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {result.recommendedValidations.map((recommendation) => {
            const validation = diagnosticCase.nextValidations.find(
              (item) => item.id === recommendation.validationId,
            );

            return (
              <article key={recommendation.validationId} className="rounded-lg border border-[#e9ecf1] bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold text-[#344056]">
                    {validation?.label ?? "Unavailable validation"}
                  </h4>
                  <span className="rounded-md bg-[#f2f4f8] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.06em] text-[#778196]">
                    {recommendation.priority}
                  </span>
                </div>
                {validation ? <p className="mt-2 text-xs leading-5 text-[#68758b]">{validation.description}</p> : null}
                <p className="mt-2 text-[11px] leading-5 text-[#8a94a6]">Why next: {recommendation.rationale}</p>
              </article>
            );
          })}
        </div>
      </section>

      <div className="mt-5 rounded-lg border border-dashed border-[#dfe3ea] bg-[#fafbfc] px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#7e8798]">Current limitations</p>
        <ul className="mt-2 space-y-1 text-xs leading-5 text-[#68758b]">
          {result.limitations.map((limitation) => (
            <li key={limitation}>• {limitation}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
