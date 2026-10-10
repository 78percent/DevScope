import { describe, expect, it, vi } from "vitest";
import { GitHubTopicSource, HackerNewsTopicSource, PaperTopicSource } from "./topic-source.js";

describe("topic research sources", () => {
  it("normalizes GitHub repository search results", async () => {
    const search = vi.fn().mockResolvedValue({ data: { items: [{
      full_name: "acme/agent",
      html_url: "https://github.com/acme/agent",
      description: "Agent framework",
      stargazers_count: 10,
      forks_count: 2,
      language: "TypeScript",
      updated_at: "2026-01-01T00:00:00Z",
    }] } });
    const source = new GitHubTopicSource("token", { rest: { search: { repos: search } } } as never);
    await expect(source.search("agent", 3)).resolves.toMatchObject([{ title: "acme/agent", metadata: { stars: 10 } }]);
    expect(search).toHaveBeenCalledWith({ q: "agent", sort: "stars", order: "desc", per_page: 3 });
  });

  it("searches Hacker News and skips untitled hits", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ hits: [
      { objectID: "1", title: "Agent discussion", points: 4, num_comments: 2 },
      { objectID: "2", title: null },
    ] }) });
    await expect(new HackerNewsTopicSource(fetchImpl as never).search("agent", 5)).resolves.toHaveLength(1);
  });

  it("searches papers and falls back to arXiv after rate limiting", async () => {
    const ok = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [{ paperId: "p1", title: "Agent Paper", year: 2026 }] }) });
    await expect(new PaperTopicSource(ok as never).search("agent", 5)).resolves.toMatchObject([{ title: "Agent Paper" }]);
    const fallback = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 429 })
      .mockResolvedValueOnce({ ok: true, text: async () => "<feed><entry><id>https://arxiv.org/abs/1</id><title>Agent &amp; Tooling</title><summary>Research abstract</summary><published>2026-01-01T00:00:00Z</published></entry></feed>" });
    await expect(new PaperTopicSource(fallback as never).search("agent", 5)).resolves.toMatchObject([{ title: "Agent & Tooling", metadata: { year: 2026 } }]);
    const failed = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    await expect(new PaperTopicSource(failed as never).search("agent", 5)).rejects.toThrow("fallback failed");
  });
});
