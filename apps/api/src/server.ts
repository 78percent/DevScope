import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { createEmbeddingProvider, createRagAnswerGenerator, createRepositoryAnalyzer } from "@devscope/ai";
import { createDefaultResearchAgent, ResearchJobManager } from "@devscope/agent";
import { DefaultRagService, DefaultWorkflowService } from "@devscope/core";
import { checkDatabaseConnection, createDatabase, PostgresRagStore, PostgresWorkflowStore } from "@devscope/db";
import { DevScopeSourceCollector, GitHubSource, GitHubWorkflowSource, HackerNewsSource } from "@devscope/sources";
import { buildApp } from "./app.js";
import { startWorkflowScheduler } from "./scheduler.js";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)), quiet: true });

if (!process.env.GITHUB_TOKEN) throw new Error("GITHUB_TOKEN is required for Day 2 ingestion");
const database = createDatabase();
const collector = new DevScopeSourceCollector(new GitHubSource({ token: process.env.GITHUB_TOKEN }), new HackerNewsSource());
const rag = new DefaultRagService(collector, createEmbeddingProvider(), new PostgresRagStore(database.db), createRagAnswerGenerator());
const analyzer = createRepositoryAnalyzer();
const workflow = new DefaultWorkflowService(
  new PostgresWorkflowStore(database.db),
  new GitHubWorkflowSource({ token: process.env.GITHUB_TOKEN }),
  collector,
  analyzer,
);
const projectRoot = fileURLToPath(new URL("../../..", import.meta.url));
const research = new ResearchJobManager(createDefaultResearchAgent(projectRoot));
await workflow.ensureWatchlist([
  { owner: "78percent", name: "LangGraph_Trip_Planner" },
  { owner: "78percent", name: "Bilibili-Progress-Tracker" },
  { owner: "KouriChat", name: "KouriChat" },
]);
const stopScheduler = startWorkflowScheduler(workflow);
const app = await buildApp({ analyzer, rag, workflow, research, databaseReady: () => checkDatabaseConnection() });
app.addHook("onClose", async () => {
  stopScheduler();
  await database.client.end();
});
const port = Number(process.env.API_PORT ?? 4000);
const host = process.env.API_HOST ?? "127.0.0.1";

try {
  await app.listen({ port, host });
  console.log(`DevScope API listening on http://${host}:${port}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
