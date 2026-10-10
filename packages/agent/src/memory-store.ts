import type { ResearchRun } from "@devscope/shared";
import type { ResearchStore } from "./types.js";

export class MemoryResearchStore implements ResearchStore {
  private readonly runs = new Map<string, ResearchRun>();

  public async create(run: ResearchRun): Promise<void> {
    this.runs.set(run.id, structuredClone(run));
  }

  public async save(run: ResearchRun): Promise<void> {
    this.runs.set(run.id, structuredClone(run));
  }

  public async get(runId: string): Promise<ResearchRun | null> {
    const run = this.runs.get(runId);
    return run ? structuredClone(run) : null;
  }

  public async list(limit: number): Promise<ResearchRun[]> {
    return [...this.runs.values()]
      .sort((left, right) => right.created_at.localeCompare(left.created_at))
      .slice(0, limit)
      .map((run) => structuredClone(run));
  }
}
