import type { RepositoryAnalyzer } from "@devscope/ai";
import { RepoAnalyzeResultSchema, RepoFetchResultSchema, type RepoAnalyzeResult } from "@devscope/shared";

export async function analyzeFetchedRepository(analyzer: RepositoryAnalyzer, value: unknown): Promise<RepoAnalyzeResult> {
  const input = RepoFetchResultSchema.parse(value);
  const issueResolutionRate = input.issues.length === 0
    ? 0
    : input.issues.filter((issue) => issue.state === "closed").length / input.issues.length;
  const commitAuthors = new Set(input.commits.map((commit) => commit.author).filter((author) => author !== "unknown"));
  const analysis = await analyzer.analyze({
    repository: {
      owner: input.repository.owner,
      name: input.repository.name,
      url: input.repository.url,
      ...(input.repository.description ? { description: input.repository.description } : {}),
      ...(input.repository.primary_language === "Unknown" ? {} : { primary_language: input.repository.primary_language }),
      stars: input.repository.stars,
      forks: input.repository.forks,
      open_issues: input.repository.open_issues,
      archived: input.repository.archived,
    },
    metrics: {
      stars_growth_rate: 0,
      issue_resolution_rate: issueResolutionRate,
      active_contributors_90d: commitAuthors.size || input.repository.active_contributors_30d,
      contributor_diversity: Math.min(100, (commitAuthors.size || input.repository.active_contributors_30d) * 10),
    },
    evidence: {
      readme_excerpt: input.readme.slice(0, 12_000),
      recent_signals: [
        `${input.repository.recent_commits_30d} commits in the last 30 days`,
        `${input.issues.length} issues and ${input.commits.length} commits included in CLI input`,
      ],
    },
  });
  return RepoAnalyzeResultSchema.parse({
    repository: `${input.repository.owner}/${input.repository.name}`,
    fetched_at: input.repository.captured_at,
    analysis,
  });
}
