import { describe, expect, it, vi } from "vitest";
import type { Octokit } from "@octokit/rest";
import { GitHubSource } from "./github-source.js";

describe("GitHubSource", () => {
  it("collects repository metadata and decodes the README", async () => {
    const logger = { info: vi.fn(), warn: vi.fn() };
    const get = vi.fn().mockResolvedValue({
      headers: { "x-ratelimit-remaining": "20" },
      data: { html_url: "https://github.com/acme/demo", description: "Demo", full_name: "acme/demo", language: "TypeScript", stargazers_count: 10, forks_count: 2, open_issues_count: 1, archived: false, topics: ["demo"], created_at: "2024-01-01", updated_at: "2024-02-01" },
    });
    const getReadme = vi.fn().mockResolvedValue({
      headers: { "x-ratelimit-remaining": "19" },
      data: { content: Buffer.from("# Demo\nUseful project").toString("base64"), html_url: "https://github.com/acme/demo/blob/main/README.md" },
    });
    const octokit = { rest: { repos: { get, getReadme } } } as unknown as Octokit;
    const documents = await new GitHubSource({ token: "token", octokit, logger, minimumIntervalMs: 0 }).collect({ owner: "acme", name: "demo" });

    expect(documents).toHaveLength(2);
    expect(documents[1]?.content).toContain("Useful project");
    expect(get).toHaveBeenCalledWith({ owner: "acme", repo: "demo" });
    expect(logger.warn).toHaveBeenCalled();
  });

  it("handles missing optional GitHub fields and unknown quota", async () => {
    const get = vi.fn().mockResolvedValue({
      headers: {},
      data: { html_url: "https://github.com/acme/minimal", description: null, full_name: "acme/minimal", language: null, stargazers_count: 0, forks_count: 0, open_issues_count: 0, archived: false, created_at: null, updated_at: "2024-02-01" },
    });
    const getReadme = vi.fn().mockResolvedValue({ headers: {}, data: { content: Buffer.from("README").toString("base64"), html_url: null } });
    const octokit = { rest: { repos: { get, getReadme } } } as unknown as Octokit;
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const documents = await new GitHubSource({ token: "token", octokit }).collect({ owner: "acme", name: "minimal" });
    expect(documents[0]?.content).toContain("Primary language: Unknown");
    expect(documents[1]?.url).toBe("https://github.com/acme/minimal");
    expect(info).toHaveBeenCalledWith(expect.stringContaining("unknown"));
    info.mockRestore();
  });
});
