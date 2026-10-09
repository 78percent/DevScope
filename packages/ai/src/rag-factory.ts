import Anthropic from "@anthropic-ai/sdk";
import { DashScopeEmbeddingProvider, type EmbeddingProvider } from "./embedding-provider.js";
import { AnthropicRagAnswerGenerator, MockRagAnswerGenerator, type RagAnswerGenerator } from "./rag-answer-generator.js";

export interface RagAiEnvironment {
  [key: string]: string | undefined;
  DASHSCOPE_API_KEY?: string;
  DASHSCOPE_BASE_URL?: string;
  DASHSCOPE_EMBEDDING_MODEL?: string;
  DEEPSEEK_API_KEY?: string;
  DEEPSEEK_BASE_URL?: string;
  DEEPSEEK_MODEL?: string;
}

export function createEmbeddingProvider(env: RagAiEnvironment = process.env): EmbeddingProvider {
  if (!env.DASHSCOPE_API_KEY) throw new Error("DASHSCOPE_API_KEY is required for RAG embeddings");
  return new DashScopeEmbeddingProvider({
    apiKey: env.DASHSCOPE_API_KEY,
    baseUrl: env.DASHSCOPE_BASE_URL ?? "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: env.DASHSCOPE_EMBEDDING_MODEL ?? "qwen3.7-text-embedding-flash",
    dimensions: 1024,
  });
}

export function createRagAnswerGenerator(env: RagAiEnvironment = process.env): RagAnswerGenerator {
  if (!env.DEEPSEEK_API_KEY) return new MockRagAnswerGenerator();
  const client = new Anthropic({
    apiKey: env.DEEPSEEK_API_KEY,
    baseURL: env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com/anthropic",
  });
  return new AnthropicRagAnswerGenerator(client, env.DEEPSEEK_MODEL ?? "deepseek-flash");
}
