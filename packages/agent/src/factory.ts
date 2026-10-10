import { resolve } from "node:path";
import { createRepositoryAnalyzer } from "@devscope/ai";
import { GitHubCliSource, GitHubTopicSource, HackerNewsTopicSource, PaperTopicSource } from "@devscope/sources";
import { createAgentEnvironment } from "./environment.js";
import { FileReportWriter } from "./report-writer.js";
import { DeepResearchAgent } from "./research-agent.js";
import { ResearchDataTools } from "./tools.js";

export function createDefaultResearchAgent(projectRoot: string, env: NodeJS.ProcessEnv = process.env): DeepResearchAgent {
  const token = env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN is required for the research agent");
  const analyzer = createRepositoryAnalyzer(env);
  return new DeepResearchAgent({
    environment: createAgentEnvironment(env),
    cwd: projectRoot,
    maxTurns: numberFromEnv(env.AGENT_MAX_TURNS, 20),
    timeoutMs: numberFromEnv(env.AGENT_TIMEOUT_MS, 15 * 60_000),
    reportWriter: new FileReportWriter(resolve(projectRoot, "reports")),
    toolFactory: new ResearchDataTools({
      githubSearch: new GitHubTopicSource(token),
      hackerNewsSearch: new HackerNewsTopicSource(),
      paperSearch: new PaperTopicSource(),
      repositorySource: new GitHubCliSource({ token }),
      analyzer,
    }),
  });
}

function numberFromEnv(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
