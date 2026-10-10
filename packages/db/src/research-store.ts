import { desc, eq } from "drizzle-orm";
import { ResearchRunSchema, type ResearchRun } from "@devscope/shared";
import type { createDatabase } from "./client.js";
import { researchReports } from "./schema.js";

type Database = ReturnType<typeof createDatabase>["db"];

export class PostgresResearchStore {
  public constructor(private readonly db: Database) {}

  public async create(run: ResearchRun): Promise<void> {
    await this.db.insert(researchReports).values(toRecord(run));
  }

  public async save(run: ResearchRun): Promise<void> {
    await this.db.update(researchReports).set({ ...toRecord(run), updatedAt: new Date() }).where(eq(researchReports.id, run.id));
  }

  public async get(runId: string): Promise<ResearchRun | null> {
    const [row] = await this.db.select().from(researchReports).where(eq(researchReports.id, runId)).limit(1);
    return row ? fromRecord(row) : null;
  }

  public async list(limit: number): Promise<ResearchRun[]> {
    const rows = await this.db.select().from(researchReports).orderBy(desc(researchReports.createdAt)).limit(limit);
    return rows.map(fromRecord);
  }
}

function toRecord(run: ResearchRun) {
  return {
    id: run.id,
    topic: run.topic,
    status: run.status,
    checkpoint: run.checkpoint ?? null,
    guidance: run.guidance ?? null,
    report: run.report ?? null,
    events: run.events,
    error: run.error ?? null,
    createdAt: new Date(run.created_at),
    startedAt: run.started_at ? new Date(run.started_at) : null,
    reviewedAt: run.reviewed_at ? new Date(run.reviewed_at) : null,
    completedAt: run.completed_at ? new Date(run.completed_at) : null,
  };
}

function fromRecord(row: typeof researchReports.$inferSelect): ResearchRun {
  return ResearchRunSchema.parse({
    id: row.id,
    topic: row.topic,
    status: row.status,
    events: row.events,
    ...(row.checkpoint ? { checkpoint: row.checkpoint } : {}),
    ...(row.guidance ? { guidance: row.guidance } : {}),
    ...(row.report ? { report: row.report } : {}),
    ...(row.error ? { error: row.error } : {}),
    created_at: row.createdAt.toISOString(),
    ...(row.startedAt ? { started_at: row.startedAt.toISOString() } : {}),
    ...(row.reviewedAt ? { reviewed_at: row.reviewedAt.toISOString() } : {}),
    ...(row.completedAt ? { completed_at: row.completedAt.toISOString() } : {}),
  });
}
