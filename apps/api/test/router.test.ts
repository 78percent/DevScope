import { describe, expect, it, vi } from "vitest";
import type { RepositoryAnalyzer } from "@devscope/ai";
import { appRouter } from "../src/router.js";

const input = {
  repository: { owner: "openai", name: "example", url: "https://github.com/openai/example", stars: 100, forks: 10, open_issues: 5, archived: false },
  metrics: { stars_growth_rate: 0.1, issue_resolution_rate: 0.8, active_contributors_90d: 12, contributor_diversity: 75 },
};
const output = {
  health_score: 90,
  activity_level: "high" as const,
  key_metrics: { stars_growth_rate: 0.1, issue_resolution_rate: 0.8, contributor_diversity: 75 },
  risk_factors: [],
  opportunities: ["Growing community"],
  recommendation: "invest" as const,
};

describe("analysis.analyzeRepository", () => {
  it("passes validated input to the analyzer", async () => {
    const analyzer: RepositoryAnalyzer = { analyze: vi.fn().mockResolvedValue(output) };
    await expect(appRouter.createCaller({ analyzer }).analysis.analyzeRepository(input)).resolves.toEqual(output);
    expect(analyzer.analyze).toHaveBeenCalledWith(input);
  });

  it("rejects invalid request data before calling AI", async () => {
    const analyzer: RepositoryAnalyzer = { analyze: vi.fn().mockResolvedValue(output) };
    await expect(appRouter.createCaller({ analyzer }).analysis.analyzeRepository({ ...input, metrics: { ...input.metrics, issue_resolution_rate: 2 } })).rejects.toThrow();
    expect(analyzer.analyze).not.toHaveBeenCalled();
  });

  it("rejects an invalid analyzer result", async () => {
    const analyzer = { analyze: vi.fn().mockResolvedValue({ ...output, health_score: 101 }) } as unknown as RepositoryAnalyzer;
    await expect(appRouter.createCaller({ analyzer }).analysis.analyzeRepository(input)).rejects.toThrow();
  });
});
