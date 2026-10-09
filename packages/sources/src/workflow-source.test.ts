import { describe, expect, it, vi } from "vitest";
import type { Octokit } from "@octokit/rest";
import { GitHubWorkflowSource } from "./workflow-source.js";

describe("GitHubWorkflowSource", () => {
  it("collects activity metrics and finds comparable repositories", async () => {
    const get = vi.fn().mockResolvedValue({ data: {
      html_url: "https://github.com/acme/demo", description: "workflow toolkit", language: "TypeScript",
      stargazers_count: 100, forks_count: 20, open_issues_count: 3, archived: false, pushed_at: "2026-10-01T00:00:00Z",
    } });
    const listCommits = vi.fn().mockResolvedValue({ data: [{ author: { login: "one" } }, { author: { login: "two" } }, { author: { login: "one" } }] });
    const listForRepo = vi.fn().mockResolvedValue({ data: [
      { created_at: new Date().toISOString(), state: "closed" },
      { created_at: new Date().toISOString(), state: "open", pull_request: { url: "pr" } },
    ] });
    const repos = vi.fn().mockResolvedValue({ data: { items: [
      { full_name: "acme/demo", owner: { login: "acme" }, name: "demo", html_url: "https://github.com/acme/demo", description: "self", stargazers_count: 100, language: "TypeScript" },
      { full_name: "other/rival", owner: { login: "other" }, name: "rival", html_url: "https://github.com/other/rival", description: null, stargazers_count: 300, language: null },
    ] } });
    const octokit = { rest: { repos: { get, listCommits }, issues: { listForRepo }, search: { repos } } } as unknown as Octokit;
    const source = new GitHubWorkflowSource({ token: "token", octokit, minimumIntervalMs: 0 });

    const snapshot = await source.getSnapshot({ owner: "acme", name: "demo" });
    expect(snapshot).toMatchObject({ recent_commits_30d: 3, active_contributors_30d: 2, opened_issues_30d: 1, closed_issues_30d: 1 });
    const competitors = await source.findCompetitors({ owner: "acme", name: "demo" }, snapshot);
    expect(competitors).toEqual([{ owner: "other", name: "rival", url: "https://github.com/other/rival", description: "", stars: 300, primary_language: "Unknown" }]);
    expect(repos).toHaveBeenCalledWith(expect.objectContaining({ per_page: 6 }));
  });
});
