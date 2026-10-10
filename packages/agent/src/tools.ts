import { createSdkMcpServer, tool, type McpSdkServerConfigWithInstance } from "@anthropic-ai/claude-agent-sdk";
import type { RepositoryAnalyzer } from "@devscope/ai";
import { ResearchSourceSchema, type ResearchSource } from "@devscope/shared";
import {
  type CliRepositorySource,
  type TopicSearchResult,
  GitHubTopicSource,
  HackerNewsTopicSource,
  PaperTopicSource,
} from "@devscope/sources";
import { z } from "zod";
import type { ResearchProgressHandler, ResearchToolFactory } from "./types.js";

export interface ResearchDataToolsOptions {
  githubSearch: GitHubTopicSource;
  hackerNewsSearch: HackerNewsTopicSource;
  paperSearch: PaperTopicSource;
  repositorySource: CliRepositorySource;
  analyzer: RepositoryAnalyzer;
}

export class ResearchDataTools implements ResearchToolFactory {
  public constructor(private readonly options: ResearchDataToolsOptions) {}

  public create(onProgress: ResearchProgressHandler): { server: McpSdkServerConfigWithInstance; sources: ResearchSource[] } {
    const sources: ResearchSource[] = [];
    const cache = new Map<string, unknown>();
    const remember = (kind: ResearchSource["kind"], results: TopicSearchResult[]) => {
      for (const result of results) {
        if (sources.some((source) => source.url === result.url)) continue;
        const source = ResearchSourceSchema.parse({ kind, title: result.title, url: result.url, retrieved_at: new Date().toISOString() });
        sources.push(source);
        onProgress({ type: "source", message: `发现来源：${source.title}`, data: source });
      }
    };
    const cached = async <T>(key: string, operation: () => Promise<T>): Promise<T> => {
      if (cache.has(key)) return cache.get(key) as T;
      const result = await operation();
      cache.set(key, result);
      return result;
    };
    const execute = async <T>(name: string, operation: () => Promise<T>) => {
      onProgress({ type: "tool_start", message: `开始执行 ${name}` });
      try {
        const result = await operation();
        onProgress({ type: "tool_result", message: `${name} 执行完成` });
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }], structuredContent: { result } };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        onProgress({ type: "tool_result", message: `${name} 执行失败：${message}` });
        return { content: [{ type: "text" as const, text: message }], isError: true };
      }
    };

    const server = createSdkMcpServer({
      name: "devscope",
      version: "0.2.0",
      alwaysLoad: true,
      timeout: 60_000,
      tools: [
        tool("search_github_repositories", "Search GitHub for leading repositories related to a technology topic.", {
          topic: z.string().min(2).describe("Technology topic or search query"),
          limit: z.number().int().min(1).max(5).default(5),
        }, ({ topic, limit }) => execute("GitHub 仓库搜索", async () => {
          const results = await cached(`github:${topic}:${limit}`, () => this.options.githubSearch.search(topic, limit));
          remember("github", results);
          return results;
        }), { annotations: { readOnlyHint: true } }),
        tool("search_hacker_news", "Search Hacker News discussions related to a technology topic.", {
          topic: z.string().min(2),
          limit: z.number().int().min(1).max(5).default(5),
        }, ({ topic, limit }) => execute("Hacker News 搜索", async () => {
          const results = await cached(`hn:${topic}:${limit}`, () => this.options.hackerNewsSearch.search(topic, limit));
          remember("hacker_news", results);
          return results;
        }), { annotations: { readOnlyHint: true } }),
        tool("search_papers", "Search academic papers related to a technology topic.", {
          topic: z.string().min(2),
          limit: z.number().int().min(1).max(5).default(5),
        }, ({ topic, limit }) => execute("论文搜索", async () => {
          const results = await cached(`paper:${topic}:${limit}`, () => this.options.paperSearch.search(topic, limit));
          remember("paper", results);
          return results;
        }), { annotations: { readOnlyHint: true } }),
        tool("analyze_repository", "Fetch and analyze one GitHub repository using the existing DevScope repository analysis capability.", {
          repository: z.string().regex(/^[^/\s]+\/[^/\s]+$/).describe("Repository in owner/name format"),
        }, ({ repository }) => execute("仓库分析", async () => cached(`repository:${repository.toLowerCase()}`, async () => {
          const [owner = "", name = ""] = repository.split("/");
          const fetched = await this.options.repositorySource.fetch({ owner, name }, { include_issues: true, include_commits: true });
          const issueResolutionRate = fetched.issues.length === 0 ? 0 : fetched.issues.filter((issue) => issue.state === "closed").length / fetched.issues.length;
          const authors = new Set(fetched.commits.map((commit) => commit.author).filter((author) => author !== "unknown"));
          const analysis = await this.options.analyzer.analyze({
            repository: {
              owner,
              name,
              url: fetched.repository.url,
              ...(fetched.repository.description ? { description: fetched.repository.description } : {}),
              stars: fetched.repository.stars,
              forks: fetched.repository.forks,
              open_issues: fetched.repository.open_issues,
              archived: fetched.repository.archived,
            },
            metrics: {
              stars_growth_rate: 0,
              issue_resolution_rate: issueResolutionRate,
              active_contributors_90d: authors.size || fetched.repository.active_contributors_30d,
              contributor_diversity: Math.min(100, (authors.size || fetched.repository.active_contributors_30d) * 10),
            },
            evidence: {
              readme_excerpt: fetched.readme.slice(0, 12_000),
              recent_signals: [`${fetched.repository.recent_commits_30d} commits in the last 30 days`],
            },
          });
          remember("github", [{ title: repository, url: fetched.repository.url, summary: fetched.repository.description ?? "", metadata: {} }]);
          return { repository, snapshot: fetched.repository, analysis };
        }))),
      ],
    });
    return { server, sources };
  }
}
