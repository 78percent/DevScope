import { describe, expect, it } from "vitest";
import { GeneratedReportSchema, HealthTrendInputSchema, RepoFetchResultSchema } from "./cli-skill.js";

const repository = {
  owner: "acme", name: "demo", url: "https://github.com/acme/demo", description: "demo", primary_language: "TypeScript",
  stars: 10, forks: 2, open_issues: 1, archived: false, recent_commits_30d: 2, active_contributors_30d: 1,
  opened_issues_30d: 1, closed_issues_30d: 1, pushed_at: null, captured_at: new Date().toISOString(),
};

describe("CLI skill contracts", () => {
  it("applies safe fetch and trend defaults", () => {
    expect(RepoFetchResultSchema.parse({ repository, readme: "README", issues: [], commits: [], options: {} }).options)
      .toEqual({ include_issues: false, include_commits: false });
    expect(HealthTrendInputSchema.parse({})).toEqual({ days: 30 });
  });

  it("rejects unsupported report templates", () => {
    expect(() => GeneratedReportSchema.parse({ repository: "acme/demo", template: "unknown", format: "markdown", content: "report", generated_at: new Date().toISOString() })).toThrow();
  });
});
