import { Octokit } from "@octokit/rest";
import {
  RepoFetchResultSchema,
  type RepoFetchOptions,
  type RepoFetchResult,
  type RepositoryTarget,
} from "@devscope/shared";
import { GitHubWorkflowSource, type WorkflowRepositorySource } from "./workflow-source.js";

export interface CliRepositorySource {
  fetch(target: RepositoryTarget, options: RepoFetchOptions): Promise<RepoFetchResult>;
}

export interface GitHubCliSourceOptions {
  token: string;
  octokit?: Octokit;
  snapshots?: WorkflowRepositorySource;
}

export class GitHubCliSource implements CliRepositorySource {
  private readonly octokit: Octokit;
  private readonly snapshots: WorkflowRepositorySource;

  public constructor(options: GitHubCliSourceOptions) {
    this.octokit = options.octokit ?? new Octokit({ auth: options.token, request: { timeout: 15_000 } });
    this.snapshots = options.snapshots ?? new GitHubWorkflowSource({ token: options.token });
  }

  public async fetch(target: RepositoryTarget, options: RepoFetchOptions): Promise<RepoFetchResult> {
    const parameters = { owner: target.owner, repo: target.name };
    const [repository, readme, issues, commits] = await Promise.all([
      this.snapshots.getSnapshot(target),
      this.octokit.rest.repos.getReadme(parameters),
      options.include_issues
        ? this.octokit.rest.issues.listForRepo({ ...parameters, state: "all", per_page: 100 })
        : Promise.resolve({ data: [] }),
      options.include_commits
        ? this.octokit.rest.repos.listCommits({ ...parameters, per_page: 100 })
        : Promise.resolve({ data: [] }),
    ]);

    return RepoFetchResultSchema.parse({
      repository,
      readme: Buffer.from(readme.data.content.replace(/\n/g, ""), "base64").toString("utf8"),
      issues: issues.data.flatMap((issue) => "pull_request" in issue ? [] : [{
        number: issue.number,
        title: issue.title,
        state: issue.state,
        url: issue.html_url,
        created_at: issue.created_at,
        closed_at: issue.closed_at,
      }]),
      commits: commits.data.map((commit) => ({
        sha: commit.sha,
        message: commit.commit.message,
        author: commit.author?.login ?? commit.commit.author?.name ?? "unknown",
        committed_at: commit.commit.author?.date ?? null,
        url: commit.html_url,
      })),
      options,
    });
  }
}
