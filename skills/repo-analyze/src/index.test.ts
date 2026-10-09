import { describe, expect, it, vi } from "vitest";
import type { RepositoryAnalyzer } from "@devscope/ai";
import { analyzeFetchedRepository } from "./index.js";

const fetched = {
  repository: { owner: "acme", name: "demo", url: "https://github.com/acme/demo", description: "demo", primary_language: "TypeScript", stars: 10, forks: 2, open_issues: 1, archived: false, recent_commits_30d: 2, active_contributors_30d: 1, opened_issues_30d: 2, closed_issues_30d: 1, pushed_at: null, captured_at: "2026-01-01T00:00:00Z" },
  readme: "README",
  issues: [{ number: 1, title: "done", state: "closed", url: "https://github.com/acme/demo/issues/1", created_at: "2026-01-01", closed_at: "2026-01-02" }, { number: 2, title: "open", state: "open", url: "https://github.com/acme/demo/issues/2", created_at: "2026-01-01", closed_at: null }],
  commits: [{ sha: "abc", message: "feat", author: "dev", committed_at: "2026-01-01", url: "https://github.com/acme/demo/commit/abc" }],
  options: { include_issues: true, include_commits: true },
};
const output = { health_score: 80, activity_level: "high" as const, key_metrics: { stars_growth_rate: 0, issue_resolution_rate: 0.5, contributor_diversity: 10 }, risk_factors: [], opportunities: ["growth"], recommendation: "invest" as const };

describe("repo-analyze", () => {
  it("converts fetched data into the analyzer contract", async () => {
    const analyzer: RepositoryAnalyzer = { analyze: vi.fn().mockResolvedValue(output) };
    await expect(analyzeFetchedRepository(analyzer, fetched)).resolves.toMatchObject({ repository: "acme/demo", analysis: output });
    expect(analyzer.analyze).toHaveBeenCalledWith(expect.objectContaining({ metrics: expect.objectContaining({ issue_resolution_rate: 0.5, active_contributors_90d: 1 }) }));
  });

  it("rejects invalid pipeline JSON before calling the model", async () => {
    const analyzer: RepositoryAnalyzer = { analyze: vi.fn() };
    await expect(analyzeFetchedRepository(analyzer, {})).rejects.toThrow();
    expect(analyzer.analyze).not.toHaveBeenCalled();
  });

  it("handles fetch output without optional collections", async () => {
    const analyzer: RepositoryAnalyzer = { analyze: vi.fn().mockResolvedValue(output) };
    const minimal = {
      ...fetched,
      repository: { ...fetched.repository, description: "", primary_language: "Unknown", active_contributors_30d: 2 },
      issues: [],
      commits: [],
      options: { include_issues: false, include_commits: false },
    };
    await analyzeFetchedRepository(analyzer, minimal);
    expect(analyzer.analyze).toHaveBeenCalledWith(expect.objectContaining({
      repository: expect.not.objectContaining({ description: expect.anything(), primary_language: expect.anything() }),
      metrics: expect.objectContaining({ issue_resolution_rate: 0, active_contributors_90d: 2, contributor_diversity: 20 }),
    }));
  });
});
