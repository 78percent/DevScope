import { describe, expect, it } from "vitest";
import { IngestRepositoryInputSchema, SemanticSearchInputSchema, SemanticSearchResultSchema } from "./rag.js";

describe("RAG contracts", () => {
  it("normalizes the default search limit", () => {
    expect(SemanticSearchInputSchema.parse({ query: "How active is this project?" }).limit).toBe(5);
  });

  it("rejects an empty repository name", () => {
    expect(() => IngestRepositoryInputSchema.parse({ owner: "vercel", name: " " })).toThrow();
  });

  it("rejects untraceable source URLs", () => {
    expect(() => SemanticSearchResultSchema.parse({
      answer: "Based on the README.",
      sources: [{ id: 1, source_type: "readme", title: "README", url: "not-a-url", content: "text", similarity: 0.9 }],
    })).toThrow();
  });
});
