import { InvestigationLaunchLink } from "@/components/diagnostics/investigation-launch-link";
import type { AnomalyCardViewModel } from "@/lib/overview/overview-view-model";
import { buildAnalyticsInvestigationHref } from "@/lib/analytics/investigation-context";
import { withDiagnosticReturnTo } from "@/lib/diagnostics/diagnostic-navigation";

type AnomalyCardProps = {
  anomaly: AnomalyCardViewModel;
};

export function AnomalyCard({ anomaly }: AnomalyCardProps) {
  const highSeverity = anomaly.severity === "HIGH";
  const investigationHref = anomaly.investigationContext
    ? buildAnalyticsInvestigationHref(
        `/ai-diagnostics/${encodeURIComponent(anomaly.investigationContext.signalId)}`,
        anomaly.investigationContext,
        { returnTo: "/" },
      )
    : withDiagnosticReturnTo(`/ai-diagnostics/${anomaly.id}`, "/");

  return (
    <article className="rounded-lg border border-[#e9ecf1] p-3 transition-colors hover:border-[#d8def0] lg:p-2">
      <div className="flex items-start justify-between gap-4 lg:gap-2">
        <div className="lg:flex lg:min-w-0 lg:items-center lg:gap-1.5">
          <span className={highSeverity ? "inline-flex rounded-md bg-[#fff0f0] px-1.5 py-0.5 text-[10px] font-bold tracking-[0.08em] text-[#c44242] lg:shrink-0 lg:px-1 lg:text-[9px]" : "inline-flex rounded-md bg-[#fff6e4] px-1.5 py-0.5 text-[10px] font-bold tracking-[0.08em] text-[#a86713] lg:shrink-0 lg:px-1 lg:text-[9px]"}>
            {anomaly.severity}
          </span>
          <h3 className="mt-1.5 line-clamp-2 text-sm font-semibold leading-5 tracking-[-0.01em] text-[#263247] lg:mt-0 lg:min-w-0 lg:text-xs lg:leading-4">{anomaly.title}</h3>
        </div>
        {anomaly.showInvestigationAction && anomaly.diagnosticAvailable ? (
          <InvestigationLaunchLink
            href={investigationHref}
            className="shrink-0 text-xs font-semibold text-[#3559e8] transition-colors hover:text-[#2446cb] lg:inline-flex lg:h-6 lg:items-center"
          >
            Investigate <span aria-hidden="true">→</span>
          </InvestigationLaunchLink>
        ) : anomaly.showInvestigationAction ? (
          <button
            type="button"
            disabled
            title="Diagnostic case planned"
            className="shrink-0 cursor-not-allowed text-xs font-semibold text-[#a1a8b5] lg:inline-flex lg:h-6 lg:items-center"
          >
            Investigate <span aria-hidden="true">→</span>
          </button>
        ) : null}
      </div>
      <p className="mt-2 text-sm font-semibold text-[#263247] lg:mt-0.5 lg:text-[13px]">
        {anomaly.metricLabel ? `${anomaly.metricLabel}: ` : null}
        {anomaly.current}{" "}
        <span className="font-medium text-[#c44242]">{anomaly.change}</span>
      </p>
      <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#7e8798] lg:mt-0.5 lg:text-[11px] lg:leading-4">
        {anomaly.evidenceSummary}
      </p>
    </article>
  );
}
