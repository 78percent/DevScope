import { randomUUID } from "node:crypto";
import {
  ResearchReviewInputSchema,
  ResearchRunSchema,
  ResearchStartInputSchema,
  type ResearchEvent,
  type ResearchReviewInput,
  type ResearchRun,
} from "@devscope/shared";
import { MemoryResearchStore } from "./memory-store.js";
import type { ResearchProgress, ResearchStore, ResearchWorker } from "./types.js";

export class ResearchJobManager {
  private readonly runs = new Map<string, ResearchRun>();
  private readonly listeners = new Map<string, Set<(event: ResearchEvent) => void>>();

  public constructor(
    private readonly worker: ResearchWorker,
    private readonly store: ResearchStore = new MemoryResearchStore(),
  ) {}

  public async start(rawTopic: string): Promise<string> {
    const { topic } = ResearchStartInputSchema.parse({ topic: rawTopic });
    const id = randomUUID();
    const run = ResearchRunSchema.parse({
      id,
      topic,
      status: "pending",
      events: [],
      created_at: new Date().toISOString(),
    });
    this.runs.set(id, run);
    await this.store.create(run);
    void this.collect(id);
    return id;
  }

  public async get(runId: string): Promise<ResearchRun | null> {
    const active = this.runs.get(runId);
    if (active) return active;
    const stored = await this.store.get(runId);
    if (stored) this.runs.set(runId, stored);
    return stored;
  }

  public async list(limit = 20): Promise<ResearchRun[]> {
    return this.store.list(limit);
  }

  public async review(rawInput: ResearchReviewInput): Promise<ResearchRun> {
    const input = ResearchReviewInputSchema.parse(rawInput);
    const run = await this.get(input.run_id);
    if (!run) throw new Error(`Unknown research run: ${input.run_id}`);
    if (run.status !== "awaiting_review" || !run.checkpoint) throw new Error("当前研究任务不在等待确认状态");

    const reviewedAt = new Date().toISOString();
    if (input.action === "stop") {
      this.runs.set(run.id, ResearchRunSchema.parse({
        ...run,
        status: "cancelled",
        reviewed_at: reviewedAt,
        completed_at: reviewedAt,
      }));
      this.append(run.id, { type: "cancelled", message: "研究任务已按要求停止" });
      const cancelled = this.requireRun(run.id);
      await this.store.save(cancelled);
      return cancelled;
    }

    this.runs.set(run.id, ResearchRunSchema.parse({
      ...run,
      status: "generating",
      reviewed_at: reviewedAt,
      ...(input.guidance ? { guidance: input.guidance } : {}),
    }));
    this.append(run.id, {
      type: "reviewed",
      message: input.action === "adjust" ? "已收到调整意见，开始生成报告" : "已确认中间结果，开始生成报告",
      data: input.guidance ? { guidance: input.guidance } : undefined,
    });
    const reviewed = this.requireRun(run.id);
    await this.store.save(reviewed);
    void this.generate(run.id);
    return reviewed;
  }

  public subscribe(runId: string, listener: (event: ResearchEvent) => void): () => void {
    const listeners = this.listeners.get(runId) ?? new Set();
    listeners.add(listener);
    this.listeners.set(runId, listeners);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) this.listeners.delete(runId);
    };
  }

  private async collect(runId: string): Promise<void> {
    const run = this.requireRun(runId);
    this.runs.set(runId, ResearchRunSchema.parse({ ...run, status: "collecting", started_at: new Date().toISOString() }));
    try {
      await this.store.save(this.requireRun(runId));
      const checkpoint = await this.worker.collect(runId, run.topic, (progress) => this.append(runId, progress));
      const current = this.requireRun(runId);
      this.runs.set(runId, ResearchRunSchema.parse({ ...current, status: "awaiting_review", checkpoint }));
      this.append(runId, {
        type: "awaiting_review",
        message: "资料收集和对比已完成，请确认后继续生成报告",
        data: checkpoint,
      });
      await this.store.save(this.requireRun(runId));
    } catch (error) {
      await this.fail(runId, error);
    }
  }

  private async generate(runId: string): Promise<void> {
    const run = this.requireRun(runId);
    if (!run.checkpoint) return this.fail(runId, new Error("研究中间结果不存在"));
    try {
      const report = await this.worker.generateReport(
        runId,
        run.topic,
        run.checkpoint,
        run.guidance,
        (progress) => this.append(runId, progress),
      );
      const current = this.requireRun(runId);
      this.runs.set(runId, ResearchRunSchema.parse({
        ...current,
        status: "completed",
        report,
        completed_at: new Date().toISOString(),
      }));
      this.append(runId, { type: "completed", message: "深度研究报告已生成", data: { report_path: report.report_path } });
      await this.store.save(this.requireRun(runId));
    } catch (error) {
      await this.fail(runId, error);
    }
  }

  private async fail(runId: string, error: unknown): Promise<void> {
    const current = this.requireRun(runId);
    const message = error instanceof Error ? error.message : String(error);
    this.runs.set(runId, ResearchRunSchema.parse({
      ...current,
      status: "failed",
      error: message,
      completed_at: new Date().toISOString(),
    }));
    this.append(runId, { type: "error", message });
    await this.store.save(this.requireRun(runId));
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
    this.runs.set(runId, ResearchRunSchema.parse({ ...run, events: [...run.events, event] }));
    for (const listener of this.listeners.get(runId) ?? []) listener(event);
  }

  private requireRun(runId: string): ResearchRun {
    const run = this.runs.get(runId);
    if (!run) throw new Error(`Unknown research run: ${runId}`);
    return run;
  }
}
