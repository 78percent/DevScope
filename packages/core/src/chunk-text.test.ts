import { describe, expect, it } from "vitest";
import { encode } from "gpt-tokenizer";
import { chunkText } from "./chunk-text.js";

describe("chunkText", () => {
  it("keeps every chunk within the configured token limit", () => {
    const chunks = chunkText("DevScope semantic search. ".repeat(300), { maxTokens: 100, overlapTokens: 10 });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => encode(chunk).length <= 100)).toBe(true);
  });

  it("rejects an overlap that cannot advance", () => {
    expect(() => chunkText("text", { maxTokens: 10, overlapTokens: 10 })).toThrow("overlapTokens");
  });

  it("handles empty text and invalid token limits", () => {
    expect(chunkText("   ")).toEqual([]);
    expect(() => chunkText("text", { maxTokens: 0 })).toThrow("maxTokens");
    expect(() => chunkText("text", { maxTokens: 10, overlapTokens: -1 })).toThrow("overlapTokens");
  });
});
