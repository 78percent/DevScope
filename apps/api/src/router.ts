import { initTRPC } from "@trpc/server";
import { RepositoryAnalysisInputSchema, RepositoryAnalysisSchema } from "@devscope/shared";
import type { ApiContext } from "./context.js";

const t = initTRPC.context<ApiContext>().create();

export const appRouter = t.router({
  analysis: t.router({
    analyzeRepository: t.procedure
      .input(RepositoryAnalysisInputSchema)
      .output(RepositoryAnalysisSchema)
      .mutation(({ ctx, input }) => ctx.analyzer.analyze(input)),
  }),
});

export type AppRouter = typeof appRouter;
