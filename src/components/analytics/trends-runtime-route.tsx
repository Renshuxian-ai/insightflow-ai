"use client";

import { useDatasetWorkspaceSession } from "@/components/datasets/dataset-workspace-session";

import { AnalyticsPageFrame, AnalyticsStatus } from "./analytics-page-frame";
import { DemoAnalyticsRoute } from "./demo-analytics-route";
import { TrendsPage } from "./trends-page";

const DESCRIPTION =
  "See where product metrics changed, then move supported signals into diagnosis.";

export function TrendsRuntimeRoute() {
  const { datasetMode, overviewRuntime, overviewStatus, overviewError } =
    useDatasetWorkspaceSession();

  if (!datasetMode) {
    return <DemoAnalyticsRoute page="trends" />;
  }

  const runtime = overviewRuntime?.trends ?? null;

  if (overviewStatus === "ready" && runtime?.status === "available") {
    return <TrendsPage runtime={runtime} />;
  }

  const loading = overviewStatus === "loading";
  const description = runtime?.status === "unavailable"
    ? runtime.reason
    : overviewError ??
      "Trend evidence is not available for the current uploaded dataset.";

  return (
    <AnalyticsPageFrame
      title="Trends"
      description={DESCRIPTION}
      sourceLabel="UPLOADED DATASET"
    >
      <AnalyticsStatus
        loading={loading}
        title={loading ? "Preparing trends..." : "Trends unavailable"}
        description={description}
      />
    </AnalyticsPageFrame>
  );
}
