import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { createEmbeddingProvider, createRagAnswerGenerator, createRepositoryAnalyzer } from "@devscope/ai";
import { DefaultRagService } from "@devscope/core";
import { checkDatabaseConnection, createDatabase, PostgresRagStore } from "@devscope/db";
import { DevScopeSourceCollector, GitHubSource, HackerNewsSource } from "@devscope/sources";
import { buildApp } from "./app.js";

// pnpm/Turborepo 会把 API 的工作目录切到 apps/api，因此显式读取项目根目录 .env。
// 使用 import.meta.url 定位，避免依赖用户从哪个目录执行启动命令。
config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)), quiet: true });

if (!process.env.GITHUB_TOKEN) throw new Error("GITHUB_TOKEN is required for Day 2 ingestion");
const database = createDatabase();
const collector = new DevScopeSourceCollector(new GitHubSource({ token: process.env.GITHUB_TOKEN }), new HackerNewsSource());
const rag = new DefaultRagService(collector, createEmbeddingProvider(), new PostgresRagStore(database.db), createRagAnswerGenerator());
const app = await buildApp({ analyzer: createRepositoryAnalyzer(), rag, databaseReady: () => checkDatabaseConnection() });
app.addHook("onClose", async () => database.client.end());
const port = Number(process.env.API_PORT ?? 4000);
const host = process.env.API_HOST ?? "127.0.0.1";

try {
  await app.listen({ port, host });
  console.log(`DevScope API listening on http://${host}:${port}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
