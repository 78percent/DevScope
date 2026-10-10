import { afterEach, describe, expect, it, vi } from "vitest";
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

  it("streams completed research events as SSE", async () => {
    const runId = "00000000-0000-4000-8000-000000000001";
    const event = { id: 0, run_id: runId, type: "completed" as const, message: "done", timestamp: "2026-01-01T00:00:00.000Z" };
    const research = {
      start: vi.fn(),
      get: vi.fn().mockReturnValue({ id: runId, topic: "Agent frameworks", status: "completed", events: [event], created_at: event.timestamp, completed_at: event.timestamp }),
      subscribe: vi.fn(),
    };
    const app = await buildApp({ analyzer: new MockRepositoryAnalyzer(), research });
    apps.push(app);
    const response = await app.inject({ method: "GET", url: `/agent/research/${runId}/events`, headers: { origin: "http://127.0.0.1:3000" } });
    expect(response.statusCode).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe("http://127.0.0.1:3000");
    expect(response.headers.vary).toContain("Origin");
    expect(response.body).toContain("event: completed");
    expect(response.body).toContain('"message":"done"');
    expect(research.subscribe).not.toHaveBeenCalled();
  });

  it("streams live research events and closes on a terminal event", async () => {
    const runId = "00000000-0000-4000-8000-000000000002";
    const started = { id: 0, run_id: runId, type: "phase" as const, message: "started", timestamp: "2026-01-01T00:00:00.000Z" };
    const completed = { ...started, id: 1, type: "completed" as const, message: "done" };
    const unsubscribe = vi.fn();
    const research = {
      start: vi.fn(),
      get: vi.fn().mockReturnValue({ id: runId, topic: "Agent frameworks", status: "running", events: [started], created_at: started.timestamp }),
      subscribe: vi.fn((_id: string, listener: (event: typeof completed) => void) => {
        queueMicrotask(() => listener(completed));
        return unsubscribe;
      }),
    };
    const app = await buildApp({ analyzer: new MockRepositoryAnalyzer(), research });
    apps.push(app);
    const response = await app.inject({ method: "GET", url: `/agent/research/${runId}/events` });
    expect(response.body).toContain("event: phase");
    expect(response.body).toContain("event: completed");
    expect(research.subscribe).toHaveBeenCalledWith(runId, expect.any(Function));
  });

  it("uses a dedicated SSE name for research failures", async () => {
    const runId = "00000000-0000-4000-8000-000000000003";
    const event = { id: 0, run_id: runId, type: "error" as const, message: "research failed", timestamp: "2026-01-01T00:00:00.000Z" };
    const research = {
      start: vi.fn(),
      get: vi.fn().mockReturnValue({ id: runId, topic: "Agent frameworks", status: "failed", events: [event], error: event.message, created_at: event.timestamp, completed_at: event.timestamp }),
      subscribe: vi.fn(),
    };
    const app = await buildApp({ analyzer: new MockRepositoryAnalyzer(), research });
    apps.push(app);
    const response = await app.inject({ method: "GET", url: `/agent/research/${runId}/events` });
    expect(response.body).toContain("event: research_error");
    expect(response.body).not.toContain("event: error\n");
  });

  it("returns 404 for an unknown research run", async () => {
    const app = await buildApp({ analyzer: new MockRepositoryAnalyzer() });
    apps.push(app);
    const response = await app.inject({ method: "GET", url: `/agent/research/${crypto.randomUUID()}/events` });
    expect(response.statusCode).toBe(404);
  });
});
