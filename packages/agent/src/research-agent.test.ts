import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import type { ResearchSource } from "@devscope/shared";
import { describe, expect, it, vi } from "vitest";
import { DeepResearchAgent } from "./research-agent.js";

vi.mock("@anthropic-ai/claude-agent-sdk", () => ({ query: vi.fn() }));

const source: ResearchSource = {
  kind: "github",
  title: "acme/agent",
  url: "https://github.com/acme/agent",
  retrieved_at: "2026-01-01T00:00:00.000Z",
};

function resultMessage(markdown: string): SDKMessage {
  return { type: "result", subtype: "success", is_error: false, result: markdown } as unknown as SDKMessage;
}

function agentCall(name: string): SDKMessage {
  return {
    type: "assistant",
    message: { content: [{ type: "tool_use", id: `tool-${name}`, name: "Agent", input: { subagent_type: name, prompt: "work" } }] },
  } as unknown as SDKMessage;
}

function createAgent(runQuery: ReturnType<typeof vi.fn>, sources: ResearchSource[] = [source], write = vi.fn().mockResolvedValue("reports/run.md")) {
  return { agent: new DeepResearchAgent({
    environment: { processEnv: { ANTHROPIC_API_KEY: "secret" }, model: "deepseek-flash" },
    cwd: "C:/workspace",
    query: runQuery as never,
    reportWriter: { write },
    toolFactory: { create: () => ({ server: {}, sources }) },
  }), write };
}

describe("DeepResearchAgent", () => {
  it("uses three specialist agents and returns a review checkpoint", async () => {
    const summary = `# Intermediate research\n\n${"Evidence-backed analysis. ".repeat(8)}[source](${source.url})`;
    const runQuery = vi.fn((_params: { prompt: string }) => (async function* () {
      yield agentCall("fetch");
      yield agentCall("community");
      yield agentCall("competitor");
      yield resultMessage(summary);
    })());
    const { agent } = createAgent(runQuery);
    const progress = vi.fn();
    const checkpoint = await agent.collect("00000000-0000-4000-8000-000000000001", "Agent frameworks", progress);
    expect(checkpoint.agents).toEqual(["orchestrator", "fetch", "community", "competitor"]);
    expect(checkpoint.sources).toEqual([source]);
    expect(runQuery).toHaveBeenCalledWith(expect.objectContaining({ options: expect.objectContaining({
      tools: ["Agent"],
      agents: expect.objectContaining({ fetch: expect.any(Object), community: expect.any(Object), competitor: expect.any(Object) }),
      permissionMode: "dontAsk",
    }) }));
    expect(progress).toHaveBeenCalledWith(expect.objectContaining({ type: "agent_start" }));
  });

  it("delegates the approved checkpoint to the report agent", async () => {
    const markdown = `# Final report\n\n${"Evidence-backed report. ".repeat(8)}`;
    const runQuery = vi.fn((_params: { prompt: string }) => (async function* () {
      yield agentCall("report");
      yield resultMessage(markdown);
    })());
    const { agent, write } = createAgent(runQuery);
    const report = await agent.generateReport("00000000-0000-4000-8000-000000000001", "Agent frameworks", {
      plan: "Collect repository and community evidence, then compare candidates.",
      summary: "Intermediate evidence. ".repeat(8),
      agents: ["orchestrator", "fetch", "community", "competitor"],
      sources: [source],
      collected_at: "2026-01-01T00:00:00.000Z",
    }, "Focus on cost", vi.fn());
    expect(report.markdown).toBe(markdown.trim());
    expect(write).toHaveBeenCalledWith(report.run_id, markdown.trim());
    expect(runQuery.mock.calls[0]?.[0].prompt).toContain("Focus on cost");
  });

  it("rejects orchestration that skips required agents", async () => {
    const runQuery = vi.fn((_params: { prompt: string }) => (async function* () {
      yield agentCall("fetch");
      yield resultMessage("x".repeat(120));
    })());
    const { agent } = createAgent(runQuery);
    await expect(agent.collect("00000000-0000-4000-8000-000000000001", "Agent frameworks", vi.fn())).rejects.toThrow("community Agent");
  });

  it("turns an aborted SDK run into a timeout error", async () => {
    const runQuery = vi.fn(({ options }: { options: { abortController?: AbortController } }) => (async function* () {
      await new Promise<void>((resolve) => options.abortController?.signal.addEventListener("abort", () => resolve(), { once: true }));
      throw new Error("aborted");
      yield {} as SDKMessage;
    })());
    const { agent } = createAgent(runQuery as never);
    Object.assign(agent, { timeoutMs: 5 });
    await expect(agent.collect("00000000-0000-4000-8000-000000000001", "Agent frameworks", vi.fn())).rejects.toThrow("timed out");
  });
});
