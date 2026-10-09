import { index, boolean, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex, vector } from "drizzle-orm/pg-core";
import type { RagSourceType, RepositoryAnalysis } from "@devscope/shared";

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
