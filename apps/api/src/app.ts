import cors from "@fastify/cors";
import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import Fastify from "fastify";
import type { RepositoryAnalyzer } from "@devscope/ai";
import type { ResearchJobManager } from "@devscope/agent";
import type { RagService, WorkflowService } from "@devscope/core";
import { appRouter } from "./router.js";

export interface BuildAppOptions {
  analyzer: RepositoryAnalyzer;
  rag?: RagService;
  workflow?: WorkflowService;
  research?: Pick<ResearchJobManager, "start" | "get" | "subscribe">;
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
        ...(options.research ? { research: options.research } : {}),
      }),
    },
  });

  app.get("/health", async () => ({
    status: "ok",
    database: options.databaseReady ? await options.databaseReady() : "not-checked",
  }));
  app.get<{ Params: { runId: string } }>("/agent/research/:runId/events", async (request, reply) => {
    const research = options.research;
    const run = research?.get(request.params.runId);
    if (!research || !run) return reply.code(404).send({ error: "Research run not found" });

    reply.raw.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    reply.raw.setHeader("Cache-Control", "no-cache, no-transform");
    reply.raw.setHeader("Connection", "keep-alive");
    reply.raw.setHeader("X-Accel-Buffering", "no");
    if (request.headers.origin) {
      reply.raw.setHeader("Access-Control-Allow-Origin", request.headers.origin);
      reply.raw.setHeader("Vary", "Origin");
    }
    reply.hijack();
    const send = (event: typeof run.events[number]) => {
      const eventName = event.type === "error" ? "research_error" : event.type;
      reply.raw.write(`id: ${event.id}\nevent: ${eventName}\ndata: ${JSON.stringify(event)}\n\n`);
    };
    run.events.forEach(send);
    if (run.status === "completed" || run.status === "failed") {
      reply.raw.end();
      return;
    }
    const unsubscribe = research.subscribe(run.id, (event) => {
      send(event);
      if (event.type === "completed" || event.type === "error") reply.raw.end();
    });
    const keepAlive = setInterval(() => reply.raw.write(": keep-alive\n\n"), 15_000);
    request.raw.on("close", () => {
      clearInterval(keepAlive);
      unsubscribe();
    });
  });
  return app;
}
