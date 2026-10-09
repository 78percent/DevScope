import type Anthropic from "@anthropic-ai/sdk";
import type { RagSearchSource } from "@devscope/shared";

export interface RagAnswerGenerator {
  answer(query: string, sources: RagSearchSource[]): Promise<string>;
}

export type RagAnthropicMessagesClient = Pick<Anthropic, "messages">;

export class AnthropicRagAnswerGenerator implements RagAnswerGenerator {
  public constructor(private readonly client: RagAnthropicMessagesClient, private readonly model: string) {}

  public async answer(query: string, sources: RagSearchSource[]): Promise<string> {
    if (sources.length === 0) return "知识库中没有找到足够相关的资料。请先采集仓库，或换一个更具体的问题。";
    const context = sources.map((source, index) => [
      `[${index + 1}] ${source.title}`,
      `URL: ${source.url}`,
      source.content,
    ].join("\n")).join("\n\n");
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1_200,
      system: "You answer questions about open-source projects only from the supplied context. Answer in Chinese. Cite evidence with [1], [2] markers. If evidence is insufficient, say so explicitly.",
      messages: [{ role: "user", content: `问题：${query}\n\n检索资料：\n${context}` }],
    });
    const answer = response.content.filter((block) => block.type === "text").map((block) => block.text).join("\n").trim();
    if (!answer) throw new Error("AI response did not contain an answer");
    return answer;
  }
}

export class MockRagAnswerGenerator implements RagAnswerGenerator {
  public async answer(query: string, sources: RagSearchSource[]): Promise<string> {
    if (sources.length === 0) return "知识库中没有找到足够相关的资料。请先采集仓库，或换一个更具体的问题。";
    return `针对“${query}”，检索到 ${sources.length} 条相关资料。最相关内容来自 ${sources[0]?.title ?? "未知来源"}。[1]`;
  }
}
