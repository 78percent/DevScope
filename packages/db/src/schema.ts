import { boolean, integer, jsonb, pgTable, serial, text, timestamp, vector } from "drizzle-orm/pg-core";
import type { RepositoryAnalysis } from "@devscope/shared";

export const repositories = pgTable("repositories", {
  id: serial("id").primaryKey(),
  owner: text("owner").notNull(),
  name: text("name").notNull(),
  url: text("url").notNull().unique(),
  archived: boolean("archived").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const repositoryAnalyses = pgTable("repository_analyses", {
  id: serial("id").primaryKey(),
  repositoryId: integer("repository_id").notNull().references(() => repositories.id, { onDelete: "cascade" }),
  healthScore: integer("health_score").notNull(),
  result: jsonb("result").$type<RepositoryAnalysis>().notNull(),
  // Day 2 写入 bge-m3 1024 维向量；Day 1 只验证 pgvector 能建列。
  summaryEmbedding: vector("summary_embedding", { dimensions: 1024 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
