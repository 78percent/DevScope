import { GeneratedReportSchema, ReportFormatSchema, ReportTemplateSchema, RepoAnalyzeResultSchema, type GeneratedReport, type ReportFormat, type ReportTemplate } from "@devscope/shared";

export function generateReport(value: unknown, template: ReportTemplate, format: ReportFormat): GeneratedReport {
  const input = RepoAnalyzeResultSchema.parse(value);
  const checkedTemplate = ReportTemplateSchema.parse(template);
  const checkedFormat = ReportFormatSchema.parse(format);
  const markdown = renderMarkdown(input, checkedTemplate);
  return GeneratedReportSchema.parse({
    repository: input.repository,
    template: checkedTemplate,
    format: checkedFormat,
    content: checkedFormat === "markdown" ? markdown : markdownToHtml(markdown),
    generated_at: new Date().toISOString(),
  });
}

function renderMarkdown(input: ReturnType<typeof RepoAnalyzeResultSchema.parse>, template: ReportTemplate): string {
  const title = template === "daily" ? "每日健康报告" : template === "weekly" ? "每周健康报告" : "技术投资评估";
  const analysis = input.analysis;
  return [
    `# ${title}：${input.repository}`,
    "",
    `- 健康分：${analysis.health_score}/100`,
    `- 活跃度：${analysis.activity_level}`,
    `- 建议：${analysis.recommendation}`,
    "",
    "## 风险",
    analysis.risk_factors.length > 0 ? analysis.risk_factors.map((item) => `- ${item}`).join("\n") : "- 暂未识别明显风险",
    "",
    "## 机会",
    analysis.opportunities.map((item) => `- ${item}`).join("\n"),
  ].join("\n");
}

function markdownToHtml(markdown: string): string {
  return markdown.split("\n").map((line) => {
    const escaped = line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    if (escaped.startsWith("# ")) return `<h1>${escaped.slice(2)}</h1>`;
    if (escaped.startsWith("## ")) return `<h2>${escaped.slice(3)}</h2>`;
    if (escaped.startsWith("- ")) return `<li>${escaped.slice(2)}</li>`;
    return escaped ? `<p>${escaped}</p>` : "";
  }).filter(Boolean).join("\n");
}
