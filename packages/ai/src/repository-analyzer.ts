import type Anthropic from "@anthropic-ai/sdk";
import { analysisToolName, parseRepositoryAnalysis, type RepositoryAnalysis, type RepositoryAnalysisInput, RepositoryAnalysisSchema } from "@devscope/shared";
import { z } from "zod";

export interface RepositoryAnalyzer {
  analyze(input: RepositoryAnalysisInput): Promise<RepositoryAnalysis>;
}

export type AnthropicMessagesClient = Pick<Anthropic, "messages">;

export class AnthropicRepositoryAnalyzer implements RepositoryAnalyzer {
  public constructor(private readonly client: AnthropicMessagesClient, private readonly model: string) {}

  public async analyze(input: RepositoryAnalysisInput): Promise<RepositoryAnalysis> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1_200,
      thinking: { type: "disabled" },
      system: "You are a repository health analyst. Use only the supplied evidence and always call the requested tool.",
      messages: [{ role: "user", content: `Analyze this GitHub repository snapshot:\n${JSON.stringify(input)}` }],
      tools: [{
        name: analysisToolName,
        description: "Return the validated repository health assessment.",
        input_schema: z.toJSONSchema(RepositoryAnalysisSchema) as { type: "object"; [key: string]: unknown },
      }],
      tool_choice: { type: "tool", name: analysisToolName },
    });

    const toolUse = response.content.find((block) => block.type === "tool_use" && block.name === analysisToolName);
    if (!toolUse || toolUse.type !== "tool_use") throw new Error(`AI response did not call ${analysisToolName}`);

    return parseRepositoryAnalysis(toolUse.input);
  }
}

export class MockRepositoryAnalyzer implements RepositoryAnalyzer {
  public async analyze(input: RepositoryAnalysisInput): Promise<RepositoryAnalysis> {
    const archived = input.repository.archived;
    return parseRepositoryAnalysis({
      health_score: archived ? 20 : 82,
      activity_level: archived ? "dead" : "high",
      key_metrics: {
        stars_growth_rate: input.metrics.stars_growth_rate,
        issue_resolution_rate: input.metrics.issue_resolution_rate,
        contributor_diversity: input.metrics.contributor_diversity,
      },
      risk_factors: input.repository.open_issues > 1_000 ? ["Issue backlog is high"] : [],
      opportunities: ["Contributor activity can support continued growth"],
      recommendation: archived ? "avoid" : "invest",
    });
  }
}
