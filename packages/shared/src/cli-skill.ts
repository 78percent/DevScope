import { z } from "zod";
import { RepositoryAnalysisSchema } from "./repository-analysis.js";
import { RepositorySnapshotSchema } from "./workflow.js";

export const RepoFetchOptionsSchema = z.object({
  include_issues: z.boolean().default(false),
  include_commits: z.boolean().default(false),
}).strict();

export const RepoIssueSchema = z.object({
  number: z.number().int().positive(),
  title: z.string(),
  state: z.enum(["open", "closed"]),
  url: z.string().url(),
  created_at: z.string(),
  closed_at: z.string().nullable(),
}).strict();

export const RepoCommitSchema = z.object({
  sha: z.string(),
  message: z.string(),
  author: z.string(),
  committed_at: z.string().nullable(),
  url: z.string().url(),
}).strict();

export const RepoFetchResultSchema = z.object({
  repository: RepositorySnapshotSchema,
  readme: z.string(),
  issues: z.array(RepoIssueSchema),
  commits: z.array(RepoCommitSchema),
  options: RepoFetchOptionsSchema,
}).strict();

export const RepoAnalyzeResultSchema = z.object({
  repository: z.string(),
  fetched_at: z.string(),
  analysis: RepositoryAnalysisSchema,
}).strict();

export const ReportTemplateSchema = z.enum(["daily", "weekly", "investment"]);
export const ReportFormatSchema = z.enum(["markdown", "html"]);
export const GeneratedReportSchema = z.object({
  repository: z.string(),
  template: ReportTemplateSchema,
  format: ReportFormatSchema,
  content: z.string().min(1),
  generated_at: z.string(),
}).strict();

export const HealthTrendInputSchema = z.object({
  days: z.number().int().min(1).max(365).default(30),
  repositories: z.array(z.string().trim().min(3)).max(20).optional(),
}).strict();

export const HealthTrendPointSchema = z.object({
  repository: z.string(),
  date: z.string(),
  health_score: z.number().int().min(0).max(100),
}).strict();

export const HealthTrendResultSchema = z.object({
  points: z.array(HealthTrendPointSchema),
}).strict();

export type RepoFetchOptions = z.infer<typeof RepoFetchOptionsSchema>;
export type RepoFetchResult = z.infer<typeof RepoFetchResultSchema>;
export type RepoAnalyzeResult = z.infer<typeof RepoAnalyzeResultSchema>;
export type ReportTemplate = z.infer<typeof ReportTemplateSchema>;
export type ReportFormat = z.infer<typeof ReportFormatSchema>;
export type GeneratedReport = z.infer<typeof GeneratedReportSchema>;
export type HealthTrendInput = z.infer<typeof HealthTrendInputSchema>;
export type HealthTrendPoint = z.infer<typeof HealthTrendPointSchema>;
export type HealthTrendResult = z.infer<typeof HealthTrendResultSchema>;
