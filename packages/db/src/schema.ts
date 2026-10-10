import { index, boolean, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex, uuid, vector } from "drizzle-orm/pg-core";
import type { RagSourceType, RepositoryAnalysis, RepositorySnapshot, ResearchCheckpoint, ResearchEvent, ResearchReport, ResearchStatus, WorkflowStatus, WorkflowStepStatus, WorkflowType } from "@devscope/shared";

export const repositories = pgTable("repositories", {
  id: serial("id").primaryKey(),
  owner: text("owner").notNull(),
  name: text("name").notNull(),
  url: text("url").notNull().unique(),
  archived: boolean("archived").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("repositories_owner_name_unique").on(table.owner, table.name)]);

export const repositoryAnalyses = pgTable("repository_analyses", {
  id: serial("id").primaryKey(),
  repositoryId: integer("repository_id").notNull().references(() => repositories.id, { onDelete: "cascade" }),
  healthScore: integer("health_score").notNull(),
  result: jsonb("result").$type<RepositoryAnalysis>().notNull(),
  // 1024 维与当前千问 Embedding 配置保持一致。
  summaryEmbedding: vector("summary_embedding", { dimensions: 1024 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const repoEmbeddings = pgTable("repo_embeddings", {
  id: serial("id").primaryKey(),
  repositoryId: integer("repository_id").notNull().references(() => repositories.id, { onDelete: "cascade" }),
  sourceType: text("source_type").$type<RagSourceType>().notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  sourceUrl: text("source_url").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  embedding: vector("embedding", { dimensions: 1024 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("repo_embeddings_embedding_hnsw").using("hnsw", table.embedding.op("vector_cosine_ops"))]);

export const watchlist = pgTable("watchlist", {
  id: serial("id").primaryKey(),
  repositoryId: integer("repository_id").notNull().references(() => repositories.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("watchlist_repository_unique").on(table.repositoryId)]);

export const repositorySnapshots = pgTable("repository_snapshots", {
  id: serial("id").primaryKey(),
  repositoryId: integer("repository_id").notNull().references(() => repositories.id, { onDelete: "cascade" }),
  snapshot: jsonb("snapshot").$type<RepositorySnapshot>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("repository_snapshots_repository_created_idx").on(table.repositoryId, table.createdAt)]);

export const workflowRuns = pgTable("workflow_runs", {
  id: serial("id").primaryKey(),
  type: text("type").$type<WorkflowType>().notNull(),
  status: text("status").$type<WorkflowStatus>().notNull().default("pending"),
  input: jsonb("input").$type<unknown>().notNull(),
  output: jsonb("output").$type<unknown>(),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const workflowSteps = pgTable("workflow_steps", {
  id: serial("id").primaryKey(),
  runId: integer("run_id").notNull().references(() => workflowRuns.id, { onDelete: "cascade" }),
  key: text("key").notNull(),
  label: text("label").notNull(),
  status: text("status").$type<WorkflowStepStatus>().notNull().default("pending"),
  attempt: integer("attempt").notNull().default(0),
  output: jsonb("output").$type<unknown>(),
  error: text("error"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (table) => [uniqueIndex("workflow_steps_run_key_unique").on(table.runId, table.key)]);

export const researchReports = pgTable("research_reports", {
  id: uuid("id").primaryKey(),
  topic: text("topic").notNull(),
  status: text("status").$type<ResearchStatus>().notNull().default("pending"),
  checkpoint: jsonb("checkpoint").$type<ResearchCheckpoint>(),
  guidance: text("guidance"),
  report: jsonb("report").$type<ResearchReport>(),
  events: jsonb("events").$type<ResearchEvent[]>().notNull().default([]),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("research_reports_created_idx").on(table.createdAt)]);
