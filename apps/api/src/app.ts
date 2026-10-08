import cors from "@fastify/cors";
import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import Fastify from "fastify";
import type { RepositoryAnalyzer } from "@devscope/ai";
import { appRouter } from "./router.js";

export interface BuildAppOptions {
  analyzer: RepositoryAnalyzer;
  databaseReady?: () => Promise<boolean>;
}

export async function buildApp(options: BuildAppOptions) {
  const app = Fastify({ logger: false });
  await app.register(cors, { origin: true });
  await app.register(fastifyTRPCPlugin, {
    prefix: "/trpc",
    trpcOptions: { router: appRouter, createContext: () => ({ analyzer: options.analyzer }) },
  });

  app.get("/health", async () => ({
    status: "ok",
    database: options.databaseReady ? await options.databaseReady() : "not-checked",
  }));
  return app;
}
