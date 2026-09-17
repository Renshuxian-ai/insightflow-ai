"use client";

import { useState } from "react";

import { InvestigationLaunchLink } from "@/components/diagnostics/investigation-launch-link";
import type {
  RetentionDiagnosisPresentation,
  RetentionSuggestedCheckPresentation,
} from "@/lib/analytics/retention-presentation";

import { AnalyticsSectionHeader } from "./analytics-page-frame";

function formatUsers(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatRate(value: number | null) {
  return value === null ? "—" : `${value.toFixed(1)}%`;
}

function EvidenceBadge({ label }: { label: "Evidence" | "Inference" }) {
  const isEvidence = label === "Evidence";

  return (
    <span
      className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] ${
        isEvidence
          ? "bg-[#eef2ff] text-[#3559e8]"
          : "bg-[#fff6e4] text-[#8a5b00]"
      }`}
    >
      {label}
    </span>
  );
}

export function RetentionDiagnosis({
  diagnosis,
  getInvestigationHref,
}: {
  diagnosis: RetentionDiagnosisPresentation;
  getInvestigationHref?: (
    target: RetentionSuggestedCheckPresentation,
  ) => string | null;
}) {
  const [selectedTargetId, setSelectedTargetId] = useState(
    diagnosis.suggestedChecks[0]?.id ?? "",
  );
  const selectedTarget =
    diagnosis.suggestedChecks.find(
      (direction) => direction.id === selectedTargetId,
    ) ?? diagnosis.suggestedChecks[0] ?? null;
  const investigationHref =
    selectedTarget && getInvestigationHref
      ? getInvestigationHref(selectedTarget)
      : null;
  const dimensionEvidence = [
    diagnosis.primaryEvidence,
    ...diagnosis.secondaryEvidence,
  ];
  const primary = diagnosis.primaryEvidence;

  return (
    <section className="mt-6" aria-label="Retention diagnosis">
      <AnalyticsSectionHeader
        title="Retention diagnosis"
        meta="Evidence-led interpretation"
      />
      <div className="rounded-xl border border-[#e7eaf0] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.02)]">
        <div className="flex flex-col justify-between gap-3 rounded-lg bg-[#fafbfc] px-3 py-2.5 sm:flex-row sm:items-start">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2">
              <EvidenceBadge label="Inference" />
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#98a1b1]">
                Current interpretation
              </p>
            </div>
            <p className="mt-1.5 text-xs font-medium leading-5 text-[#5f6b7e]">
              {diagnosis.interpretation}
            </p>
          </div>
          <span className="w-fit rounded-md bg-[#fff6e4] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-[#8a5b00]">
            {diagnosis.severity} priority
          </span>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_minmax(0,1fr)]">
          <article className="rounded-lg border border-[#e7eaf0] bg-[#fafbfc] p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[13px] font-semibold text-[#344056]">
                Observation
              </h3>
              <EvidenceBadge label="Evidence" />
            </div>
            <div className="mt-3 space-y-2">
              <div className="rounded-lg bg-white px-3 py-2.5">
                <p className="text-[11px] text-[#7e8798]">
                  D7 Retention · {primary.segment.label}
                </p>
                <div className="mt-1 flex items-baseline justify-between gap-3">
                  <p className="text-sm font-semibold text-[#344056]">
                    {formatRate(primary.segment.retention.D7)}
                  </p>
                  <p className="text-[11px] font-semibold text-[#bd3f3f]">
                    {primary.d7Gap.toFixed(1)} pp vs. {primary.benchmark.label}{" "}
                    {formatRate(primary.benchmark.retention.D7)}
                  </p>
                </div>
                <p className="mt-2 text-[10px] leading-4 text-[#8a94a6]">
                  {diagnosis.observation}
                </p>
              </div>
              <div className="rounded-lg bg-white px-3 py-2.5">
                <p className="text-[11px] text-[#7e8798]">
                  Affected users · {primary.segment.label}
                </p>
                <p className="mt-1 text-sm font-semibold text-[#344056]">
                  {formatUsers(primary.segment.users)}
                </p>
              </div>
            </div>
          </article>

          <article className="rounded-lg border border-[#e7eaf0] bg-[#fafbfc] p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[13px] font-semibold text-[#344056]">
                Segment evidence
              </h3>
              <EvidenceBadge label="Evidence" />
            </div>
            <div className="mt-3 space-y-2">
              {dimensionEvidence.map((evidence, index) => (
                <div
                  key={evidence.dimensionId}
                  className={`rounded-lg px-3 py-2.5 ${
                    index === 0 ? "bg-[#fff4f4]" : "bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] text-[#8a94a6]">
                        {index === 0 ? "Primary issue" : "Secondary signal"} ·{" "}
                        {evidence.dimensionLabel}
                      </p>
                      <p className="mt-0.5 text-[13px] font-semibold text-[#344056]">
                        {evidence.segment.label}
                      </p>
                    </div>
                    <p className="text-right text-[11px] font-semibold text-[#bd3f3f]">
                      {evidence.d7Gap.toFixed(1)} pp D7 gap
                    </p>
                  </div>
                  <p className="mt-2 text-[10px] text-[#8a94a6]">
                    Compared with {evidence.benchmark.label} at{" "}
                    {formatRate(evidence.benchmark.retention.D7)}
                  </p>
                  <div className="mt-3 grid grid-cols-4 gap-2 text-[10px] text-[#7e8798]">
                    <p>
                      <span className="block font-semibold text-[#4e5a70]">
                        {formatUsers(evidence.segment.users)}
                      </span>
                      Users
                    </p>
                    <p>
                      <span className="block font-semibold text-[#4e5a70]">
                        {formatRate(evidence.segment.retention.D1)}
                      </span>
                      D1
                    </p>
                    <p>
                      <span className="block font-semibold text-[#bd3f3f]">
                        {formatRate(evidence.segment.retention.D7)}
                      </span>
                      D7
                    </p>
                    <p>
                      <span className="block font-semibold text-[#4e5a70]">
                        {formatRate(evidence.segment.retention.D30)}
                      </span>
                      D30
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-lg border border-[#e7eaf0] bg-[#fafbfc] p-4">
            <div className="flex flex-col items-start gap-2">
              <h3 className="text-[13px] font-semibold text-[#344056]">
                Next investigation
              </h3>
              <EvidenceBadge label="Inference" />
            </div>
            <ul className="mt-3 space-y-2" aria-label="Investigation target">
              {diagnosis.suggestedChecks.map((direction) => {
                const isSelected = direction.id === selectedTarget?.id;

                return (
                  <li key={direction.id}>
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => setSelectedTargetId(direction.id)}
                      className={`w-full cursor-pointer rounded-lg border px-3 py-2.5 text-left transition-[border-color,background-color,box-shadow,transform] active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3559e8] ${
                        isSelected
                          ? "border-[#b8c6f8] bg-[#f5f7ff] shadow-[0_0_0_1px_rgba(53,89,232,0.06)]"
                          : "border-[#eef0f4] bg-white hover:border-[#d7def5] hover:bg-[#fafbff] active:bg-[#f5f7ff]"
                      }`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-[9px] font-semibold uppercase tracking-[0.07em] text-[#8a94a6]">
                          Suggested check
                        </span>
                        <span
                          aria-hidden="true"
                          className={`size-3 rounded-full border ${
                            isSelected
                              ? "border-[3px] border-[#3559e8] bg-white"
                              : "border-[#cfd5df] bg-white"
                          }`}
                        />
                      </span>
                      <span className={`mt-1.5 block text-[11px] leading-4 ${isSelected ? "font-semibold text-[#344056]" : "text-[#5f6b7e]"}`}>
                        {direction.title}
                      </span>
                      <span className="mt-2 inline-flex rounded-md bg-[#f1f3f6] px-1.5 py-0.5 text-[9px] font-semibold text-[#8a94a6]">
                        Not analyzed yet
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-[10px] leading-4 text-[#98a1b1]">
              Suggested checks are directions to validate, not conclusions.
            </p>
            {investigationHref ? (
              <InvestigationLaunchLink
                href={investigationHref}
                ariaLabel={`Investigate: ${selectedTarget?.title ?? "selected retention target"}`}
                className="mt-4 inline-flex h-8 cursor-pointer items-center justify-center rounded-lg border border-[#cfd9fb] bg-white px-3 text-[11px] font-semibold text-[#3559e8] transition-colors hover:border-[#aebefd] hover:bg-[#f5f7ff] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3559e8]"
              >
                Investigate <span aria-hidden="true" className="ml-1">→</span>
              </InvestigationLaunchLink>
            ) : null}
          </article>
        </div>
      </div>
    </section>
  );
}
