import { query, type McpServerConfig, type Options, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { ResearchReportSchema, type ResearchReport } from "@devscope/shared";
import type { AgentEnvironment } from "./environment.js";
import type { ReportWriter } from "./report-writer.js";
import type { ResearchProgressHandler, ResearchToolFactory } from "./types.js";

export type AgentQuery = (params: { prompt: string; options: Options }) => AsyncIterable<SDKMessage>;

export interface DeepResearchAgentOptions {
  environment: AgentEnvironment;
  toolFactory: ResearchToolFactory;
  reportWriter: ReportWriter;
  query?: AgentQuery;
  cwd: string;
  maxTurns?: number;
  timeoutMs?: number;
}

const SYSTEM_PROMPT = `You are DevScope's open-source ecosystem research agent.
Research the user's technology topic autonomously using only the provided DevScope tools.
Required process: search GitHub, Hacker News, and papers; identify 3-5 relevant repositories; analyze the strongest candidates; then produce one complete Markdown report.
Call each search tool at most once and analyze no more than five repositories.
The report must contain: executive summary, market landscape, competitor comparison, technology trends, risk matrix, and recommendation.
Every factual claim must cite a URL returned by a tool. Never invent metrics or sources.
If a source is unavailable, state the limitation and continue with the remaining evidence.
Return only the final Markdown report after tool use is complete.`;

export class DeepResearchAgent {
  private readonly runQuery: AgentQuery;
  private readonly maxTurns: number;
  private readonly timeoutMs: number;

  public constructor(private readonly options: DeepResearchAgentOptions) {
    this.runQuery = options.query ?? query;
    this.maxTurns = Math.min(Math.max(options.maxTurns ?? 20, 5), 30);
    this.timeoutMs = options.timeoutMs ?? 15 * 60_000;
  }

  public async run(runId: string, topic: string, onProgress: ResearchProgressHandler): Promise<ResearchReport> {
    onProgress({ type: "phase", message: "深度研究任务已启动" });
    const toolSession = this.options.toolFactory.create(onProgress);
    const abortController = new AbortController();
    const timer = setTimeout(() => abortController.abort(), this.timeoutMs);
    let markdown = "";
    try {
      const stream = this.runQuery({
        prompt: `Research topic: ${topic}`,
        options: {
          abortController,
          cwd: this.options.cwd,
          env: this.options.environment.processEnv,
          model: this.options.environment.model,
          systemPrompt: SYSTEM_PROMPT,
          maxTurns: this.maxTurns,
          tools: [],
          allowedTools: [
            "mcp__devscope__search_github_repositories",
            "mcp__devscope__search_hacker_news",
            "mcp__devscope__search_papers",
            "mcp__devscope__analyze_repository",
          ],
          permissionMode: "dontAsk",
          settingSources: [],
          mcpServers: { devscope: toolSession.server as McpServerConfig },
        },
      });
      for await (const message of stream) {
        if (message.type === "assistant") this.describeAssistantMessage(message, onProgress);
        if (message.type === "result") {
          if (message.subtype !== "success" || message.is_error) throw new Error(message.subtype === "success" ? message.result : message.subtype);
          markdown = message.result.trim();
        }
      }
      if (markdown.length < 100) throw new Error("Agent did not return a complete research report");
      if (toolSession.sources.length === 0) throw new Error("Agent report has no traceable sources");
      const reportPath = await this.options.reportWriter.write(runId, markdown);
      const report = ResearchReportSchema.parse({
        run_id: runId,
        topic,
        markdown,
        sources: toolSession.sources,
        report_path: reportPath,
        generated_at: new Date().toISOString(),
      });
      return report;
    } catch (error) {
      const message = abortController.signal.aborted ? "Agent research timed out" : error instanceof Error ? error.message : String(error);
      throw new Error(message, { cause: error });
    } finally {
      clearTimeout(timer);
    }
  }

  private describeAssistantMessage(message: Extract<SDKMessage, { type: "assistant" }>, onProgress: ResearchProgressHandler): void {
    for (const block of message.message.content) {
      if (block.type === "tool_use") onProgress({ type: "phase", message: `Agent 选择工具：${block.name}` });
    }
  }
}
