import Anthropic from "@anthropic-ai/sdk";
import { AnthropicRepositoryAnalyzer, MockRepositoryAnalyzer, type RepositoryAnalyzer } from "./repository-analyzer.js";

export interface AiEnvironment {
  [key: string]: string | undefined;
  AI_MODE?: string;
  DEEPSEEK_API_KEY?: string;
  DEEPSEEK_BASE_URL?: string;
  DEEPSEEK_MODEL?: string;
}

export function createRepositoryAnalyzer(env: AiEnvironment = process.env): RepositoryAnalyzer {
  if ((env.AI_MODE ?? "mock") === "mock") return new MockRepositoryAnalyzer();
  if (!env.DEEPSEEK_API_KEY) throw new Error("DEEPSEEK_API_KEY is required when AI_MODE=deepseek");
  const client = new Anthropic({ apiKey: env.DEEPSEEK_API_KEY, baseURL: env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com/anthropic" });
  return new AnthropicRepositoryAnalyzer(client, env.DEEPSEEK_MODEL ?? "deepseek-flash");
}
