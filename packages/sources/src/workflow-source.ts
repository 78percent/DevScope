import { Octokit } from "@octokit/rest";
import {
  CompetitorRepositorySchema,
  RepositorySnapshotSchema,
  type CompetitorRepository,
  type RepositorySnapshot,
  type RepositoryTarget,
} from "@devscope/shared";

export interface WorkflowRepositorySource {
  getSnapshot(target: RepositoryTarget): Promise<RepositorySnapshot>;
  findCompetitors(target: RepositoryTarget, snapshot: RepositorySnapshot): Promise<CompetitorRepository[]>;
}

export interface GitHubWorkflowSourceOptions {
  token: string;
  minimumIntervalMs?: number;
  octokit?: Octokit;
}

export class GitHubWorkflowSource implements WorkflowRepositorySource {
  private readonly octokit: Octokit;
  private readonly minimumIntervalMs: number;
  private lastRequestAt = 0;

  public constructor(options: GitHubWorkflowSourceOptions) {
    this.octokit = options.octokit ?? new Octokit({ auth: options.token, request: { timeout: 15_000 } });
    this.minimumIntervalMs = options.minimumIntervalMs ?? 200;
  }

  public async getSnapshot(target: RepositoryTarget): Promise<RepositorySnapshot> {
    const parameters = { owner: target.owner, repo: target.name };
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1_000).toISOString();
    const repository = await this.request(() => this.octokit.rest.repos.get(parameters));
    const commits = await this.request(() => this.octokit.rest.repos.listCommits({ ...parameters, since, per_page: 100 }));
    const issues = await this.request(() => this.octokit.rest.issues.listForRepo({ ...parameters, state: "all", since, per_page: 100 }));
    const recentIssues = issues.data.filter((issue) => !issue.pull_request && issue.created_at >= since);
    const activeContributors = new Set(commits.data.map((commit) => commit.author?.login).filter((login): login is string => Boolean(login)));

    return RepositorySnapshotSchema.parse({
      owner: target.owner,
      name: target.name,
      url: repository.data.html_url,
      description: repository.data.description ?? "",
      primary_language: repository.data.language ?? "Unknown",
      stars: repository.data.stargazers_count,
      forks: repository.data.forks_count,
      open_issues: repository.data.open_issues_count,
      archived: repository.data.archived,
      recent_commits_30d: commits.data.length,
      active_contributors_30d: activeContributors.size,
      opened_issues_30d: recentIssues.length,
      closed_issues_30d: recentIssues.filter((issue) => issue.state === "closed").length,
      pushed_at: repository.data.pushed_at,
      captured_at: new Date().toISOString(),
    });
  }

  public async findCompetitors(target: RepositoryTarget, snapshot: RepositorySnapshot): Promise<CompetitorRepository[]> {
    const language = snapshot.primary_language === "Unknown" ? "" : ` language:${snapshot.primary_language}`;
    const response = await this.request(() => this.octokit.rest.search.repos({
      q: `${snapshot.description || target.name}${language} stars:>10`,
      sort: "stars",
      order: "desc",
      per_page: 6,
    }));
    return response.data.items
      .filter((item) => item.full_name.toLowerCase() !== `${target.owner}/${target.name}`.toLowerCase())
      .slice(0, 3)
      .map((item) => CompetitorRepositorySchema.parse({
        owner: item.owner?.login ?? "unknown",
        name: item.name,
        url: item.html_url,
        description: item.description ?? "",
        stars: item.stargazers_count,
        primary_language: item.language ?? "Unknown",
      }));
  }

  private async request<T>(operation: () => Promise<T>): Promise<T> {
    const waitMs = this.minimumIntervalMs - (Date.now() - this.lastRequestAt);
    if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
    const response = await operation();
    this.lastRequestAt = Date.now();
    return response;
  }
}
