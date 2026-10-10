import { randomUUID } from "node:crypto";
import { ResearchRunSchema, ResearchStartInputSchema, type ResearchEvent, type ResearchRun } from "@devscope/shared";
import type { DeepResearchAgent } from "./research-agent.js";
import type { ResearchProgress } from "./types.js";

export class ResearchJobManager {
  private readonly runs = new Map<string, ResearchRun>();
  private readonly listeners = new Map<string, Set<(event: ResearchEvent) => void>>();

  public constructor(private readonly agent: Pick<DeepResearchAgent, "run">) {}

  public start(rawTopic: string): string {
    const { topic } = ResearchStartInputSchema.parse({ topic: rawTopic });
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    this.runs.set(id, ResearchRunSchema.parse({ id, topic, status: "pending", events: [], created_at: createdAt }));
    void this.execute(id, topic);
    return id;
  }

  public get(runId: string): ResearchRun | null {
    return this.runs.get(runId) ?? null;
  }

  public subscribe(runId: string, listener: (event: ResearchEvent) => void): () => void {
    const listeners = this.listeners.get(runId) ?? new Set();
    listeners.add(listener);
    this.listeners.set(runId, listeners);
    return () => listeners.delete(listener);
  }

  private async execute(runId: string, topic: string): Promise<void> {
    const run = this.requireRun(runId);
    this.runs.set(runId, { ...run, status: "running", started_at: new Date().toISOString() });
    try {
      const report = await this.agent.run(runId, topic, (progress) => this.append(runId, progress));
      const current = this.requireRun(runId);
      this.runs.set(runId, ResearchRunSchema.parse({ ...current, status: "completed", report, completed_at: new Date().toISOString() }));
      this.append(runId, { type: "completed", message: "深度研究报告已生成", data: { report_path: report.report_path } });
    } catch (error) {
      const current = this.requireRun(runId);
      const message = error instanceof Error ? error.message : String(error);
      this.runs.set(runId, ResearchRunSchema.parse({
        ...current,
        status: "failed",
        error: message,
        completed_at: new Date().toISOString(),
      }));
      this.append(runId, { type: "error", message });
    }
  }

  private append(runId: string, progress: ResearchProgress): void {
    const run = this.requireRun(runId);
    const event: ResearchEvent = {
      id: run.events.length,
      run_id: runId,
      type: progress.type,
      message: progress.message,
      timestamp: new Date().toISOString(),
      ...(progress.data === undefined ? {} : { data: progress.data }),
    };
    this.runs.set(runId, { ...run, events: [...run.events, event] });
    for (const listener of this.listeners.get(runId) ?? []) listener(event);
  }

  private requireRun(runId: string): ResearchRun {
    const run = this.runs.get(runId);
    if (!run) throw new Error(`Unknown research run: ${runId}`);
    return run;
  }
}
