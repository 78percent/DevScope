import { describe, expect, it, vi } from "vitest";
import { DefaultRagService } from "./rag-service.js";

describe("DefaultRagService", () => {
  it("collects, embeds, and replaces repository chunks", async () => {
    const collector = { collect: vi.fn().mockResolvedValue([
      { sourceType: "repository", title: "metadata", url: "https://github.com/acme/demo", content: "repository text" },
      { sourceType: "readme", title: "README", url: "https://github.com/acme/demo", content: "readme text" },
    ]) };
    const embeddings = { embed: vi.fn().mockImplementation(async (texts: string[]) => texts.map(() => [1, 0])) };
    const store = { replaceRepositoryChunks: vi.fn(), search: vi.fn() };
    const answers = { answer: vi.fn() };
    const service = new DefaultRagService(collector, embeddings, store, answers);

    await expect(service.ingestRepository({ owner: "acme", name: "demo" })).resolves.toMatchObject({ chunks_stored: 2, sources: { repository: 1, readme: 1 } });
    expect(store.replaceRepositoryChunks).toHaveBeenCalledWith({ owner: "acme", name: "demo" }, expect.arrayContaining([expect.objectContaining({ embedding: [1, 0] })]));
  });

  it("embeds a query, retrieves sources, and generates an answer", async () => {
    const source = { id: 1, source_type: "readme" as const, title: "README", url: "https://github.com/acme/demo", content: "text", similarity: 0.9 };
    const embeddings = { embed: vi.fn().mockResolvedValue([[1, 0]]) };
    const store = { replaceRepositoryChunks: vi.fn(), search: vi.fn().mockResolvedValue([source]) };
    const answers = { answer: vi.fn().mockResolvedValue("answer [1]") };
    const service = new DefaultRagService({ collect: vi.fn() }, embeddings, store, answers);

    await expect(service.search({ query: "what is it?", limit: 5 })).resolves.toEqual({ answer: "answer [1]", sources: [source] });
    expect(store.search).toHaveBeenCalledWith([1, 0], { limit: 5 });
  });

  it("rejects mismatched ingestion vectors", async () => {
    const collector = { collect: vi.fn().mockResolvedValue([{ sourceType: "readme", title: "README", url: "https://github.com/acme/demo", content: "text" }]) };
    const service = new DefaultRagService(collector, { embed: vi.fn().mockResolvedValue([]) }, { replaceRepositoryChunks: vi.fn(), search: vi.fn() }, { answer: vi.fn() });
    await expect(service.ingestRepository({ owner: "acme", name: "demo" })).rejects.toThrow("does not match");
  });

  it("rejects a missing query vector", async () => {
    const service = new DefaultRagService({ collect: vi.fn() }, { embed: vi.fn().mockResolvedValue([]) }, { replaceRepositoryChunks: vi.fn(), search: vi.fn() }, { answer: vi.fn() });
    await expect(service.search({ query: "question", limit: 5 })).rejects.toThrow("query vector");
  });
});
