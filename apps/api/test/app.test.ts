import { afterEach, describe, expect, it } from "vitest";
import { MockRepositoryAnalyzer } from "@devscope/ai";
import { buildApp } from "../src/app.js";

const apps: Awaited<ReturnType<typeof buildApp>>[] = [];
afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())));

describe("Fastify application", () => {
  it("reports API and database health", async () => {
    const app = await buildApp({ analyzer: new MockRepositoryAnalyzer(), databaseReady: async () => true });
    apps.push(app);
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok", database: true });
  });

  it("can skip a database check in isolated tests", async () => {
    const app = await buildApp({ analyzer: new MockRepositoryAnalyzer() });
    apps.push(app);
    expect((await app.inject({ method: "GET", url: "/health" })).json()).toMatchObject({ database: "not-checked" });
  });

  it("serves the structured analysis mutation over HTTP", async () => {
    const app = await buildApp({ analyzer: new MockRepositoryAnalyzer() });
    apps.push(app);
    const response = await app.inject({
      method: "POST",
      url: "/trpc/analysis.analyzeRepository",
      headers: { "content-type": "application/json" },
      payload: {
        repository: { owner: "openai", name: "example", url: "https://github.com/openai/example", stars: 100, forks: 10, open_issues: 5, archived: false },
        metrics: { stars_growth_rate: 0.1, issue_resolution_rate: 0.8, active_contributors_90d: 12, contributor_diversity: 75 },
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().result.data).toMatchObject({ health_score: 82, recommendation: "invest" });
  });
});
