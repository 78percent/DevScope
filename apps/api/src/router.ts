import { initTRPC } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import type { RagService, WorkflowService } from "@devscope/core";
import { HealthTrendInputSchema, HealthTrendResultSchema, IngestRepositoryInputSchema, IngestRepositoryResultSchema, QuickAssessmentInputSchema, RepositoryAnalysisInputSchema, RepositoryAnalysisSchema, RepositoryTargetSchema, ResearchListInputSchema, ResearchReviewInputSchema, ResearchRunInputSchema, ResearchRunSchema, ResearchStartInputSchema, ResearchStartResultSchema, SemanticSearchInputSchema, SemanticSearchResultSchema, WorkflowListInputSchema, WorkflowRunInputSchema, WorkflowRunSchema, WorkflowStartResultSchema } from "@devscope/shared";
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
  workflow: t.router({
    startDaily: t.procedure.output(WorkflowStartResultSchema)
      .mutation(async ({ ctx }) => ({ run_id: await requireWorkflow(ctx).startDailyHealth() })),
    startQuick: t.procedure.input(QuickAssessmentInputSchema).output(WorkflowStartResultSchema)
      .mutation(async ({ ctx, input }) => ({ run_id: await requireWorkflow(ctx).startQuickAssessment(input.repository) })),
    startWeekly: t.procedure.output(WorkflowStartResultSchema)
      .mutation(async ({ ctx }) => ({ run_id: await requireWorkflow(ctx).startWeeklyReport() })),
    status: t.procedure.input(WorkflowRunInputSchema).output(WorkflowRunSchema.nullable())
      .query(({ ctx, input }) => requireWorkflow(ctx).getRun(input.run_id)),
    list: t.procedure.input(WorkflowListInputSchema).output(WorkflowRunSchema.array())
      .query(({ ctx, input }) => requireWorkflow(ctx).listRuns(input.limit)),
    healthTrends: t.procedure.input(HealthTrendInputSchema).output(HealthTrendResultSchema)
      .query(({ ctx, input }) => requireWorkflow(ctx).getHealthTrends(input)),
    watchlist: t.procedure.output(RepositoryTargetSchema.array())
      .query(({ ctx }) => requireWorkflow(ctx).getWatchlist()),
  }),
  agent: t.router({
    startResearch: t.procedure.input(ResearchStartInputSchema).output(ResearchStartResultSchema)
      .mutation(async ({ ctx, input }) => ({ run_id: await requireResearch(ctx).start(input.topic) })),
    status: t.procedure.input(ResearchRunInputSchema).output(ResearchRunSchema.nullable())
      .query(({ ctx, input }) => requireResearch(ctx).get(input.run_id)),
    reviewResearch: t.procedure.input(ResearchReviewInputSchema).output(ResearchRunSchema)
      .mutation(({ ctx, input }) => requireResearch(ctx).review(input)),
    listResearch: t.procedure.input(ResearchListInputSchema).output(ResearchRunSchema.array())
      .query(({ ctx, input }) => requireResearch(ctx).list(input.limit)),
  }),
});

function requireRag(ctx: { rag?: RagService | undefined }) {
  if (!ctx.rag) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "RAG service is not configured" });
  return ctx.rag;
}

function requireWorkflow(ctx: { workflow?: WorkflowService | undefined }) {
  if (!ctx.workflow) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Workflow service is not configured" });
  return ctx.workflow;
}

function requireResearch(ctx: { research?: ApiContext["research"] | undefined }) {
  if (!ctx.research) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Research agent is not configured" });
  return ctx.research;
}

export type AppRouter = typeof appRouter;
