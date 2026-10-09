import type { RepositoryTarget } from "@devscope/shared";
import { GitHubSource } from "./github-source.js";
import { HackerNewsSource } from "./hacker-news-source.js";
import type { RepositorySourceCollector, SourceDocument } from "./types.js";

export class DevScopeSourceCollector implements RepositorySourceCollector {
  public constructor(private readonly github: GitHubSource, private readonly hackerNews: HackerNewsSource) {}

  public async collect(target: RepositoryTarget): Promise<SourceDocument[]> {
    const githubDocuments = await this.github.collect(target);
    // HN is useful enrichment, not a reason to discard valid GitHub data when its public search is unavailable.
    try {
      return [...githubDocuments, ...await this.hackerNews.collect(target)];
    } catch (error) {
      console.warn("Hacker News collection failed; continuing with GitHub sources", error instanceof Error ? error.message : error);
      return githubDocuments;
    }
  }
}
