import { notFound } from "next/navigation";

import { DiagnosticsPage } from "@/components/diagnostics/diagnostics-page";
import { AppShell } from "@/components/layout/app-shell";
import { diagnosticCases, getDiagnosticCase } from "@/lib/diagnostics-mock-data";

type AiDiagnosticsPageProps = {
  params: Promise<{ anomalyId: string }>;
};

export function generateStaticParams() {
  return Object.keys(diagnosticCases).map((anomalyId) => ({ anomalyId }));
}

export default async function AiDiagnosticsRoute({ params }: AiDiagnosticsPageProps) {
  const { anomalyId } = await params;
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
