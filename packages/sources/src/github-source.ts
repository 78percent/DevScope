import { Octokit } from "@octokit/rest";
import type { RepositoryTarget } from "@devscope/shared";
import type { SourceDocument } from "./types.js";

export interface SourceLogger {
  info(message: string): void;
  warn(message: string): void;
}

export interface GitHubSourceOptions {
  token: string;
  minimumIntervalMs?: number;
  logger?: SourceLogger;
  octokit?: Octokit;
}

/** Sequential requests plus a small interval keep one ingestion run gentle on GitHub's API. */
export class GitHubSource {
  private readonly octokit: Octokit;
  private readonly minimumIntervalMs: number;
  private readonly logger: SourceLogger;
  private lastRequestAt = 0;

  public constructor(options: GitHubSourceOptions) {
    this.octokit = options.octokit ?? new Octokit({ auth: options.token, request: { timeout: 15_000 } });
    this.minimumIntervalMs = options.minimumIntervalMs ?? 200;
    this.logger = options.logger ?? console;
  }

  public async collect(target: RepositoryTarget): Promise<SourceDocument[]> {
    const parameters = { owner: target.owner, repo: target.name };
    const repository = await this.request(() => this.octokit.rest.repos.get(parameters));
    const readme = await this.request(() => this.octokit.rest.repos.getReadme(parameters));
    const repoUrl = repository.data.html_url;
    const description = repository.data.description ?? "No repository description.";
    const topics = repository.data.topics?.join(", ") || "None";
    const repositoryContent = [
      `Repository: ${repository.data.full_name}`,
      `Description: ${description}`,
      `Primary language: ${repository.data.language ?? "Unknown"}`,
      `Stars: ${repository.data.stargazers_count}`,
      `Forks: ${repository.data.forks_count}`,
      `Open issues: ${repository.data.open_issues_count}`,
      `Archived: ${repository.data.archived}`,
      `Topics: ${topics}`,
      `Created at: ${repository.data.created_at}`,
      `Updated at: ${repository.data.updated_at}`,
    ].join("\n");
    const readmeContent = Buffer.from(readme.data.content.replace(/\n/g, ""), "base64").toString("utf8");

    return [
      { sourceType: "repository", title: `${repository.data.full_name} repository metadata`, url: repoUrl, content: repositoryContent },
      { sourceType: "readme", title: `${repository.data.full_name} README`, url: readme.data.html_url ?? repoUrl, content: readmeContent },
    ];
  }

  private async request<T extends { headers: Record<string, string | number | undefined> }>(operation: () => Promise<T>): Promise<T> {
    const waitMs = this.minimumIntervalMs - (Date.now() - this.lastRequestAt);
    if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
    const response = await operation();
    this.lastRequestAt = Date.now();
    const remaining = Number(response.headers["x-ratelimit-remaining"] ?? Number.NaN);
    this.logger.info(`GitHub API request completed; remaining quota: ${Number.isNaN(remaining) ? "unknown" : remaining}`);
    if (!Number.isNaN(remaining) && remaining < 50) this.logger.warn(`GitHub API quota is low (${remaining} requests remaining)`);
    return response;
  }
}
