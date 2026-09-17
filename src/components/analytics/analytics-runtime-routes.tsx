"use client";

import { useDatasetWorkspaceSession } from "@/components/datasets/dataset-workspace-session";
import { DatasetFeedbackPage } from "@/components/feedback/dataset-feedback-page";
import { FeedbackPage } from "@/components/feedback/feedback-page";

import { AnalyticsPageFrame, AnalyticsStatus } from "./analytics-page-frame";
import { DatasetFunnelsPage } from "./dataset-funnels-page";
import { DatasetRetentionPage } from "./dataset-retention-page";
import { DemoAnalyticsRoute } from "./demo-analytics-route";

function RuntimeUnavailable({
  title,
  description,
  loading,
}: {
  title: string;
  description: string;
  loading: boolean;
}) {
  return (
    <AnalyticsPageFrame
      title={title}
      description={`Dataset-backed ${title.toLocaleLowerCase("en-US")} evidence.`}
      sourceLabel="UPLOADED DATASET"
    >
      <AnalyticsStatus
        loading={loading}
        title={loading ? `Preparing ${title.toLocaleLowerCase("en-US")}...` : `${title} unavailable`}
        description={description}
      />
    </AnalyticsPageFrame>
  );
}

export function FunnelsRuntimeRoute() {
  const { datasetMode, overviewRuntime, overviewStatus, overviewError } =
    useDatasetWorkspaceSession();

  if (!datasetMode) {
    return <DemoAnalyticsRoute page="funnels" />;
  }

  const runtime = overviewRuntime?.analytics.funnel;

  if (overviewStatus === "ready" && runtime?.status === "available") {
    return <DatasetFunnelsPage runtime={runtime} />;
  }

  return (
    <RuntimeUnavailable
      title="Funnels"
      loading={overviewStatus === "loading"}
      description={
        runtime?.status === "unavailable"
          ? runtime.reason
          : overviewError ??
            "Confirm field understanding to prepare funnel transition evidence."
      }
    />
  );
}

export function RetentionRuntimeRoute() {
  const { datasetMode, overviewRuntime, overviewStatus, overviewError } =
    useDatasetWorkspaceSession();

  if (!datasetMode) {
    return <DemoAnalyticsRoute page="retention" />;
  }

  const runtime = overviewRuntime?.analytics.retention;

  if (overviewStatus === "ready" && runtime?.status === "available") {
    return <DatasetRetentionPage runtime={runtime} />;
  }

  return (
    <RuntimeUnavailable
      title="Retention"
      loading={overviewStatus === "loading"}
      description={
        runtime?.status === "unavailable"
          ? runtime.reason
          : overviewError ??
            "Confirm field understanding to prepare comparable retention evidence."
      }
    />
  );
}

export function FeedbackRuntimeRoute() {
  const { datasetMode, overviewRuntime, overviewStatus, overviewError } =
    useDatasetWorkspaceSession();

  if (!datasetMode) {
    return <FeedbackPage />;
  }

  const runtime = overviewRuntime?.analytics.feedback;

  if (overviewStatus === "ready" && runtime?.status === "available") {
    return <DatasetFeedbackPage runtime={runtime} />;
  }

  return (
    <RuntimeUnavailable
      title="Feedback"
      loading={overviewStatus === "loading"}
      description={
        runtime?.status === "unavailable"
          ? runtime.reason
          : overviewError ??
            "Confirm field understanding to prepare feedback topic evidence."
      }
    />
  );
}
