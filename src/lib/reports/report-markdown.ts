import type { ProductReport } from "./mock-reports";

export function buildProductReportMarkdown(report: ProductReport) {
  const findings = report.keyFindings
    .map((finding) => `- ${finding}`)
    .join("\n");
  const actions = report.recommendedActions
    .map(
      (action) =>
        `${action.priority}. **${action.title}**\n   ${action.description}`,
    )
    .join("\n");
  const evidence = report.supportingEvidence
    .map((item) => {
      const metadata = [
        item.sourceType && item.sourceId
          ? `source=${item.sourceType}:${item.sourceId}`
          : null,
        item.provenance ? `provenance=${item.provenance}` : null,
        item.evidenceQuality ? `quality=${item.evidenceQuality}` : null,
      ].filter(Boolean);

      return `- **${item.type}:** ${item.statement}${metadata.length > 0 ? ` (${metadata.join(", ")})` : ""}`;
    })
    .join("\n");
  const limitations = (report.limitations ?? [])
    .map((limitation) => `- ${limitation}`)
    .join("\n");

  return [
    `# ${report.title}`,
    "",
    `- Source: ${report.source}`,
    `- Status: ${report.status}`,
    `- Created: ${report.createdAt}`,
    `- Updated: ${report.updatedAt}`,
    "",
    "## AI Summary",
    "",
    report.aiSummary,
    "",
    "_AI-generated summary based on investigation evidence. This is not a causal conclusion._",
    "",
    "## Key Findings",
    "",
    findings,
    "",
    "## Next Steps",
    "",
    actions,
    "",
    "_Next steps are based on validated evidence, not guaranteed solutions._",
    "",
    "## Supporting Evidence",
    "",
    evidence,
    "",
    "## Limitations",
    "",
    limitations || "- No additional limitations were recorded.",
    "",
  ].join("\n");
}
