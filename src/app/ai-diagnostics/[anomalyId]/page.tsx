import { notFound } from "next/navigation";

import { DemoDatasetDiagnosticsRoute } from "@/components/datasets/demo-dataset-diagnostics-route";
import { DatasetDiagnosticsRoute } from "@/components/diagnostics/dataset-diagnostics-route";
import { DiagnosticsPage } from "@/components/diagnostics/diagnostics-page";
import { AppShell } from "@/components/layout/app-shell";
import { DATASET_PRIMARY_ANOMALY_ID } from "@/lib/diagnostics/dataset-diagnostic-case";
import {
  diagnosticCases,
  getDiagnosticCase,
  primaryDiagnosticCase,
} from "@/lib/diagnostics-mock-data";

type AiDiagnosticsPageProps = {
  params: Promise<{ anomalyId: string }>;
};

export function generateStaticParams() {
  return Object.keys(diagnosticCases).map((anomalyId) => ({ anomalyId }));
}

export default async function AiDiagnosticsRoute({ params }: AiDiagnosticsPageProps) {
  const { anomalyId } = await params;

  if (anomalyId === DATASET_PRIMARY_ANOMALY_ID) {
    return (
      <AppShell activeNavigation="ai-diagnostics">
        <DatasetDiagnosticsRoute />
      </AppShell>
    );
  }

  if (anomalyId === primaryDiagnosticCase.id) {
    return (
      <AppShell activeNavigation="ai-diagnostics">
        <DemoDatasetDiagnosticsRoute />
      </AppShell>
    );
  }

  const diagnosticCase = getDiagnosticCase(anomalyId);

  if (!diagnosticCase) {
    notFound();
  }

  return (
    <AppShell activeNavigation="ai-diagnostics">
      <DiagnosticsPage diagnosticCase={diagnosticCase} />
    </AppShell>
  );
}
