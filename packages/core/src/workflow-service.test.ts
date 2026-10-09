import { describe, expect, it } from "vitest";
import type { RepositoryAnalyzer } from "@devscope/ai";
import type { WorkflowStore } from "@devscope/db";
import type { RepositoryAnalysis, RepositorySnapshot, RepositoryTarget, WorkflowRun, WorkflowType } from "@devscope/shared";
import type { RepositorySourceCollector, WorkflowRepositorySource } from "@devscope/sources";
import { DefaultWorkflowService } from "./workflow-service.js";

const analysis: RepositoryAnalysis = {
  health_score: 84,
  activity_level: "high",
  key_metrics: { stars_growth_rate: 0, issue_resolution_rate: 0.5, contributor_diversity: 30 },
  risk_factors: ["依赖少数维护者"],
  opportunities: ["扩大社区"],
  recommendation: "invest",
};

class MemoryWorkflowStore implements WorkflowStore {
  public runs = new Map<number, WorkflowRun>();
  public watchlist: RepositoryTarget[] = [];
  public snapshots = new Map<string, RepositorySnapshot>();
  private nextId = 1;

  public async createRun(type: WorkflowType, input: unknown, steps: Array<{ key: string; label: string }>) {
    const id = this.nextId++;
    this.runs.set(id, { id, type, input, status: "pending", output: null, error: null, created_at: new Date().toISOString(), started_at: null, completed_at: null, steps: steps.map((step) => ({ ...step, status: "pending", attempt: 0, output: null, error: null, started_at: null, completed_at: null })) });
    return id;
  }
  public async startRun(id: number) { this.patchRun(id, { status: "running", started_at: new Date().toISOString() }); }
  public async completeRun(id: number, output: unknown) { this.patchRun(id, { status: "completed", output, completed_at: new Date().toISOString() }); }
  public async failRun(id: number, error: string) { this.patchRun(id, { status: "failed", error, completed_at: new Date().toISOString() }); }
  public async startStep(id: number, key: string, attempt: number) { this.patchStep(id, key, { status: "running", attempt, started_at: new Date().toISOString() }); }
  public async completeStep(id: number, key: string, output: unknown) { this.patchStep(id, key, { status: "completed", output, completed_at: new Date().toISOString() }); }
  public async failStep(id: number, key: string, error: string, attempt: number) { this.patchStep(id, key, { status: "failed", error, attempt, completed_at: new Date().toISOString() }); }
  public async getRun(id: number) { return this.runs.get(id) ?? null; }
  public async listRuns(limit: number) { return [...this.runs.values()].reverse().slice(0, limit); }
  public async ensureWatchlist(targets: RepositoryTarget[]) { this.watchlist = targets; }
  public async getWatchlist() { return this.watchlist; }
  public async getLatestSnapshot(target: RepositoryTarget) { return this.snapshots.get(format(target)) ?? null; }
  public async saveSnapshot(target: RepositoryTarget, snapshot: RepositorySnapshot) { this.snapshots.set(format(target), snapshot); }
  public async getRecentCompletedRuns(type: WorkflowType, since: Date) { return [...this.runs.values()].filter((run) => run.type === type && run.status === "completed" && new Date(run.completed_at ?? 0) >= since); }

  private patchRun(id: number, patch: Partial<WorkflowRun>) {
    const run = this.runs.get(id);
    if (!run) throw new Error("missing run");
    this.runs.set(id, { ...run, ...patch });
  }
  private patchStep(id: number, key: string, patch: Partial<WorkflowRun["steps"][number]>) {
    const run = this.runs.get(id);
    if (!run) throw new Error("missing run");
    run.steps = run.steps.map((step) => step.key === key ? { ...step, ...patch } : step);
  }
}

const snapshot: RepositorySnapshot = {
  owner: "acme", name: "demo", url: "https://github.com/acme/demo", description: "demo repository", primary_language: "TypeScript",
  stars: 120, forks: 15, open_issues: 4, archived: false, recent_commits_30d: 12, active_contributors_30d: 3,
  opened_issues_30d: 4, closed_issues_30d: 2, pushed_at: new Date().toISOString(), captured_at: new Date().toISOString(),
};

function setup(options: { snapshot?: Partial<RepositorySnapshot>; documents?: "full" | "minimal"; failTargets?: string[] } = {}) {
  const store = new MemoryWorkflowStore();
  const source: WorkflowRepositorySource = {
    getSnapshot: async (target) => {
      if (options.failTargets?.includes(format(target))) throw new Error("GitHub unavailable");
      return { ...snapshot, ...options.snapshot, ...target, url: `https://github.com/${format(target)}` };
    },
    findCompetitors: async () => [{ owner: "other", name: "rival", url: "https://github.com/other/rival", description: "rival", stars: 200, primary_language: "TypeScript" }],
  };
  const collector: RepositorySourceCollector = { collect: async (target) => {
    if (options.failTargets?.includes(format(target))) throw new Error("GitHub unavailable");
    return options.documents === "minimal"
      ? [{ sourceType: "repository", title: "metadata", url: snapshot.url, content: "metadata" }]
      : [
        { sourceType: "repository", title: "metadata", url: snapshot.url, content: "metadata" },
        { sourceType: "readme", title: "README", url: snapshot.url, content: "A".repeat(3_000) },
      ];
  } };
  const analyzer: RepositoryAnalyzer = { analyze: async () => analysis };
  return { store, service: new DefaultWorkflowService(store, source, collector, analyzer) };
}

describe("DefaultWorkflowService", () => {
  it("runs quick assessment through all six steps", async () => {
    const { service } = setup();
    const run = await waitForRun(service, await service.startQuickAssessment("https://github.com/acme/demo"));
    expect(run.status).toBe("completed");
    expect(run.steps).toHaveLength(6);
    expect(run.steps.every((step) => step.status === "completed")).toBe(true);
    expect(run.output).toMatchObject({ repository: "acme/demo", health: { health_score: 84 } });
  });

  it("runs daily ranking and then builds a weekly report", async () => {
    const { store, service } = setup();
    await service.ensureWatchlist([{ owner: "acme", name: "demo" }, { owner: "acme", name: "second" }]);
    const daily = await waitForRun(service, await service.startDailyHealth());
    expect(daily.status).toBe("completed");
    expect((daily.output as { ranking: Array<{ rank: number }> }).ranking.map((item) => item.rank)).toEqual([1, 2]);
    const weekly = await waitForRun(service, await service.startWeeklyReport());
    expect(weekly.status).toBe("completed");
    expect(weekly.output).toMatchObject({ summary: { daily_reports: 1 } });
    await expect(service.listRuns(10)).resolves.toHaveLength(2);
    expect(store.snapshots.size).toBe(2);
  });

  it("rejects an invalid GitHub reference before creating a run", async () => {
    const { service } = setup();
    await expect(service.startQuickAssessment("not-a-repository")).rejects.toThrow("owner/repo");
  });

  it("keeps a daily report when one repository fails", async () => {
    const { service } = setup({ failTargets: ["acme/broken"] });
    await service.ensureWatchlist([{ owner: "acme", name: "demo" }, { owner: "acme", name: "broken" }]);
    const run = await waitForRun(service, await service.startDailyHealth());
    expect(run.status).toBe("completed");
    expect((run.output as { failures: unknown[] }).failures).toHaveLength(1);
  }, 5_000);

  it("records failed runs and handles reports without history", async () => {
    const { store, service } = setup();
    store.getWatchlist = async () => { throw new Error("database unavailable"); };
    const failed = await waitForRun(service, await service.startDailyHealth());
    expect(failed).toMatchObject({ status: "failed", error: "database unavailable" });

    const { service: cleanService } = setup({ snapshot: { archived: true, stars: 0, forks: 0, recent_commits_30d: 0 }, documents: "minimal" });
    const quick = await waitForRun(cleanService, await cleanService.startQuickAssessment("acme/archived"));
    expect(quick.status).toBe("completed");
    const weekly = await waitForRun(cleanService, await cleanService.startWeeklyReport());
    expect((weekly.output as { report: string }).report).toContain("尚无每日健康报告");
  }, 5_000);
});

async function waitForRun(service: DefaultWorkflowService, id: number): Promise<WorkflowRun> {
  for (let attempt = 0; attempt < 250; attempt += 1) {
    const run = await service.getRun(id);
    if (run && (run.status === "completed" || run.status === "failed")) return run;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("workflow did not finish");
}

function format(target: RepositoryTarget) { return `${target.owner}/${target.name}`; }
