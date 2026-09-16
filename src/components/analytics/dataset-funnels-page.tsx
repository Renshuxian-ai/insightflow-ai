import Link from "next/link";

import type {
  FunnelRuntime,
  FunnelRuntimeTransition,
} from "@/lib/analytics/analytics-runtime";
import { buildAnalyticsInvestigationHref } from "@/lib/analytics/investigation-context";

import {
  AnalyticsMetricGroup,
  AnalyticsPageFrame,
  AnalyticsSectionHeader,
} from "./analytics-page-frame";
import { FunnelJourneyTrack } from "./funnel-journey-track";

type AvailableFunnelRuntime = Extract<FunnelRuntime, { status: "available" }>;

type OrderedJourney = {
  transitions: FunnelRuntimeTransition[];
  isLinearJourney: boolean;
};

function stepKey(value: string) {
  return value.trim().toLocaleLowerCase("en-US");
}

function orderJourneyTransitions(
  transitions: FunnelRuntimeTransition[],
): OrderedJourney {
  const stableFallback = [...transitions];

  if (transitions.length <= 1) {
    return { transitions: stableFallback, isLinearJourney: true };
  }

  const outgoingByStep = new Map<string, number[]>();
  const destinationSteps = new Set<string>();

  transitions.forEach((transition, index) => {
    const fromStep = stepKey(transition.fromStep);
    const toStep = stepKey(transition.toStep);
    const outgoing = outgoingByStep.get(fromStep) ?? [];

    outgoing.push(index);
    outgoingByStep.set(fromStep, outgoing);
    destinationSteps.add(toStep);
  });

  if ([...outgoingByStep.values()].some((outgoing) => outgoing.length > 1)) {
    return { transitions: stableFallback, isLinearJourney: false };
  }

  const startIndexes = transitions.flatMap((transition, index) =>
    destinationSteps.has(stepKey(transition.fromStep)) ? [] : [index],
  );

  if (startIndexes.length !== 1) {
    return { transitions: stableFallback, isLinearJourney: false };
  }

  const ordered: FunnelRuntimeTransition[] = [];
  const visitedIndexes = new Set<number>();
  let currentIndex: number | undefined = startIndexes[0];

  while (currentIndex !== undefined) {
    if (visitedIndexes.has(currentIndex)) {
      return { transitions: stableFallback, isLinearJourney: false };
    }

    visitedIndexes.add(currentIndex);
    const current: FunnelRuntimeTransition = transitions[currentIndex]!;
    ordered.push(current);

    const nextIndexes: number[] =
      outgoingByStep.get(stepKey(current.toStep)) ?? [];

    if (nextIndexes.length > 1) {
      return { transitions: stableFallback, isLinearJourney: false };
    }

    currentIndex = nextIndexes[0];
  }

  if (ordered.length !== transitions.length) {
    return { transitions: stableFallback, isLinearJourney: false };
  }

  return { transitions: ordered, isLinearJourney: true };
}

function formatPercentage(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatDelta(value: number | null) {
  if (value === null) {
    return "Unavailable";
  }

  return `${value > 0 ? "+" : ""}${value.toFixed(1)} pp`;
}

function investigationHref(runtime: AvailableFunnelRuntime) {
  const transition = runtime.transitions.find(
    (candidate) => candidate.id === runtime.primaryTransitionId,
  );
  const context = transition?.investigationContext;

  return context
    ? buildAnalyticsInvestigationHref(
        `/ai-diagnostics/${encodeURIComponent(context.signalId)}`,
        context,
        { returnTo: "/analytics/funnels" },
      )
    : null;
}

export function DatasetFunnelsPage({
  runtime,
}: {
  runtime: AvailableFunnelRuntime;
}) {
  const primary = runtime.transitions.find(
    (transition) => transition.id === runtime.primaryTransitionId,
  ) ?? runtime.transitions[0]!;
  const href = investigationHref(runtime);
  const journey = orderJourneyTransitions(runtime.transitions);

  return (
    <AnalyticsPageFrame
      title="Funnels"
      description="Inspect observed funnel transitions and locate where users drop away."
      sourceLabel="UPLOADED DATASET"
    >
      <section className="mt-6" aria-labelledby="primary-funnel-signal-title">
        <AnalyticsSectionHeader
          title="Primary funnel signal"
          meta="Largest observed drop-off"
        />
        <article className="rounded-xl border border-[#e7eaf0] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.02)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <span className="inline-flex rounded-md bg-[#fff0f0] px-1.5 py-0.5 text-[10px] font-bold tracking-[0.08em] text-[#c44242]">
                OBSERVED DROP-OFF
              </span>
              <h2
                id="primary-funnel-signal-title"
                className="mt-2 text-lg font-semibold tracking-[-0.03em] text-[#172033]"
              >
                {primary.fromStep} → {primary.toStep}
              </h2>
              <p className="mt-1 text-[13px] text-[#778196]">
                {primary.funnelName} · {primary.observedRows} observed rows
              </p>
            </div>
            {href ? (
              <Link
                href={href}
                className="inline-flex h-9 items-center rounded-lg bg-[#3559e8] px-3.5 text-xs font-semibold text-white transition-colors hover:bg-[#2446cb]"
              >
                Investigate <span aria-hidden="true" className="ml-1">→</span>
              </Link>
            ) : (
              <span className="rounded-md bg-[#f1f3f6] px-2 py-1 text-[10px] font-bold tracking-[0.08em] text-[#687387]">
                COMPARISON UNAVAILABLE
              </span>
            )}
          </div>
          <div className="mt-4">
            <AnalyticsMetricGroup
              ariaLabel="Primary funnel transition evidence"
              items={[
                {
                  label: "Completion rate",
                  value: formatPercentage(primary.completionRate),
                  detail: "Observed transition completion",
                  tone: "primary",
                },
                {
                  label: "Drop-off users",
                  value: primary.dropOffUsers.toLocaleString("en-US"),
                  detail: "Estimated from observed users and completion rate",
                  tone: "negative",
                },
                {
                  label: "Version change",
                  value: formatDelta(primary.gapPercentagePoints),
                  detail:
                    primary.currentVersion && primary.baselineVersion
                      ? `${primary.baselineVersion.name} ${formatPercentage(primary.baselineVersion.completionRate)} → ${primary.currentVersion.name} ${formatPercentage(primary.currentVersion.completionRate)}`
                      : "No comparable versions in the dataset",
                  tone:
                    primary.gapPercentagePoints !== null &&
                    primary.gapPercentagePoints < 0
                      ? "negative"
                      : "default",
                },
              ]}
            />
          </div>
        </article>
      </section>

      <section className="mt-6 min-w-0" aria-labelledby="funnel-evidence-title">
        <AnalyticsSectionHeader
          title="Funnel evidence"
          meta={`${runtime.transitions.length} observed transitions`}
        />
        <div className="min-w-0 overflow-hidden rounded-xl border border-[#e7eaf0] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.02)]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2
                id="funnel-evidence-title"
                className="text-base font-semibold text-[#172033]"
              >
                {journey.isLinearJourney
                  ? "Dataset journey"
                  : "Observed transitions"}
              </h2>
              <p className="mt-1 text-xs text-[#98a1b1]">
                {journey.isLinearJourney
                  ? "Ordered from the observed from-step and to-step relationships."
                  : "A single path could not be verified, so transitions remain in stable observed order."}
              </p>
            </div>
            {!journey.isLinearJourney ? (
              <span className="w-fit rounded-md bg-[#f1f3f6] px-2 py-1 text-[10px] font-bold tracking-[0.08em] text-[#687387]">
                OBSERVED TRANSITIONS
              </span>
            ) : null}
          </div>
          <FunnelJourneyTrack
            transitions={journey.transitions}
            primaryTransitionId={runtime.primaryTransitionId}
          />
        </div>
      </section>
    </AnalyticsPageFrame>
  );
}
