import {
  query,
  type AgentDefinition,
  type McpServerConfig,
  type Options,
  type SDKMessage,
} from "@anthropic-ai/claude-agent-sdk";
import {
  ResearchCheckpointSchema,
  ResearchReportSchema,
  type ResearchAgentName,
  type ResearchCheckpoint,
  type ResearchReport,
} from "@devscope/shared";
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

const FETCH_TOOLS = [
  "mcp__devscope__search_github_repositories",
  "mcp__devscope__analyze_repository",
];
const COMMUNITY_TOOLS = [
  "mcp__devscope__search_hacker_news",
  "mcp__devscope__search_papers",
];

const SUBAGENTS: Record<string, AgentDefinition> = {
  fetch: {
    description: "Search GitHub and inspect the strongest repositories for concrete engineering evidence.",
    prompt: `You are DevScope's repository research specialist. Search GitHub once, choose no more than five relevant repositories, and analyze the strongest candidates. Report concrete metrics, strengths, weaknesses, and source URLs. Do not invent facts.`,
    tools: FETCH_TOOLS,
    model: "inherit",
    maxTurns: 8,
  },
  community: {
    description: "Collect independent community discussion and research-paper evidence.",
    prompt: `You are DevScope's ecosystem signal specialist. Search Hacker News and papers once each. Summarize adoption signals, current debates, and technical trends with source URLs. State clearly when evidence is sparse.`,
    tools: COMMUNITY_TOOLS,
    model: "inherit",
    maxTurns: 6,
  },
  competitor: {
    description: "Compare collected candidates after repository and community research is available.",
    prompt: `You are DevScope's competitor analyst. Use only the evidence supplied in the delegation prompt. Compare alternatives, identify tradeoffs and risks, and produce a concise Markdown synthesis. Never add unsupported facts or URLs.`,
    tools: [],
    model: "inherit",
    maxTurns: 4,
  },
};

const REPORT_AGENT: Record<string, AgentDefinition> = {
  report: {
    description: "Turn approved research evidence and human guidance into the final Markdown report.",
    prompt: `You are DevScope's report writer. Use only the supplied checkpoint evidence and URLs. Produce a complete Markdown report with: executive summary, market landscape, competitor comparison, technology trends, risk matrix, and recommendation. Every factual claim must be traceable to a supplied URL. Follow the human guidance when present. Return only the report.`,
    tools: [],
    model: "inherit",
    maxTurns: 5,
  },
};

const ORCHESTRATOR_PROMPT = `You are DevScope's research orchestrator.
First make a short research plan. Then delegate repository research to the fetch agent and ecosystem research to the community agent in the same assistant turn so they can work independently. After both results are available, delegate their combined evidence to the competitor agent. Finally return a detailed Markdown intermediate summary that includes the plan, repository findings, community and paper signals, comparison, limitations, and all source URLs.
You must use fetch, community, and competitor. Do not call data tools yourself. Do not produce the final report yet.`;

export class DeepResearchAgent {
  private readonly runQuery: AgentQuery;
  private readonly maxTurns: number;
  private readonly timeoutMs: number;

  public constructor(private readonly options: DeepResearchAgentOptions) {
    this.runQuery = options.query ?? query;
    this.maxTurns = Math.min(Math.max(options.maxTurns ?? 20, 5), 30);
    this.timeoutMs = options.timeoutMs ?? 15 * 60_000;
  }

  public async collect(runId: string, topic: string, onProgress: ResearchProgressHandler): Promise<ResearchCheckpoint> {
    onProgress({ type: "phase", message: "研究协调器已启动，正在安排资料收集" });
    const toolSession = this.options.toolFactory.create(onProgress);
    const invoked = new Set<ResearchAgentName>();
    const summary = await this.execute({
      prompt: `Research topic: ${topic}`,
      systemPrompt: ORCHESTRATOR_PROMPT,
      agents: SUBAGENTS,
      mcpServer: toolSession.server as McpServerConfig,
      allowedTools: ["Agent", ...FETCH_TOOLS, ...COMMUNITY_TOOLS],
      onProgress,
      invoked,
    });

    for (const required of ["fetch", "community", "competitor"] as const) {
      if (!invoked.has(required)) throw new Error(`研究协调器没有调用 ${required} Agent`);
    }
    if (summary.length < 100) throw new Error("Agent 返回的中间研究结果不完整");
    if (toolSession.sources.length === 0) throw new Error("Agent 中间结果没有可追溯来源");

    return ResearchCheckpointSchema.parse({
      plan: "并行收集 GitHub 仓库证据与社区/论文信号，再基于两路结果串行完成竞品对比。",
      summary,
      agents: ["orchestrator", ...invoked],
      sources: toolSession.sources,
      collected_at: new Date().toISOString(),
    });
  }

  public async generateReport(
    runId: string,
    topic: string,
    checkpoint: ResearchCheckpoint,
    guidance: string | undefined,
    onProgress: ResearchProgressHandler,
  ): Promise<ResearchReport> {
    onProgress({ type: "phase", message: "报告 Agent 正在整理已确认的研究结果" });
    const invoked = new Set<ResearchAgentName>();
    const markdown = await this.execute({
      prompt: [
        `Topic: ${topic}`,
        `Human guidance: ${guidance ?? "No additional guidance; preserve the approved direction."}`,
        "Approved intermediate research:",
        checkpoint.summary,
        "Available sources:",
        ...checkpoint.sources.map((source) => `- ${source.title}: ${source.url}`),
        "Delegate this material to the report agent, then return its complete Markdown report without commentary.",
      ].join("\n\n"),
      systemPrompt: "You are the final-stage coordinator. Invoke the report agent exactly once and return its report unchanged.",
      agents: REPORT_AGENT,
      allowedTools: ["Agent"],
      onProgress,
      invoked,
    });
    if (!invoked.has("report")) throw new Error("报告阶段没有调用 Report Agent");
    if (markdown.length < 100) throw new Error("Report Agent 返回的报告不完整");

    const reportPath = await this.options.reportWriter.write(runId, markdown);
    return ResearchReportSchema.parse({
      run_id: runId,
      topic,
      markdown,
      sources: checkpoint.sources,
      report_path: reportPath,
      generated_at: new Date().toISOString(),
    });
  }

  public async run(runId: string, topic: string, onProgress: ResearchProgressHandler): Promise<ResearchReport> {
    const checkpoint = await this.collect(runId, topic, onProgress);
    return this.generateReport(runId, topic, checkpoint, undefined, onProgress);
  }

  private async execute(input: {
    prompt: string;
    systemPrompt: string;
    agents: Record<string, AgentDefinition>;
    allowedTools: string[];
    onProgress: ResearchProgressHandler;
    invoked: Set<ResearchAgentName>;
    mcpServer?: McpServerConfig;
  }): Promise<string> {
    const abortController = new AbortController();
    const timer = setTimeout(() => abortController.abort(), this.timeoutMs);
    let result = "";
    try {
      const stream = this.runQuery({
        prompt: input.prompt,
        options: {
          abortController,
          cwd: this.options.cwd,
          env: this.options.environment.processEnv,
          model: this.options.environment.model,
          systemPrompt: input.systemPrompt,
          maxTurns: this.maxTurns,
          tools: ["Agent"],
          allowedTools: input.allowedTools,
          permissionMode: "dontAsk",
          settingSources: [],
          agents: input.agents,
          forwardSubagentText: true,
          ...(input.mcpServer ? { mcpServers: { devscope: input.mcpServer } } : {}),
        },
      });
      for await (const message of stream) {
        if (message.type === "assistant") this.describeAssistantMessage(message, input.onProgress, input.invoked);
        if (message.type === "result") {
          if (message.subtype !== "success" || message.is_error) {
            throw new Error(message.subtype === "success" ? message.result : message.subtype);
          }
          result = message.result.trim();
        }
      }
      for (const agent of input.invoked) {
        input.onProgress({ type: "agent_result", message: `${this.displayName(agent)} 已完成`, data: { agent } });
      }
      return result;
    } catch (error) {
      const message = abortController.signal.aborted ? "Agent research timed out" : error instanceof Error ? error.message : String(error);
      throw new Error(message, { cause: error });
    } finally {
      clearTimeout(timer);
    }
  }

  private describeAssistantMessage(
    message: Extract<SDKMessage, { type: "assistant" }>,
    onProgress: ResearchProgressHandler,
    invoked: Set<ResearchAgentName>,
  ): void {
    for (const block of message.message.content) {
      if (block.type !== "tool_use") continue;
      const payload = block.input as { subagent_type?: string };
      if ((block.name === "Agent" || block.name === "Task") && this.isAgentName(payload.subagent_type)) {
        if (!invoked.has(payload.subagent_type)) {
          invoked.add(payload.subagent_type);
          onProgress({
            type: "agent_start",
            message: `${this.displayName(payload.subagent_type)} 已启动`,
            data: { agent: payload.subagent_type },
          });
        }
      }
    }
  }

  private isAgentName(value: string | undefined): value is ResearchAgentName {
    return value !== undefined && ["fetch", "community", "competitor", "report"].includes(value);
  }

  private displayName(agent: ResearchAgentName): string {
    return ({ fetch: "仓库采集 Agent", community: "社区研究 Agent", competitor: "竞品对比 Agent", report: "报告 Agent", orchestrator: "研究协调器" })[agent];
  }
}
