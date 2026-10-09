import { z } from "zod";

export const RagSourceTypeSchema = z.enum(["repository", "readme", "hacker_news"]);

export const RepositoryTargetSchema = z.object({
  owner: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(100),
}).strict();

export const IngestRepositoryInputSchema = RepositoryTargetSchema;

export const IngestRepositoryResultSchema = z.object({
  repository: z.string(),
  chunks_stored: z.number().int().nonnegative(),
  sources: z.object({
    repository: z.number().int().nonnegative(),
    readme: z.number().int().nonnegative(),
    hacker_news: z.number().int().nonnegative(),
  }).strict(),
}).strict();

export const SemanticSearchInputSchema = z.object({
  query: z.string().trim().min(2).max(2_000),
  repository: RepositoryTargetSchema.optional(),
  limit: z.number().int().min(1).max(10).default(5),
}).strict();

export const RagSearchSourceSchema = z.object({
  id: z.number().int().positive(),
  source_type: RagSourceTypeSchema,
  title: z.string(),
  url: z.string().url(),
  content: z.string(),
  similarity: z.number().min(-1).max(1),
}).strict();

export const SemanticSearchResultSchema = z.object({
  answer: z.string().trim().min(1),
  sources: z.array(RagSearchSourceSchema),
}).strict();

export type RagSourceType = z.infer<typeof RagSourceTypeSchema>;
export type RepositoryTarget = z.infer<typeof RepositoryTargetSchema>;
export type IngestRepositoryInput = z.infer<typeof IngestRepositoryInputSchema>;
export type IngestRepositoryResult = z.infer<typeof IngestRepositoryResultSchema>;
export type SemanticSearchInput = z.infer<typeof SemanticSearchInputSchema>;
export type RagSearchSource = z.infer<typeof RagSearchSourceSchema>;
export type SemanticSearchResult = z.infer<typeof SemanticSearchResultSchema>;
