import { z } from "zod";
import { RepositoryAnalysisSchema } from "./repository-analysis.js";
import { RepositoryTargetSchema } from "./rag.js";

export const WorkflowTypeSchema = z.enum(["daily_health", "quick_assessment", "weekly_report"]);
export const WorkflowStatusSchema = z.enum(["pending", "running", "completed", "failed"]);
export const WorkflowStepStatusSchema = z.enum(["pending", "running", "completed", "failed"]);

export const RepositorySnapshotSchema = z.object({
  owner: z.string().min(1),
  name: z.string().min(1),
  url: z.string().url(),
  description: z.string(),
  primary_language: z.string(),
  stars: z.number().int().nonnegative(),
  forks: z.number().int().nonnegative(),
  open_issues: z.number().int().nonnegative(),
  archived: z.boolean(),
  recent_commits_30d: z.number().int().nonnegative(),
  active_contributors_30d: z.number().int().nonnegative(),
  opened_issues_30d: z.number().int().nonnegative(),
  closed_issues_30d: z.number().int().nonnegative(),
  pushed_at: z.string().nullable(),
  captured_at: z.string(),
}).strict();

export const CompetitorRepositorySchema = z.object({
  owner: z.string(),
  name: z.string(),
  url: z.string().url(),
  description: z.string(),
  stars: z.number().int().nonnegative(),
  primary_language: z.string(),
}).strict();

export const QuickAssessmentReportSchema = z.object({
  repository: z.string(),
  generated_at: z.string(),
  code_quality: z.object({ score: z.number().int().min(0).max(100), summary: z.string() }).strict(),
  community: z.object({ score: z.number().int().min(0).max(100), summary: z.string() }).strict(),
  competitors: z.array(CompetitorRepositorySchema),
  health: RepositoryAnalysisSchema,
  executive_summary: z.string(),
}).strict();

export const WorkflowStepSchema = z.object({
  key: z.string(),
  label: z.string(),
  status: WorkflowStepStatusSchema,
  attempt: z.number().int().nonnegative(),
  output: z.unknown().nullable(),
  error: z.string().nullable(),
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
}).strict();

export const WorkflowRunSchema = z.object({
  id: z.number().int().positive(),
  type: WorkflowTypeSchema,
  status: WorkflowStatusSchema,
  input: z.unknown(),
  output: z.unknown().nullable(),
  error: z.string().nullable(),
  created_at: z.string(),
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  steps: z.array(WorkflowStepSchema),
}).strict();

export const WorkflowStartResultSchema = z.object({ run_id: z.number().int().positive() }).strict();
export const WorkflowRunInputSchema = z.object({ run_id: z.number().int().positive() }).strict();
export const WorkflowListInputSchema = z.object({ limit: z.number().int().min(1).max(50).default(20) }).strict();
export const QuickAssessmentInputSchema = z.object({ repository: z.string().trim().min(1).max(300) }).strict();

export type WorkflowType = z.infer<typeof WorkflowTypeSchema>;
export type WorkflowStatus = z.infer<typeof WorkflowStatusSchema>;
export type WorkflowStepStatus = z.infer<typeof WorkflowStepStatusSchema>;
export type RepositorySnapshot = z.infer<typeof RepositorySnapshotSchema>;
export type CompetitorRepository = z.infer<typeof CompetitorRepositorySchema>;
export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;
export type WorkflowRun = z.infer<typeof WorkflowRunSchema>;

export function parseRepositoryReference(value: string): z.infer<typeof RepositoryTargetSchema> {
  const normalized = value.trim().replace(/\/$/, "");
  const match = normalized.match(/^(?:https?:\/\/github\.com\/)?([^/]+)\/([^/]+)$/i);
  if (!match?.[1] || !match[2]) throw new Error("请输入 owner/repo 或完整 GitHub 仓库地址");
  return RepositoryTargetSchema.parse({ owner: match[1], name: match[2].replace(/\.git$/i, "") });
}
