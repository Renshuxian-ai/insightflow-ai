"use client";

import { useEffect, useState } from "react";

import {
  AnalyticsPageFrame,
  AnalyticsStatus,
} from "@/components/analytics/analytics-page-frame";
import { FunnelsPage } from "@/components/analytics/funnels-page";
import { RetentionPage } from "@/components/analytics/retention-page";
import { TrendsPage } from "@/components/analytics/trends-page";
import {
  buildDemoAnalyticsResult,
  type DemoAnalyticsResult,
} from "@/lib/analytics/demo-analytics";
import { loadDemoDiagnosticDataset } from "@/lib/diagnostics/demo-dataset/demo-dataset-adapter";

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
    description: "Loading metric trends and anomaly signals from the demo dataset.",
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
    if (page === "funnels") {
      return <FunnelsPage analytics={state.analytics} />;
    }

    if (page === "retention") {
      return <RetentionPage analytics={state.analytics} />;
    }

    return <TrendsPage analytics={state.analytics} />;
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
