import { and, desc, eq, gte } from "drizzle-orm";
import type {
  RepositoryAnalysis,
  RepositorySnapshot,
  RepositoryTarget,
  WorkflowRun,
  WorkflowType,
} from "@devscope/shared";
import type { createDatabase } from "./client.js";
import {
  repositories,
  repositoryAnalyses,
  repositorySnapshots,
  watchlist,
  workflowRuns,
  workflowSteps,
} from "./schema.js";

type Database = ReturnType<typeof createDatabase>["db"];
type StepDefinition = { key: string; label: string };

export interface WorkflowStore {
  createRun(type: WorkflowType, input: unknown, steps: StepDefinition[]): Promise<number>;
  startRun(runId: number): Promise<void>;
  completeRun(runId: number, output: unknown): Promise<void>;
  failRun(runId: number, error: string): Promise<void>;
  startStep(runId: number, key: string, attempt: number): Promise<void>;
  completeStep(runId: number, key: string, output: unknown): Promise<void>;
  failStep(runId: number, key: string, error: string, attempt: number): Promise<void>;
  getRun(runId: number): Promise<WorkflowRun | null>;
  listRuns(limit: number): Promise<WorkflowRun[]>;
  ensureWatchlist(targets: RepositoryTarget[]): Promise<void>;
  getWatchlist(): Promise<RepositoryTarget[]>;
  getLatestSnapshot(target: RepositoryTarget): Promise<RepositorySnapshot | null>;
  saveSnapshot(target: RepositoryTarget, snapshot: RepositorySnapshot, analysis?: RepositoryAnalysis): Promise<void>;
  getRecentCompletedRuns(type: WorkflowType, since: Date): Promise<WorkflowRun[]>;
}

export class PostgresWorkflowStore implements WorkflowStore {
  public constructor(private readonly db: Database) {}

  public async createRun(type: WorkflowType, input: unknown, steps: StepDefinition[]): Promise<number> {
    return this.db.transaction(async (tx) => {
      const [run] = await tx.insert(workflowRuns).values({ type, input }).returning({ id: workflowRuns.id });
      if (!run) throw new Error("Workflow run creation did not return an id");
      if (steps.length > 0) await tx.insert(workflowSteps).values(steps.map((step) => ({ runId: run.id, ...step })));
      return run.id;
    });
  }

  public async startRun(runId: number): Promise<void> {
    await this.db.update(workflowRuns).set({ status: "running", startedAt: new Date(), error: null }).where(eq(workflowRuns.id, runId));
  }

  public async completeRun(runId: number, output: unknown): Promise<void> {
    await this.db.update(workflowRuns).set({ status: "completed", output, completedAt: new Date(), error: null }).where(eq(workflowRuns.id, runId));
  }

  public async failRun(runId: number, error: string): Promise<void> {
    await this.db.update(workflowRuns).set({ status: "failed", error, completedAt: new Date() }).where(eq(workflowRuns.id, runId));
  }

  public async startStep(runId: number, key: string, attempt: number): Promise<void> {
    await this.db.update(workflowSteps).set({ status: "running", attempt, startedAt: new Date(), completedAt: null, error: null })
      .where(and(eq(workflowSteps.runId, runId), eq(workflowSteps.key, key)));
  }

  public async completeStep(runId: number, key: string, output: unknown): Promise<void> {
    await this.db.update(workflowSteps).set({ status: "completed", output, completedAt: new Date(), error: null })
      .where(and(eq(workflowSteps.runId, runId), eq(workflowSteps.key, key)));
  }

  public async failStep(runId: number, key: string, error: string, attempt: number): Promise<void> {
    await this.db.update(workflowSteps).set({ status: "failed", error, attempt, completedAt: new Date() })
      .where(and(eq(workflowSteps.runId, runId), eq(workflowSteps.key, key)));
  }

  public async getRun(runId: number): Promise<WorkflowRun | null> {
    const [run] = await this.db.select().from(workflowRuns).where(eq(workflowRuns.id, runId)).limit(1);
    if (!run) return null;
    const steps = await this.db.select().from(workflowSteps).where(eq(workflowSteps.runId, runId)).orderBy(workflowSteps.id);
    return {
      id: run.id,
      type: run.type,
      status: run.status,
      input: run.input,
      output: run.output ?? null,
      error: run.error ?? null,
      created_at: run.createdAt.toISOString(),
      started_at: run.startedAt?.toISOString() ?? null,
      completed_at: run.completedAt?.toISOString() ?? null,
      steps: steps.map((step) => ({
        key: step.key,
        label: step.label,
        status: step.status,
        attempt: step.attempt,
        output: step.output ?? null,
        error: step.error ?? null,
        started_at: step.startedAt?.toISOString() ?? null,
        completed_at: step.completedAt?.toISOString() ?? null,
      })),
    };
  }

  public async listRuns(limit: number): Promise<WorkflowRun[]> {
    const rows = await this.db.select({ id: workflowRuns.id }).from(workflowRuns).orderBy(desc(workflowRuns.id)).limit(limit);
    return (await Promise.all(rows.map((row) => this.getRun(row.id)))).filter((run): run is WorkflowRun => run !== null);
  }

  public async ensureWatchlist(targets: RepositoryTarget[]): Promise<void> {
    await this.db.transaction(async (tx) => {
      for (const target of targets) {
        const url = `https://github.com/${target.owner}/${target.name}`;
        const [repository] = await tx.insert(repositories).values({ ...target, url })
          .onConflictDoUpdate({ target: repositories.url, set: { owner: target.owner, name: target.name } })
          .returning({ id: repositories.id });
        if (!repository) throw new Error("Repository upsert did not return an id");
        await tx.insert(watchlist).values({ repositoryId: repository.id }).onConflictDoNothing();
      }
    });
  }

  public async getWatchlist(): Promise<RepositoryTarget[]> {
    return this.db.select({ owner: repositories.owner, name: repositories.name }).from(watchlist)
      .innerJoin(repositories, eq(watchlist.repositoryId, repositories.id)).orderBy(watchlist.id);
  }

  public async getLatestSnapshot(target: RepositoryTarget): Promise<RepositorySnapshot | null> {
    const [row] = await this.db.select({ snapshot: repositorySnapshots.snapshot }).from(repositorySnapshots)
      .innerJoin(repositories, eq(repositorySnapshots.repositoryId, repositories.id))
      .where(and(eq(repositories.owner, target.owner), eq(repositories.name, target.name)))
      .orderBy(desc(repositorySnapshots.createdAt)).limit(1);
    return row?.snapshot ?? null;
  }

  public async saveSnapshot(target: RepositoryTarget, snapshot: RepositorySnapshot, analysis?: RepositoryAnalysis): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [repository] = await tx.insert(repositories).values({ owner: target.owner, name: target.name, url: snapshot.url, archived: snapshot.archived })
        .onConflictDoUpdate({ target: repositories.url, set: { owner: target.owner, name: target.name, archived: snapshot.archived } })
        .returning({ id: repositories.id });
      if (!repository) throw new Error("Repository upsert did not return an id");
      await tx.insert(repositorySnapshots).values({ repositoryId: repository.id, snapshot });
      if (analysis) await tx.insert(repositoryAnalyses).values({ repositoryId: repository.id, healthScore: analysis.health_score, result: analysis });
    });
  }

  public async getRecentCompletedRuns(type: WorkflowType, since: Date): Promise<WorkflowRun[]> {
    const rows = await this.db.select({ id: workflowRuns.id }).from(workflowRuns)
      .where(and(eq(workflowRuns.type, type), eq(workflowRuns.status, "completed"), gte(workflowRuns.completedAt, since)))
      .orderBy(desc(workflowRuns.id));
    return (await Promise.all(rows.map((row) => this.getRun(row.id)))).filter((run): run is WorkflowRun => run !== null);
  }
}
