import cors from "@fastify/cors";
import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import Fastify from "fastify";
import type { RepositoryAnalyzer } from "@devscope/ai";
import type { RagService, WorkflowService } from "@devscope/core";
import { appRouter } from "./router.js";

export interface BuildAppOptions {
  analyzer: RepositoryAnalyzer;
  rag?: RagService;
  workflow?: WorkflowService;
  databaseReady?: () => Promise<boolean>;
}

export async function buildApp(options: BuildAppOptions) {
  const app = Fastify({ logger: false });
  await app.register(cors, { origin: true });
  await app.register(fastifyTRPCPlugin, {
    prefix: "/trpc",
    trpcOptions: {
      router: appRouter,
      createContext: () => ({
        analyzer: options.analyzer,
        ...(options.rag ? { rag: options.rag } : {}),
        ...(options.workflow ? { workflow: options.workflow } : {}),
      }),
    },
  });

  app.get("/health", async () => ({
    status: "ok",
    database: options.databaseReady ? await options.databaseReady() : "not-checked",
  }));
  return app;
}
