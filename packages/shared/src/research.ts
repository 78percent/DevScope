import { z } from "zod";

export const ResearchStatusSchema = z.enum([
  "pending",
  "collecting",
  "awaiting_review",
  "generating",
  "completed",
  "failed",
  "cancelled",
]);
export type ResearchStatus = z.infer<typeof ResearchStatusSchema>;

export const ResearchAgentNameSchema = z.enum(["orchestrator", "fetch", "community", "competitor", "report"]);
export type ResearchAgentName = z.infer<typeof ResearchAgentNameSchema>;

export const ResearchEventTypeSchema = z.enum([
  "phase",
  "tool_start",
  "tool_result",
  "source",
  "agent_start",
  "agent_result",
  "awaiting_review",
  "reviewed",
  "completed",
  "cancelled",
  "error",
]);
export type ResearchEventType = z.infer<typeof ResearchEventTypeSchema>;

export const ResearchStartInputSchema = z.object({
  topic: z.string().trim().min(3).max(200),
}).strict();
export type ResearchStartInput = z.infer<typeof ResearchStartInputSchema>;

export const ResearchStartResultSchema = z.object({ run_id: z.string().uuid() }).strict();
export type ResearchStartResult = z.infer<typeof ResearchStartResultSchema>;

export const ResearchSourceSchema = z.object({
  kind: z.enum(["github", "hacker_news", "paper", "database"]),
  title: z.string().min(1),
  url: z.string().url(),
  retrieved_at: z.string().datetime(),
}).strict();
export type ResearchSource = z.infer<typeof ResearchSourceSchema>;

export const ResearchCheckpointSchema = z.object({
  plan: z.string().min(10),
  summary: z.string().min(100),
  agents: z.array(ResearchAgentNameSchema).min(2),
  sources: z.array(ResearchSourceSchema).min(1),
  collected_at: z.string().datetime(),
}).strict();
export type ResearchCheckpoint = z.infer<typeof ResearchCheckpointSchema>;

export const ResearchEventSchema = z.object({
  id: z.number().int().nonnegative(),
  run_id: z.string().uuid(),
  type: ResearchEventTypeSchema,
  message: z.string().min(1),
  timestamp: z.string().datetime(),
  data: z.unknown().optional(),
}).strict();
export type ResearchEvent = z.infer<typeof ResearchEventSchema>;

export const ResearchReportSchema = z.object({
  run_id: z.string().uuid(),
  topic: z.string().min(3),
  markdown: z.string().min(100),
  sources: z.array(ResearchSourceSchema).min(1),
  report_path: z.string().min(1),
  generated_at: z.string().datetime(),
}).strict();
export type ResearchReport = z.infer<typeof ResearchReportSchema>;

export const ResearchRunSchema = z.object({
  id: z.string().uuid(),
  topic: z.string().min(3),
  status: ResearchStatusSchema,
  events: z.array(ResearchEventSchema),
  checkpoint: ResearchCheckpointSchema.optional(),
  guidance: z.string().optional(),
  report: ResearchReportSchema.optional(),
  error: z.string().optional(),
  created_at: z.string().datetime(),
  started_at: z.string().datetime().optional(),
  reviewed_at: z.string().datetime().optional(),
  completed_at: z.string().datetime().optional(),
}).strict();
export type ResearchRun = z.infer<typeof ResearchRunSchema>;

export const ResearchRunInputSchema = z.object({ run_id: z.string().uuid() }).strict();
export type ResearchRunInput = z.infer<typeof ResearchRunInputSchema>;

export const ResearchReviewInputSchema = z.object({
  run_id: z.string().uuid(),
  action: z.enum(["continue", "adjust", "stop"]),
  guidance: z.string().trim().max(1_000).optional(),
}).strict().superRefine((value, context) => {
  if (value.action === "adjust" && (!value.guidance || value.guidance.length < 3)) {
    context.addIssue({ code: "custom", path: ["guidance"], message: "调整研究方向时，请填写至少 3 个字符的说明" });
  }
});
export type ResearchReviewInput = z.infer<typeof ResearchReviewInputSchema>;

export const ResearchListInputSchema = z.object({ limit: z.number().int().min(1).max(50).default(20) }).strict();
export type ResearchListInput = z.infer<typeof ResearchListInputSchema>;
