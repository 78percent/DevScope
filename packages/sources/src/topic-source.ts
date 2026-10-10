import { Octokit } from "@octokit/rest";
import { z } from "zod";

export interface TopicSearchResult {
  title: string;
  url: string;
  summary: string;
  metadata: Record<string, string | number | null>;
}

const HackerNewsResponseSchema = z.object({
  hits: z.array(z.object({
    objectID: z.string(),
    title: z.string().nullable().optional(),
    story_title: z.string().nullable().optional(),
    url: z.string().url().nullable().optional(),
    points: z.number().nullable().optional(),
    num_comments: z.number().nullable().optional(),
  }).passthrough()),
}).passthrough();

const PaperResponseSchema = z.object({
  data: z.array(z.object({
    paperId: z.string(),
    title: z.string(),
    url: z.string().url().nullable().optional(),
    abstract: z.string().nullable().optional(),
    year: z.number().nullable().optional(),
    citationCount: z.number().nullable().optional(),
  }).passthrough()),
}).passthrough();

export class GitHubTopicSource {
  private readonly octokit: Octokit;

  public constructor(token: string, octokit?: Octokit) {
    this.octokit = octokit ?? new Octokit({ auth: token, request: { timeout: 15_000 } });
  }

  public async search(topic: string, limit: number): Promise<TopicSearchResult[]> {
    const response = await this.octokit.rest.search.repos({ q: topic, sort: "stars", order: "desc", per_page: limit });
    return response.data.items.map((repository) => ({
      title: repository.full_name,
      url: repository.html_url,
      summary: repository.description ?? "No repository description.",
      metadata: {
        stars: repository.stargazers_count,
        forks: repository.forks_count,
        language: repository.language,
        updated_at: repository.updated_at,
      },
    }));
  }
}

export class HackerNewsTopicSource {
  public constructor(private readonly fetchImpl: typeof globalThis.fetch = globalThis.fetch) {}

  public async search(topic: string, limit: number): Promise<TopicSearchResult[]> {
    const response = await this.fetchImpl(`https://hn.algolia.com/api/v1/search?tags=story&hitsPerPage=${limit}&query=${encodeURIComponent(topic)}`);
    if (!response.ok) throw new Error(`Hacker News search failed with HTTP ${response.status}`);
    const parsed = HackerNewsResponseSchema.parse(await response.json());
    return parsed.hits.flatMap((hit) => {
      const title = hit.title ?? hit.story_title;
      if (!title) return [];
      return [{
        title,
        url: `https://news.ycombinator.com/item?id=${hit.objectID}`,
        summary: hit.url ? `Linked article: ${hit.url}` : "Hacker News discussion",
        metadata: { points: hit.points ?? 0, comments: hit.num_comments ?? 0 },
      }];
    });
  }
}

export class PaperTopicSource {
  public constructor(private readonly fetchImpl: typeof globalThis.fetch = globalThis.fetch) {}

  public async search(topic: string, limit: number): Promise<TopicSearchResult[]> {
    const fields = "title,url,year,abstract,citationCount";
    const response = await this.fetchImpl(`https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(topic)}&limit=${limit}&fields=${fields}`);
    if (response.ok) {
      const parsed = PaperResponseSchema.parse(await response.json());
      return parsed.data.map((paper) => ({
        title: paper.title,
        url: paper.url ?? `https://www.semanticscholar.org/paper/${paper.paperId}`,
        summary: paper.abstract?.slice(0, 1_500) ?? "Abstract unavailable.",
        metadata: { year: paper.year ?? null, citations: paper.citationCount ?? 0 },
      }));
    }
    return this.searchArxiv(topic, limit, response.status);
  }

  private async searchArxiv(topic: string, limit: number, primaryStatus: number): Promise<TopicSearchResult[]> {
    const query = encodeURIComponent(`all:${topic}`);
    const response = await this.fetchImpl(`https://export.arxiv.org/api/query?search_query=${query}&start=0&max_results=${limit}`);
    if (!response.ok) throw new Error(`Paper search failed with HTTP ${primaryStatus}; arXiv fallback failed with HTTP ${response.status}`);
    const xml = await response.text();
    return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].flatMap((match) => {
      const entry = match[1] ?? "";
      const title = xmlValue(entry, "title");
      const url = xmlValue(entry, "id");
      if (!title || !url) return [];
      const published = xmlValue(entry, "published");
      return [{
        title,
        url,
        summary: xmlValue(entry, "summary")?.slice(0, 1_500) ?? "Abstract unavailable.",
        metadata: { year: published ? Number(published.slice(0, 4)) : null, citations: 0 },
      }];
    });
  }
}

function xmlValue(xml: string, tag: string): string | null {
  const value = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`).exec(xml)?.[1];
  return value ? value.replace(/\s+/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim() : null;
}
