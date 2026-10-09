import { describe, expect, it, vi } from "vitest";
import { DevScopeSourceCollector } from "./collector.js";
import type { GitHubSource } from "./github-source.js";
import type { HackerNewsSource } from "./hacker-news-source.js";

const githubDocument = { sourceType: "repository" as const, title: "repo", url: "https://github.com/acme/demo", content: "metadata" };

describe("DevScopeSourceCollector", () => {
  it("combines GitHub and Hacker News documents", async () => {
    const github = { collect: vi.fn().mockResolvedValue([githubDocument]) } as unknown as GitHubSource;
    const hackerNews = { collect: vi.fn().mockResolvedValue([{ ...githubDocument, sourceType: "hacker_news" }]) } as unknown as HackerNewsSource;
    await expect(new DevScopeSourceCollector(github, hackerNews).collect({ owner: "acme", name: "demo" })).resolves.toHaveLength(2);
  });

  it("keeps GitHub data when Hacker News is unavailable", async () => {
    const github = { collect: vi.fn().mockResolvedValue([githubDocument]) } as unknown as GitHubSource;
    const hackerNews = { collect: vi.fn().mockRejectedValue(new Error("offline")) } as unknown as HackerNewsSource;
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await expect(new DevScopeSourceCollector(github, hackerNews).collect({ owner: "acme", name: "demo" })).resolves.toEqual([githubDocument]);
    expect(warning).toHaveBeenCalled();
    warning.mockRestore();
  });

  it("handles a non-Error Hacker News failure", async () => {
    const github = { collect: vi.fn().mockResolvedValue([githubDocument]) } as unknown as GitHubSource;
    const hackerNews = { collect: vi.fn().mockRejectedValue("offline") } as unknown as HackerNewsSource;
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await expect(new DevScopeSourceCollector(github, hackerNews).collect({ owner: "acme", name: "demo" })).resolves.toEqual([githubDocument]);
    expect(warning).toHaveBeenCalledWith(expect.any(String), "offline");
    warning.mockRestore();
  });
});
