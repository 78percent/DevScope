import { describe, expect, it } from "vitest";
import { generateReport } from "./index.js";

const analyzed = { repository: "acme/demo", fetched_at: "2026-01-01T00:00:00Z", analysis: { health_score: 80, activity_level: "high", key_metrics: { stars_growth_rate: 0, issue_resolution_rate: 0.5, contributor_diversity: 10 }, risk_factors: ["risk <one>"], opportunities: ["growth"], recommendation: "invest" } };

describe("report-generate", () => {
  it("renders all report templates as markdown", () => {
    expect(generateReport(analyzed, "daily", "markdown").content).toContain("每日健康报告");
    expect(generateReport(analyzed, "weekly", "markdown").content).toContain("每周健康报告");
    expect(generateReport(analyzed, "investment", "markdown").content).toContain("技术投资评估");
  });

  it("renders escaped HTML", () => {
    const report = generateReport(analyzed, "investment", "html");
    expect(report.content).toContain("<h1>");
    expect(report.content).toContain("risk &lt;one&gt;");
  });

  it("rejects invalid pipeline input", () => {
    expect(() => generateReport({}, "daily", "markdown")).toThrow();
  });
});
