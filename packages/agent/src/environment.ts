export interface AgentEnvironmentInput {
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_BASE_URL?: string;
  DEEPSEEK_API_KEY?: string;
  DEEPSEEK_BASE_URL?: string;
  DEEPSEEK_MODEL?: string;
  AGENT_MODEL?: string;
}

export interface AgentEnvironment {
  processEnv: Record<string, string | undefined>;
  model: string;
}

export function createAgentEnvironment(env: NodeJS.ProcessEnv & AgentEnvironmentInput): AgentEnvironment {
  const apiKey = env.ANTHROPIC_API_KEY ?? env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY or ANTHROPIC_API_KEY is required for the research agent");
  const baseUrl = env.ANTHROPIC_BASE_URL ?? env.DEEPSEEK_BASE_URL;
  return {
    processEnv: {
      ...env,
      ANTHROPIC_API_KEY: apiKey,
      ...(baseUrl ? { ANTHROPIC_BASE_URL: baseUrl } : {}),
      CLAUDE_AGENT_SDK_CLIENT_APP: "devscope/0.2.0",
    },
    model: env.AGENT_MODEL ?? env.DEEPSEEK_MODEL ?? "claude-sonnet-4-5",
  };
}
