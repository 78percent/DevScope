import { describe, expect, it, vi } from "vitest";
import { HackerNewsSource } from "./hacker-news-source.js";

describe("HackerNewsSource", () => {
  it("returns traceable discussion documents", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ hits: [{ objectID: "42", title: "Show HN: demo", story_text: "A <b>useful</b> project", points: 10, num_comments: 3 }] }) });
    const documents = await new HackerNewsSource(fetch as unknown as typeof globalThis.fetch).collect({ owner: "acme", name: "demo" });
    expect(documents[0]).toMatchObject({ sourceType: "hacker_news", url: "https://news.ycombinator.com/item?id=42" });
    expect(documents[0]?.content).toContain("A useful project");
  });

  it("rejects an HTTP error", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    await expect(new HackerNewsSource(fetch as unknown as typeof globalThis.fetch).collect({ owner: "acme", name: "demo" })).rejects.toThrow("HTTP 503");
  });

  it("handles alternate and incomplete search results", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ hits: [
      { objectID: "1", title: null, story_title: "Alternate title", comment_text: "&quot;Nice&#x27; &amp; useful&quot;", points: null, num_comments: null, url: null },
      { objectID: "2", title: null, story_title: null },
      { objectID: "3", title: "No body", url: "https://example.com" },
    ] }) });
    const documents = await new HackerNewsSource(fetch as unknown as typeof globalThis.fetch).collect({ owner: "acme", name: "demo" });
    expect(documents).toHaveLength(2);
    expect(documents[0]?.content).toContain('"Nice\' & useful"');
    expect(documents[1]?.content).toContain("Linked article");
  });
});
