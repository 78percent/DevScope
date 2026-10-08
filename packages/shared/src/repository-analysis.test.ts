import { describe, expect, it } from "vitest";
import { parseRepositoryAnalysis, parseRepositoryAnalysisInput } from "./repository-analysis.js";

const validInput = {
  repository: { owner: "vercel", name: "next.js", url: "https://github.com/vercel/next.js", description: "The React Framework for the Web", primary_language: "TypeScript", stars: 130_000, forks: 28_000, open_issues: 2_000, archived: false },
  metrics: { stars_growth_rate: 0.0125, issue_resolution_rate: 0.72, active_contributors_90d: 180, contributor_diversity: 88 },
};

const validAnalysis = {
  health_score: 86,
  activity_level: "high",
  key_metrics: { stars_growth_rate: 0.0125, issue_resolution_rate: 0.72, contributor_diversity: 88 },
  risk_factors: ["Large issue backlog"],
  opportunities: ["Strong contributor activity"],
  recommendation: "invest",
};

describe("RepositoryAnalysisInputSchema", () => {
  it("accepts a complete repository snapshot", () => expect(parseRepositoryAnalysisInput(validInput)).toEqual(validInput));
  it("rejects a ratio outside 0..1", () => {
    const invalid = structuredClone(validInput);
    invalid.metrics.issue_resolution_rate = 1.01;
    expect(() => parseRepositoryAnalysisInput(invalid)).toThrow();
  });
  it("rejects negative repository counters", () => {
    const invalid = structuredClone(validInput);
    invalid.repository.stars = -1;
    expect(() => parseRepositoryAnalysisInput(invalid)).toThrow();
  });
});

describe("RepositoryAnalysisSchema", () => {
  it.each([0, 100])("accepts health_score boundary %s", (health_score) => expect(parseRepositoryAnalysis({ ...validAnalysis, health_score }).health_score).toBe(health_score));
  it.each([-1, 101, 1.5])("rejects invalid health_score %s", (health_score) => expect(() => parseRepositoryAnalysis({ ...validAnalysis, health_score })).toThrow());
  it.each(["unknown", "HIGH", "active"])("rejects activity_level %s", (activity_level) => expect(() => parseRepositoryAnalysis({ ...validAnalysis, activity_level })).toThrow());
  it.each(["buy", "sell", "hold"])("rejects recommendation %s", (recommendation) => expect(() => parseRepositoryAnalysis({ ...validAnalysis, recommendation })).toThrow());
  it("rejects undeclared fields", () => expect(() => parseRepositoryAnalysis({ ...validAnalysis, unexpected: true })).toThrow());
});
