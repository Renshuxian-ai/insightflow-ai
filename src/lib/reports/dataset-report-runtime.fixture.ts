import "server-only";

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
  const demoScopedReports = reports.map(({ surface, report }) => {
    const demoReport = { ...report };
    delete demoReport.datasetIdentity;
    delete demoReport.investigationCaseId;
    return { surface, report: demoReport };
  });

  for (const { report } of demoScopedReports) {
    const savedSessionId = await saveSessionReport(report, sessionId);
    assertFixture(
      savedSessionId === sessionId,
      "the report store must retain the requested runtime session identity.",
    );
  }

  const library = await getSessionReports(sessionId);
  assertFixture(library.length === 3, "the session library must contain three reports.");
  const results = [];

  for (const { surface, report } of demoScopedReports) {
    const detail = await getSessionReport(sessionId, report.id);
    assertFixture(detail, `${surface} report detail must resolve from Redis.`);

    for (const routeId of [
      report.id,
      encodeURIComponent(report.id),
      encodeURIComponent(encodeURIComponent(report.id)),
    ]) {
      assertFixture(
        (await getSessionReportByRouteId(sessionId, routeId))?.id === report.id,
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

    results.push({
      surface,
      reportId: detail.id,
      libraryResolved: true,
      detailResolved: true,
      markdownSections: 5,
    });
  }

  const firstReport = demoScopedReports[0]?.report;
  assertFixture(firstReport, "a generated report is required.");
  const deleted = await deleteSessionReport(sessionId, firstReport.id);
  assertFixture(
    deleted.status === "ok" && deleted.report.id === firstReport.id,
    "exact report deletion must work.",
  );
  assertFixture(
    (await getSessionReports(sessionId)).length === library.length - 1,
    "deleting one report must preserve the remaining reports.",
  );

  return { sessionId, libraryCount: library.length, results };
}
