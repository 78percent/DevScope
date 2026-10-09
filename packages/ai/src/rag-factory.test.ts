import { describe, expect, it } from "vitest";
import { DashScopeEmbeddingProvider } from "./embedding-provider.js";
import { AnthropicRagAnswerGenerator, MockRagAnswerGenerator } from "./rag-answer-generator.js";
import { createEmbeddingProvider, createRagAnswerGenerator } from "./rag-factory.js";

describe("RAG AI factories", () => {
  it("requires a DashScope key", () => {
    expect(() => createEmbeddingProvider({})).toThrow("DASHSCOPE_API_KEY");
  });

  it("creates the configured embedding adapter", () => {
    expect(createEmbeddingProvider({ DASHSCOPE_API_KEY: "key" })).toBeInstanceOf(DashScopeEmbeddingProvider);
  });

  it("uses a mock answer generator without a live key", () => {
    expect(createRagAnswerGenerator({})).toBeInstanceOf(MockRagAnswerGenerator);
  });

  it("creates the live answer generator when configured", () => {
    expect(createRagAnswerGenerator({ DEEPSEEK_API_KEY: "key" })).toBeInstanceOf(AnthropicRagAnswerGenerator);
  });
});
