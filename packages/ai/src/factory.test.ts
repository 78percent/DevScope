import { describe, expect, it } from "vitest";
import { AnthropicRepositoryAnalyzer, MockRepositoryAnalyzer } from "./repository-analyzer.js";
import { createRepositoryAnalyzer } from "./factory.js";

describe("createRepositoryAnalyzer", () => {
  it("uses mock mode by default", () => expect(createRepositoryAnalyzer({})).toBeInstanceOf(MockRepositoryAnalyzer));
  it("requires a key for live mode", () => expect(() => createRepositoryAnalyzer({ AI_MODE: "deepseek" })).toThrow("DEEPSEEK_API_KEY"));
  it("creates the live adapter when configured", () => expect(createRepositoryAnalyzer({ AI_MODE: "deepseek", DEEPSEEK_API_KEY: "test-key" })).toBeInstanceOf(AnthropicRepositoryAnalyzer));
});
