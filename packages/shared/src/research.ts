import { z } from "zod";

export const ResearchStatusSchema = z.enum(["pending", "running", "completed", "failed"]);
export type ResearchStatus = z.infer<typeof ResearchStatusSchema>;

export const ResearchEventTypeSchema = z.enum([
  "phase",
  "tool_start",
  "tool_result",
  "source",
  "completed",
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
  report: ResearchReportSchema.optional(),
  error: z.string().optional(),
  created_at: z.string().datetime(),
  started_at: z.string().datetime().optional(),
  completed_at: z.string().datetime().optional(),
}).strict();
export type ResearchRun = z.infer<typeof ResearchRunSchema>;

export const ResearchRunInputSchema = z.object({ run_id: z.string().uuid() }).strict();
export type ResearchRunInput = z.infer<typeof ResearchRunInputSchema>;
