import { z } from "zod";
import type { RepositoryTarget } from "@devscope/shared";
import type { SourceDocument } from "./types.js";

const SearchResponseSchema = z.object({
  hits: z.array(z.object({
    objectID: z.string(),
    title: z.string().nullable().optional(),
    story_title: z.string().nullable().optional(),
    url: z.string().url().nullable().optional(),
    story_text: z.string().nullable().optional(),
    comment_text: z.string().nullable().optional(),
    points: z.number().nullable().optional(),
    num_comments: z.number().nullable().optional(),
  }).passthrough()),
}).passthrough();

export class HackerNewsSource {
  public constructor(private readonly fetchImpl: typeof globalThis.fetch = globalThis.fetch) {}

  public async collect(target: RepositoryTarget): Promise<SourceDocument[]> {
    const query = encodeURIComponent(`${target.owner}/${target.name}`);
    const response = await this.fetchImpl(`https://hn.algolia.com/api/v1/search?tags=story&hitsPerPage=5&query=${query}`);
    if (!response.ok) throw new Error(`Hacker News search failed with HTTP ${response.status}`);
    const parsed = SearchResponseSchema.parse(await response.json());
    return parsed.hits.flatMap((hit): SourceDocument[] => {
      const title = hit.title ?? hit.story_title;
      if (!title) return [];
      const discussionUrl = `https://news.ycombinator.com/item?id=${hit.objectID}`;
      const body = stripHtml(hit.story_text ?? hit.comment_text ?? "");
      return [{
        sourceType: "hacker_news",
        title,
        url: discussionUrl,
        content: [`Hacker News discussion: ${title}`, `Points: ${hit.points ?? 0}`, `Comments: ${hit.num_comments ?? 0}`, body, hit.url ? `Linked article: ${hit.url}` : ""].filter(Boolean).join("\n"),
        metadata: { points: hit.points ?? 0, comments: hit.num_comments ?? 0 },
      }];
    });
  }
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}
