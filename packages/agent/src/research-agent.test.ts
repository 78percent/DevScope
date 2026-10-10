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

function successfulQuery(markdown: string) {
  return vi.fn(() => (async function* () {
    yield {
      type: "assistant",
      message: { content: [{ type: "tool_use", id: "tool-1", name: "mcp__devscope__search_github_repositories", input: {} }] },
    } as unknown as SDKMessage;
    yield { type: "result", subtype: "success", is_error: false, result: markdown } as unknown as SDKMessage;
  })());
}

describe("DeepResearchAgent", () => {
  it("writes a traceable report and restricts the SDK tool surface", async () => {
    const markdown = `# Competition report\n\n${"Evidence-backed analysis. ".repeat(8)}[source](${source.url})`;
    const runQuery = successfulQuery(markdown);
    const write = vi.fn().mockResolvedValue("reports/run.md");
    const progress = vi.fn();
    const agent = new DeepResearchAgent({
      environment: { processEnv: { ANTHROPIC_API_KEY: "secret" }, model: "deepseek-flash" },
      cwd: "C:/workspace",
      query: runQuery,
      reportWriter: { write },
      toolFactory: { create: () => ({ server: {}, sources: [source] }) },
    });
    const report = await agent.run("00000000-0000-4000-8000-000000000001", "Agent frameworks", progress);
    expect(report.report_path).toBe("reports/run.md");
    expect(write).toHaveBeenCalledWith(report.run_id, markdown);
    expect(runQuery).toHaveBeenCalledWith(expect.objectContaining({ options: expect.objectContaining({
      tools: [],
      permissionMode: "dontAsk",
      maxTurns: 20,
    }) }));
    expect(progress).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("选择工具") }));
  });

  it("rejects reports without sources", async () => {
    const agent = new DeepResearchAgent({
      environment: { processEnv: { ANTHROPIC_API_KEY: "secret" }, model: "deepseek-flash" },
      cwd: "C:/workspace",
      query: successfulQuery("x".repeat(120)),
      reportWriter: { write: vi.fn() },
      toolFactory: { create: () => ({ server: {}, sources: [] }) },
    });
    await expect(agent.run("00000000-0000-4000-8000-000000000001", "Agent frameworks", vi.fn())).rejects.toThrow("no traceable sources");
  });

  it("fails when the SDK reaches its turn limit", async () => {
    const runQuery = vi.fn(() => (async function* () {
      yield { type: "result", subtype: "error_max_turns", is_error: true } as unknown as SDKMessage;
    })());
    const agent = new DeepResearchAgent({
      environment: { processEnv: { ANTHROPIC_API_KEY: "secret" }, model: "deepseek-flash" },
      cwd: "C:/workspace",
      query: runQuery,
      maxTurns: 100,
      reportWriter: { write: vi.fn() },
      toolFactory: { create: () => ({ server: {}, sources: [source] }) },
    });
    await expect(agent.run("00000000-0000-4000-8000-000000000001", "Agent frameworks", vi.fn())).rejects.toThrow("error_max_turns");
    expect(runQuery).toHaveBeenCalledWith(expect.objectContaining({ options: expect.objectContaining({ maxTurns: 30 }) }));
  });

  it("turns an aborted SDK run into a timeout error", async () => {
    const runQuery = vi.fn(({ options }: { options: { abortController?: AbortController } }) => (async function* () {
      await new Promise<void>((resolve) => options.abortController?.signal.addEventListener("abort", () => resolve(), { once: true }));
      throw new Error("aborted");
      yield {} as SDKMessage;
    })());
    const agent = new DeepResearchAgent({
      environment: { processEnv: { ANTHROPIC_API_KEY: "secret" }, model: "deepseek-flash" },
      cwd: "C:/workspace",
      query: runQuery as never,
      timeoutMs: 5,
      reportWriter: { write: vi.fn() },
      toolFactory: { create: () => ({ server: {}, sources: [source] }) },
    });
    await expect(agent.run("00000000-0000-4000-8000-000000000001", "Agent frameworks", vi.fn())).rejects.toThrow("timed out");
  });
});
