import { initTRPC } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import type { RagService } from "@devscope/core";
import { IngestRepositoryInputSchema, IngestRepositoryResultSchema, RepositoryAnalysisInputSchema, RepositoryAnalysisSchema, SemanticSearchInputSchema, SemanticSearchResultSchema } from "@devscope/shared";
import type { ApiContext } from "./context.js";

const t = initTRPC.context<ApiContext>().create();

export const appRouter = t.router({
  analysis: t.router({
    analyzeRepository: t.procedure
      .input(RepositoryAnalysisInputSchema)
      .output(RepositoryAnalysisSchema)
      .mutation(({ ctx, input }) => ctx.analyzer.analyze(input)),
  }),
  rag: t.router({
    ingestRepository: t.procedure
      .input(IngestRepositoryInputSchema)
      .output(IngestRepositoryResultSchema)
      .mutation(({ ctx, input }) => requireRag(ctx).ingestRepository(input)),
    search: t.procedure
      .input(SemanticSearchInputSchema)
      .output(SemanticSearchResultSchema)
      .mutation(({ ctx, input }) => requireRag(ctx).search(input)),
  }),
});

function requireRag(ctx: { rag?: RagService | undefined }) {
  if (!ctx.rag) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "RAG service is not configured" });
  return ctx.rag;
}

export type AppRouter = typeof appRouter;
