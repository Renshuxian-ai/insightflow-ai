import "server-only";

import {
  listDatasetInvestigations,
  reconcileDatasetInvestigationReports,
  saveDatasetInvestigationCase,
  updateDatasetInvestigation,
} from "@/lib/investigations/dataset-investigation-store";

import { buildProductReportMarkdown } from "./report-markdown";
import {
  deleteSessionReport,
  getSessionReport,
  getSessionReportByRouteId,
  getSessionReports,
  saveSessionReport,
} from "./session-report-store";
import { buildDatasetReportFixtureBundle } from "./investigation-report-builder.fixtures";

function assertFixture(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Dataset report runtime fixture failed: ${message}`);
  }
}

export async function runDatasetReportRuntimeFixture() {
  const { reports } = await buildDatasetReportFixtureBundle();
  const sessionId = "dataset-report-runtime-fixture-session";
  const investigationSessionId =
    "dataset-investigation-report-lifecycle-fixture-session";
  const datasetIdentity = "fixture-dataset-identity";

  for (const { report } of reports) {
    const savedSessionId = saveSessionReport(report, sessionId);

    assertFixture(
      savedSessionId === sessionId,
      "the report store must retain the requested runtime session identity.",
    );
  }

  const library = getSessionReports(sessionId);

  assertFixture(library.length === 3, "the session library must contain three reports.");

  const results = reports.map(({ surface, report }) => {
    const detail = getSessionReport(sessionId, report.id);

    assertFixture(detail, `${surface} report detail must resolve from the session store.`);
    for (const routeId of [
      report.id,
      encodeURIComponent(report.id),
      encodeURIComponent(encodeURIComponent(report.id)),
    ]) {
      assertFixture(
        getSessionReportByRouteId(sessionId, routeId)?.id === report.id,
        `${surface} report must resolve from raw and encoded route identities.`,
      );
    }

    const markdown = buildProductReportMarkdown(detail);

    for (const heading of [
      "## AI Summary",
      "## Key Findings",
      "## Next Steps",
      "## Supporting Evidence",
      "## Limitations",
    ]) {
      assertFixture(
        markdown.includes(heading),
        `${surface} Markdown must include ${heading}.`,
      );
    }

    assertFixture(
      markdown.includes(detail.aiSummary) &&
        detail.supportingEvidence.every((evidence) =>
          markdown.includes(evidence.statement),
        ),
      `${surface} detail and Markdown must consume the same ProductReport.`,
    );

    return {
      surface,
      reportId: detail.id,
      libraryResolved: true,
      detailResolved: true,
      markdownSections: 5,
    };
  });

  const retentionReport = reports.find(
    ({ surface }) => surface === "retention",
  )?.report;

  assertFixture(retentionReport, "the Retention report is required.");
  const retentionInvestigationCaseId = retentionReport.investigationCaseId;

  assertFixture(
    retentionInvestigationCaseId,
    "the Retention report must retain its Investigation case identity.",
  );
  const deletedReport = deleteSessionReport(sessionId, retentionReport.id);

  assertFixture(
    deletedReport?.id === retentionReport.id,
    "deleting one report must resolve that exact report.",
  );
  assertFixture(
    getSessionReports(sessionId).length === reports.length - 1 &&
      reports
        .filter(({ report }) => report.id !== retentionReport.id)
        .every(({ report }) => getSessionReport(sessionId, report.id)),
    "deleting one report must preserve every other Investigation report.",
  );

  saveSessionReport(retentionReport, sessionId);
  assertFixture(
    getSessionReports(sessionId).length === reports.length,
    "regenerating one report must restore it without replacing other reports.",
  );

  for (const { surface, diagnosticCase, report } of reports) {
    assertFixture(
      report.investigationCaseId,
      `${surface} report must have an Investigation case identity.`,
    );
    saveDatasetInvestigationCase({
      sessionId: investigationSessionId,
      investigationId: report.investigationCaseId,
      signalFingerprint: `fixture:${surface}`,
      datasetId: "fixture-dataset",
      datasetIdentity,
      sourceLabel: report.source,
      signalType: surface as "retention" | "funnel" | "feedback",
      diagnosticCase,
    });
    updateDatasetInvestigation({
      sessionId: investigationSessionId,
      investigationId: report.investigationCaseId,
      datasetIdentity,
      status: "Validated",
      reportId: report.id,
    });
  }

  reconcileDatasetInvestigationReports({
    sessionId: investigationSessionId,
    datasetIdentity,
    reports: getSessionReports(sessionId),
  });
  assertFixture(
    listDatasetInvestigations(investigationSessionId, datasetIdentity).every(
      (investigation) => investigation.status === "Validated",
    ),
    "all Dataset Investigations must remain Validated while their exact reports exist.",
  );

  deleteSessionReport(sessionId, retentionReport.id);
  reconcileDatasetInvestigationReports({
    sessionId: investigationSessionId,
    datasetIdentity,
    reports: getSessionReports(sessionId),
  });
  const investigationsAfterDeletion = listDatasetInvestigations(
    investigationSessionId,
    datasetIdentity,
  );

  assertFixture(
    investigationsAfterDeletion.find(
      (investigation) =>
        investigation.id === retentionInvestigationCaseId,
    )?.status === "Validation ready" &&
      investigationsAfterDeletion
        .filter(
          (investigation) =>
            investigation.id !== retentionInvestigationCaseId,
        )
        .every((investigation) => investigation.status === "Validated"),
    "removing one report must downgrade only its linked Investigation.",
  );

  saveSessionReport(retentionReport, sessionId);
  updateDatasetInvestigation({
    sessionId: investigationSessionId,
    investigationId: retentionInvestigationCaseId,
    datasetIdentity,
    status: "Validated",
    reportId: retentionReport.id,
  });
  reconcileDatasetInvestigationReports({
    sessionId: investigationSessionId,
    datasetIdentity,
    reports: getSessionReports(sessionId),
  });
  assertFixture(
    listDatasetInvestigations(investigationSessionId, datasetIdentity).every(
      (investigation) => investigation.status === "Validated",
    ),
    "regenerating one report must not change other Validated Investigations.",
  );

  return { sessionId, libraryCount: library.length, results };
}
