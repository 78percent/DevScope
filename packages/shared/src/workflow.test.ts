import { describe, expect, it } from "vitest";
import { parseRepositoryReference, QuickAssessmentReportSchema, WorkflowRunSchema } from "./workflow.js";

describe("workflow contracts", () => {
  it("accepts owner/repo and GitHub URLs", () => {
    expect(parseRepositoryReference("acme/demo")).toEqual({ owner: "acme", name: "demo" });
    expect(parseRepositoryReference("https://github.com/acme/demo.git/")).toEqual({ owner: "acme", name: "demo" });
  });

  it("rejects unsupported repository references", () => {
    expect(() => parseRepositoryReference("demo")).toThrow("owner/repo");
  });

  it("validates workflow runs and quick assessment reports", () => {
    const health = { health_score: 80, activity_level: "high", key_metrics: { stars_growth_rate: 0, issue_resolution_rate: 0.5, contributor_diversity: 40 }, risk_factors: [], opportunities: ["growth"], recommendation: "invest" };
    expect(QuickAssessmentReportSchema.parse({ repository: "acme/demo", generated_at: new Date().toISOString(), code_quality: { score: 80, summary: "good" }, community: { score: 70, summary: "active" }, competitors: [], health, executive_summary: "summary" }).health.health_score).toBe(80);
    expect(WorkflowRunSchema.parse({ id: 1, type: "quick_assessment", status: "pending", input: {}, output: null, error: null, created_at: new Date().toISOString(), started_at: null, completed_at: null, steps: [] }).status).toBe("pending");
  });
});
