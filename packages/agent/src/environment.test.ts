import { describe, expect, it } from "vitest";
import { createAgentEnvironment } from "./environment.js";

describe("createAgentEnvironment", () => {
  it("maps the existing DeepSeek configuration only for the SDK subprocess", () => {
    const result = createAgentEnvironment({
      PATH: "test-path",
      DEEPSEEK_API_KEY: "secret",
      DEEPSEEK_BASE_URL: "https://example.com/anthropic",
      DEEPSEEK_MODEL: "deepseek-flash",
    });
    expect(result.model).toBe("deepseek-flash");
    expect(result.processEnv).toMatchObject({
      PATH: "test-path",
      ANTHROPIC_API_KEY: "secret",
      ANTHROPIC_BASE_URL: "https://example.com/anthropic",
    });
  });

  it("fails before spawning the SDK without a model credential", () => {
    expect(() => createAgentEnvironment({})).toThrow("API_KEY");
  });

  it("prefers explicit Anthropic settings and supplies the default model", () => {
    const result = createAgentEnvironment({ ANTHROPIC_API_KEY: "anthropic", DEEPSEEK_API_KEY: "deepseek" });
    expect(result.processEnv.ANTHROPIC_API_KEY).toBe("anthropic");
    expect(result.processEnv.ANTHROPIC_BASE_URL).toBeUndefined();
    expect(result.model).toBe("claude-sonnet-4-5");
  });
});
