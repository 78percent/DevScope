import { describe, expect, it, vi } from "vitest";
import { analysisToolName, type RepositoryAnalysisInput } from "@devscope/shared";
import { AnthropicRepositoryAnalyzer, MockRepositoryAnalyzer, type AnthropicMessagesClient } from "./repository-analyzer.js";

const input: RepositoryAnalysisInput = {
  repository: { owner: "openai", name: "example", url: "https://github.com/openai/example", stars: 100, forks: 10, open_issues: 5, archived: false },
  metrics: { stars_growth_rate: 0.1, issue_resolution_rate: 0.8, active_contributors_90d: 12, contributor_diversity: 75 },
};
const output = {
  health_score: 90,
  activity_level: "high",
  key_metrics: { stars_growth_rate: 0.1, issue_resolution_rate: 0.8, contributor_diversity: 75 },
  risk_factors: [],
  opportunities: ["Growing community"],
  recommendation: "invest",
};

function clientWithContent(content: unknown[]): AnthropicMessagesClient {
  return { messages: { create: vi.fn().mockResolvedValue({ id: "msg", type: "message", role: "assistant", model: "deepseek-flash", stop_reason: "tool_use", stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 }, content }) } } as unknown as AnthropicMessagesClient;
}

describe("AnthropicRepositoryAnalyzer", () => {
  it("forces the named tool and validates its input", async () => {
    const client = clientWithContent([{ type: "tool_use", id: "tool-1", name: analysisToolName, input: output }]);
    await expect(new AnthropicRepositoryAnalyzer(client, "deepseek-flash").analyze(input)).resolves.toEqual(output);
    expect(client.messages.create).toHaveBeenCalledWith(expect.objectContaining({
      thinking: { type: "disabled" },
      tool_choice: { type: "tool", name: analysisToolName },
    }));
  });

  it("rejects a response without the required tool", async () => {
    const client = clientWithContent([{ type: "text", text: "plain text" }]);
    await expect(new AnthropicRepositoryAnalyzer(client, "deepseek-flash").analyze(input)).rejects.toThrow("did not call");
  });

  it("rejects tool data outside the schema", async () => {
    const client = clientWithContent([{ type: "tool_use", id: "tool-1", name: analysisToolName, input: { ...output, health_score: 101 } }]);
    await expect(new AnthropicRepositoryAnalyzer(client, "deepseek-flash").analyze(input)).rejects.toThrow();
  });
});

describe("MockRepositoryAnalyzer", () => {
  it("returns a schema-valid local result", async () => {
    await expect(new MockRepositoryAnalyzer().analyze(input)).resolves.toMatchObject({ health_score: 82, recommendation: "invest" });
  });
});
