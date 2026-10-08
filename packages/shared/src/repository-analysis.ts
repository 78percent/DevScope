import { z } from "zod";

/** AI 必须调用的工具名；适配器和测试共用它，防止字符串悄悄漂移。 */
export const analysisToolName = "submit_repository_analysis" as const;

export const ActivityLevelSchema = z.enum(["high", "medium", "low", "dead"]);
export const RecommendationSchema = z.enum(["invest", "watch", "avoid"]);

const RepositorySchema = z.object({
  owner: z.string().trim().min(1),
  name: z.string().trim().min(1),
  url: z.string().url(),
  description: z.string().trim().max(2_000).optional(),
  primary_language: z.string().trim().min(1).optional(),
  stars: z.number().int().nonnegative(),
  forks: z.number().int().nonnegative(),
  open_issues: z.number().int().nonnegative(),
  archived: z.boolean(),
}).strict();

const RepositoryMetricsSchema = z.object({
  // 百分比统一用小数表达，例如 12.5% 写成 0.125。
  stars_growth_rate: z.number(),
  issue_resolution_rate: z.number().min(0).max(1),
  active_contributors_90d: z.number().int().nonnegative(),
  contributor_diversity: z.number().int().min(0).max(100),
}).strict();

const EvidenceSchema = z.object({
  // 防止调用方把完整仓库内容误塞进一次模型请求。
  readme_excerpt: z.string().max(12_000).optional(),
  recent_signals: z.array(z.string().trim().min(1)).max(20).optional(),
}).strict();

export const RepositoryAnalysisInputSchema = z.object({
  repository: RepositorySchema,
  metrics: RepositoryMetricsSchema,
  evidence: EvidenceSchema.optional(),
}).strict();

const KeyMetricsSchema = z.object({
  stars_growth_rate: z.number(),
  issue_resolution_rate: z.number().min(0).max(1),
  contributor_diversity: z.number().int().min(0).max(100),
}).strict();

export const RepositoryAnalysisSchema = z.object({
  health_score: z.number().int().min(0).max(100),
  activity_level: ActivityLevelSchema,
  key_metrics: KeyMetricsSchema,
  risk_factors: z.array(z.string().trim().min(1)).max(10),
  opportunities: z.array(z.string().trim().min(1)).max(10),
  recommendation: RecommendationSchema,
}).strict();

export type RepositoryAnalysisInput = z.infer<typeof RepositoryAnalysisInputSchema>;
export type RepositoryAnalysis = z.infer<typeof RepositoryAnalysisSchema>;

/** GitHub 快照进入 AI 层之前的唯一校验入口。 */
export function parseRepositoryAnalysisInput(value: unknown): RepositoryAnalysisInput {
  return RepositoryAnalysisInputSchema.parse(value);
}

/** 即使工具调用被强制，模型返回仍是不可信输入，必须再次校验。 */
export function parseRepositoryAnalysis(value: unknown): RepositoryAnalysis {
  return RepositoryAnalysisSchema.parse(value);
}
