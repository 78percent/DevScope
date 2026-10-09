import { describe, expect, it, vi } from "vitest";
import { DashScopeEmbeddingProvider, MockEmbeddingProvider } from "./embedding-provider.js";

function response(data: unknown, ok = true, status = 200): Response {
  return { ok, status, json: vi.fn().mockResolvedValue(data) } as unknown as Response;
}

describe("DashScopeEmbeddingProvider", () => {
  it("orders and validates returned vectors", async () => {
    const fetch = vi.fn().mockResolvedValue(response({ data: [
      { index: 1, embedding: [0, 1] },
      { index: 0, embedding: [1, 0] },
    ] }));
    const provider = new DashScopeEmbeddingProvider({ apiKey: "key", baseUrl: "https://example.com/v1/", model: "embedding", dimensions: 2, fetch });
    await expect(provider.embed(["a", "b"])).resolves.toEqual([[1, 0], [0, 1]]);
    expect(fetch).toHaveBeenCalledWith("https://example.com/v1/embeddings", expect.objectContaining({ method: "POST" }));
  });

  it("rejects a vector with the wrong dimension", async () => {
    const fetch = vi.fn().mockResolvedValue(response({ data: [{ index: 0, embedding: [1] }] }));
    const provider = new DashScopeEmbeddingProvider({ apiKey: "key", baseUrl: "https://example.com", model: "embedding", dimensions: 2, fetch });
    await expect(provider.embed(["a"])).rejects.toThrow("dimension mismatch");
  });

  it("surfaces an HTTP failure without exposing the response body", async () => {
    const fetch = vi.fn().mockResolvedValue(response({}, false, 401));
    const provider = new DashScopeEmbeddingProvider({ apiKey: "secret", baseUrl: "https://example.com", model: "embedding", fetch });
    await expect(provider.embed(["a"])).rejects.toThrow("HTTP 401");
  });

  it("returns no vectors for empty input", async () => {
    const fetch = vi.fn();
    const provider = new DashScopeEmbeddingProvider({ apiKey: "key", baseUrl: "https://example.com", model: "embedding", fetch });
    await expect(provider.embed([])).resolves.toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects a response with a missing vector", async () => {
    const fetch = vi.fn().mockResolvedValue(response({ data: [] }));
    const provider = new DashScopeEmbeddingProvider({ apiKey: "key", baseUrl: "https://example.com", model: "embedding", fetch });
    await expect(provider.embed(["a"])).rejects.toThrow("unexpected embedding count");
  });

  it("splits requests into batches of twenty", async () => {
    const fetch = vi.fn().mockImplementation(async (_url, init: RequestInit) => {
      const inputs = JSON.parse(String(init.body)).input as string[];
      return response({ data: inputs.map((_text, index) => ({ index, embedding: [1, 0] })) });
    });
    const provider = new DashScopeEmbeddingProvider({ apiKey: "key", baseUrl: "https://example.com", model: "embedding", dimensions: 2, fetch });
    await expect(provider.embed(Array(21).fill("text"))).resolves.toHaveLength(21);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

describe("MockEmbeddingProvider", () => {
  it("creates deterministic vectors without external calls", async () => {
    const provider = new MockEmbeddingProvider(4);
    const [first, second] = await provider.embed(["same", "same"]);
    expect(first).toEqual(second);
    expect(first).toHaveLength(4);
  });
});
