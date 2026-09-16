"use client";

import { useEffect, useState } from "react";

import {
  AnalyticsPageFrame,
  AnalyticsStatus,
} from "@/components/analytics/analytics-page-frame";
import { FunnelsPage } from "@/components/analytics/funnels-page";
import { RetentionPage } from "@/components/analytics/retention-page";
import {
  TrendsPage,
  type TrendsPageData,
} from "@/components/analytics/trends-page";
import {
  buildDemoAnalyticsResult,
  type DemoAnalyticsResult,
} from "@/lib/analytics/demo-analytics";
import type {
  TrendRuntimeMetric,
  TrendRuntimeSignal,
} from "@/lib/analytics/trend-runtime";
import { loadDemoDiagnosticDataset } from "@/lib/diagnostics/demo-dataset/demo-dataset-adapter";
import { withDiagnosticReturnTo } from "@/lib/diagnostics/diagnostic-navigation";

export type AnalyticsPageKind = "trends" | "funnels" | "retention";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; analytics: DemoAnalyticsResult }
  | { status: "error"; message: string };

const PAGE_COPY: Record<
  AnalyticsPageKind,
  { title: string; description: string }
> = {
  trends: {
    title: "Trends",
    description: "Loading product metrics from the demo dataset.",
  },
  funnels: {
    title: "Funnels",
    description: "Loading onboarding event progression from the demo dataset.",
  },
  retention: {
    title: "Retention",
    description: "Loading D1 cohort retention from the demo dataset.",
  },
};

function getDemoMetricSurface(label: string): TrendRuntimeMetric["surface"] {
  const normalizedLabel = label.trim().toLocaleLowerCase("en-US");

  if (normalizedLabel.includes("retention")) {
    return "retention";
  }

  if (normalizedLabel.includes("conversion")) {
    return "funnel";
  }

  return "activity";
}

function buildDemoTrendsPageData(analytics: DemoAnalyticsResult): {
  data: TrendsPageData;
  investigationHrefs: Record<string, string>;
} {
  const metrics: TrendRuntimeMetric[] = analytics.trends.metrics.map(
    (metric) => ({
      id: metric.id,
      surface: getDemoMetricSurface(metric.label),
      label: metric.label,
      unit: "percentage",
      points: metric.points.map((point) => ({
        label: point.date,
        value: point.value,
        context: point.segment,
      })),
      current: {
        label: metric.current.date,
        value: metric.current.value,
        context: metric.current.segment,
      },
      previous: metric.previous
        ? {
            label: metric.previous.date,
            value: metric.previous.value,
            context: metric.previous.segment,
          }
        : null,
      change: metric.change,
      changeType: "percentage-points",
      comparison: metric.previous
        ? `${metric.current.date} vs. ${metric.previous.date}`
        : null,
      contextLabel: metric.current.segment,
    }),
  );
  const metricByLabel = new Map(
    metrics.map((metric) => [metric.label, metric]),
  );
  const signals: TrendRuntimeSignal[] = analytics.trends.anomalies.map(
    (anomaly) => ({
      id: anomaly.id,
      metricId: metricByLabel.get(anomaly.metricLabel)?.id ?? anomaly.id,
      title: anomaly.title,
      direction: anomaly.change < 0 ? "decline" : "increase",
      current: anomaly.current,
      previous: anomaly.previous,
      change: anomaly.change,
      changeType: "percentage-points",
      unit: "percentage",
      comparison: anomaly.comparison,
      contextLabel:
        metricByLabel.get(anomaly.metricLabel)?.contextLabel ??
        "All available data",
      investigationContext: null,
    }),
  );

  return {
    data: {
      metrics,
      signals,
      unavailableEvidence: [],
    },
    investigationHrefs: Object.fromEntries(
      analytics.trends.anomalies.flatMap((anomaly) =>
        anomaly.investigateHref
          ? [
              [
                anomaly.id,
                withDiagnosticReturnTo(
                  anomaly.investigateHref,
                  "/analytics/trends",
                ),
              ] as const,
            ]
          : [],
      ),
    ),
  };
}

let cachedAnalytics: Promise<DemoAnalyticsResult> | null = null;

function loadAnalytics() {
  if (!cachedAnalytics) {
    cachedAnalytics = loadDemoDiagnosticDataset()
      .then(buildDemoAnalyticsResult)
      .catch((error) => {
        cachedAnalytics = null;
        throw error;
      });
  }

  return cachedAnalytics;
}

export function DemoAnalyticsRoute({ page }: { page: AnalyticsPageKind }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const copy = PAGE_COPY[page];

  useEffect(() => {
    let isCurrent = true;

    void loadAnalytics()
      .then((analytics) => {
        if (isCurrent) {
          setState({ status: "ready", analytics });
        }
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          setState({
            status: "error",
            message:
              error instanceof Error
                ? error.message
                : "The demo analytics datasets could not be processed.",
          });
        }
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  if (state.status === "ready") {
    if (page === "trends") {
      const demoTrends = buildDemoTrendsPageData(state.analytics);

      return (
        <TrendsPage
          runtime={demoTrends.data}
          mode="demo"
          investigationHrefs={demoTrends.investigationHrefs}
        />
      );
    }

    return page === "funnels" ? (
      <FunnelsPage analytics={state.analytics} />
    ) : (
      <RetentionPage analytics={state.analytics} />
    );
  }

  return (
    <AnalyticsPageFrame title={copy.title} description={copy.description}>
      <AnalyticsStatus
        loading={state.status === "loading"}
        title={
          state.status === "loading"
            ? "Preparing analytics..."
            : "Analytics unavailable"
        }
        description={
          state.status === "loading"
            ? "Parsing metrics.csv, events.csv, and users.csv."
            : state.message
        }
      />
    </AnalyticsPageFrame>
  );
}
