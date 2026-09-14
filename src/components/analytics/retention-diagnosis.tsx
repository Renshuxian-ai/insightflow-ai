import type { DemoAnalyticsResult } from "@/lib/analytics/demo-analytics";

import { AnalyticsSectionHeader } from "./analytics-page-frame";

type RetentionDiagnosisData = DemoAnalyticsResult["retention"]["diagnosis"];
type RetentionBreakdowns =
  DemoAnalyticsResult["retention"]["breakdowns"];
type RetentionBreakdownSegment = RetentionBreakdowns["platform"][number];

type DimensionSignal = {
  dimension: string;
  worstSegment: RetentionBreakdownSegment;
  bestSegment: RetentionBreakdownSegment;
  d7Gap: number;
  impactScore: number;
};

function formatUsers(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
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

function analyzeBreakdownDimensions(breakdowns: RetentionBreakdowns) {
  const breakdownGroups = [
    { label: "Platform", segments: breakdowns.platform },
    { label: "User type", segments: breakdowns.userType },
  ];
  const signals: DimensionSignal[] = breakdownGroups.flatMap((group) => {
    const comparableSegments = group.segments.filter(
      (segment) =>
        Number.isFinite(segment.D1) &&
        Number.isFinite(segment.D7) &&
        Number.isFinite(segment.D30) &&
        Number.isFinite(segment.users),
    );

    if (comparableSegments.length < 2) {
      return [];
    }

    const bestSegment = comparableSegments.reduce((best, segment) =>
      segment.D7 > best.D7 ? segment : best,
    );
    const worstSegment = comparableSegments.reduce((worst, segment) =>
      segment.D7 < worst.D7 ? segment : worst,
    );
    const d7Gap = worstSegment.D7 - bestSegment.D7;

    return d7Gap < 0
      ? [
          {
            dimension: group.label,
            worstSegment,
            bestSegment,
            d7Gap,
            impactScore: worstSegment.users * Math.abs(d7Gap),
          },
        ]
      : [];
  });

  return signals.sort((left, right) => right.impactScore - left.impactScore);
}

export function RetentionDiagnosis({
  diagnosis,
  breakdowns,
}: {
  diagnosis: RetentionDiagnosisData;
  breakdowns: RetentionBreakdowns;
}) {
  const dimensionSignals = analyzeBreakdownDimensions(breakdowns);
  const primarySignal = dimensionSignals[0] ?? null;
  const allSegmentNames = [
    ...breakdowns.platform.map((segment) => segment.name),
    ...breakdowns.userType.map((segment) => segment.name),
  ];
  const investigationDirections = primarySignal
    ? diagnosis.recommendation.map((direction) => {
        const fixedSegmentName = allSegmentNames.find((name) =>
          direction.includes(name),
        );

        return fixedSegmentName
          ? direction.replace(fixedSegmentName, primarySignal.worstSegment.name)
          : direction;
      })
    : [];
  const interpretation = primarySignal
    ? `${primarySignal.worstSegment.name} retention is lower than baseline and requires investigation.`
    : "Insufficient segment evidence";

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
              {interpretation}
            </p>
          </div>
          {primarySignal ? (
            <span className="w-fit rounded-md bg-[#fff6e4] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-[#8a5b00]">
              {diagnosis.severity} priority
            </span>
          ) : null}
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
              {primarySignal ? (
                <>
                  <div
                    className="rounded-lg bg-white px-3 py-2.5"
                  >
                    <p className="text-[11px] text-[#7e8798]">
                      D7 Retention · {primarySignal.worstSegment.name}
                    </p>
                    <div className="mt-1 flex items-baseline justify-between gap-3">
                      <p className="text-sm font-semibold text-[#344056]">
                        {primarySignal.worstSegment.D7}%
                      </p>
                      <p className="text-[11px] font-semibold text-[#bd3f3f]">
                        {primarySignal.d7Gap.toFixed(0)} pp vs. {primarySignal.bestSegment.name} {primarySignal.bestSegment.D7}%
                      </p>
                    </div>
                  </div>
                  <div className="rounded-lg bg-white px-3 py-2.5">
                    <p className="text-[11px] text-[#7e8798]">
                      Affected users · {primarySignal.worstSegment.name}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[#344056]">
                      {formatUsers(primarySignal.worstSegment.users)}
                    </p>
                  </div>
                </>
              ) : (
                <p className="rounded-lg bg-white px-3 py-2.5 text-[11px] text-[#7e8798]">
                  Insufficient segment evidence
                </p>
              )}
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
              {primarySignal ? (
                dimensionSignals.map((signal, index) => (
                  <div
                    key={signal.dimension}
                    className={`rounded-lg px-3 py-2.5 ${
                      index === 0 ? "bg-[#fff4f4]" : "bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] text-[#8a94a6]">
                          {index === 0 ? "Primary issue" : "Secondary signal"} · {signal.dimension}
                        </p>
                        <p className="mt-0.5 text-[13px] font-semibold text-[#344056]">
                          {signal.worstSegment.name}
                        </p>
                      </div>
                      <p className="text-right text-[11px] font-semibold text-[#bd3f3f]">
                        {signal.d7Gap.toFixed(0)} pp D7 gap
                      </p>
                    </div>
                    <p className="mt-2 text-[10px] text-[#8a94a6]">
                      Compared with {signal.bestSegment.name} at {signal.bestSegment.D7}%
                    </p>
                    <div className="mt-3 grid grid-cols-4 gap-2 text-[10px] text-[#7e8798]">
                      <p>
                        <span className="block font-semibold text-[#4e5a70]">
                          {formatUsers(signal.worstSegment.users)}
                        </span>
                        Users
                      </p>
                      <p>
                        <span className="block font-semibold text-[#4e5a70]">
                          {signal.worstSegment.D1}%
                        </span>
                        D1
                      </p>
                      <p>
                        <span className="block font-semibold text-[#bd3f3f]">
                          {signal.worstSegment.D7}%
                        </span>
                        D7
                      </p>
                      <p>
                        <span className="block font-semibold text-[#4e5a70]">
                          {signal.worstSegment.D30}%
                        </span>
                        D30
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="rounded-lg bg-white px-3 py-2.5 text-[11px] text-[#7e8798]">
                  Insufficient segment evidence
                </p>
              )}
            </div>
          </article>

          <article className="rounded-lg border border-[#e7eaf0] bg-[#fafbfc] p-4">
            <div className="flex flex-col items-start gap-2">
              <h3 className="text-[13px] font-semibold text-[#344056]">
                Next investigation
              </h3>
              <EvidenceBadge label="Inference" />
            </div>
            <ul className="mt-3 space-y-2">
              {primarySignal ? (
                investigationDirections.map((direction) => (
                  <li
                    key={direction}
                    className="rounded-lg border border-[#eef0f4] bg-white px-3 py-2.5"
                  >
                    <p className="text-[9px] font-semibold uppercase tracking-[0.07em] text-[#8a94a6]">
                      Suggested check
                    </p>
                    <p className="mt-1.5 text-[11px] leading-4 text-[#5f6b7e]">
                      {direction}
                    </p>
                    <span className="mt-2 inline-flex rounded-md bg-[#f1f3f6] px-1.5 py-0.5 text-[9px] font-semibold text-[#8a94a6]">
                      Not analyzed yet
                    </span>
                  </li>
                ))
              ) : (
                <li className="rounded-lg border border-[#eef0f4] bg-white px-3 py-2.5 text-[11px] text-[#7e8798]">
                  Insufficient segment evidence
                </li>
              )}
            </ul>
            <p className="mt-3 text-[10px] leading-4 text-[#98a1b1]">
              Suggested checks are directions to validate, not conclusions.
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}
