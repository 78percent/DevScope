import { describe, expect, it, vi } from "vitest";
import type { Octokit } from "@octokit/rest";
import type { RepositorySnapshot } from "@devscope/shared";
import { GitHubCliSource } from "./cli-source.js";

const snapshot: RepositorySnapshot = {
  owner: "acme", name: "demo", url: "https://github.com/acme/demo", description: "demo", primary_language: "TypeScript",
  stars: 10, forks: 2, open_issues: 1, archived: false, recent_commits_30d: 2, active_contributors_30d: 1,
  opened_issues_30d: 1, closed_issues_30d: 1, pushed_at: null, captured_at: new Date().toISOString(),
};

describe("GitHubCliSource", () => {
  it("returns optional issues and commits as pipeline JSON", async () => {
    const getReadme = vi.fn().mockResolvedValue({ data: { content: Buffer.from("# Demo").toString("base64") } });
    const listForRepo = vi.fn().mockResolvedValue({ data: [
      { number: 1, title: "Issue", state: "closed", html_url: "https://github.com/acme/demo/issues/1", created_at: "2026-01-01", closed_at: "2026-01-02" },
      { number: 2, title: "PR", state: "open", html_url: "https://github.com/acme/demo/pull/2", created_at: "2026-01-01", closed_at: null, pull_request: {} },
    ] });
    const listCommits = vi.fn().mockResolvedValue({ data: [{ sha: "abc", html_url: "https://github.com/acme/demo/commit/abc", author: { login: "dev" }, commit: { message: "feat", author: { name: "Dev", date: "2026-01-01" } } }] });
    const octokit = { rest: { repos: { getReadme, listCommits }, issues: { listForRepo } } } as unknown as Octokit;
    const source = new GitHubCliSource({ token: "token", octokit, snapshots: { getSnapshot: async () => snapshot, findCompetitors: async () => [] } });
    const result = await source.fetch({ owner: "acme", name: "demo" }, { include_issues: true, include_commits: true });
    expect(result.readme).toBe("# Demo");
    expect(result.issues).toHaveLength(1);
    expect(result.commits[0]).toMatchObject({ sha: "abc", author: "dev" });
  });

  it("does not request optional collections when flags are disabled", async () => {
    const getReadme = vi.fn().mockResolvedValue({ data: { content: Buffer.from("README").toString("base64") } });
    const listForRepo = vi.fn();
    const listCommits = vi.fn();
    const octokit = { rest: { repos: { getReadme, listCommits }, issues: { listForRepo } } } as unknown as Octokit;
    const source = new GitHubCliSource({ token: "token", octokit, snapshots: { getSnapshot: async () => snapshot, findCompetitors: async () => [] } });
    const result = await source.fetch({ owner: "acme", name: "demo" }, { include_issues: false, include_commits: false });
    expect(result.issues).toEqual([]);
    expect(listForRepo).not.toHaveBeenCalled();
    expect(listCommits).not.toHaveBeenCalled();
  });
});
