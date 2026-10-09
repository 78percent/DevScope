import { describe, expect, it, vi } from "vitest";
import type { RagSearchSource } from "@devscope/shared";
import { AnthropicRagAnswerGenerator, MockRagAnswerGenerator, type RagAnthropicMessagesClient } from "./rag-answer-generator.js";

const source: RagSearchSource = { id: 1, source_type: "readme", title: "README", url: "https://github.com/acme/demo", content: "A useful project", similarity: 0.9 };

describe("AnthropicRagAnswerGenerator", () => {
  it("builds a grounded prompt and returns text", async () => {
    const create = vi.fn().mockResolvedValue({ content: [{ type: "text", text: "这是回答。[1]" }] });
    const generator = new AnthropicRagAnswerGenerator({ messages: { create } } as unknown as RagAnthropicMessagesClient, "model");
    await expect(generator.answer("项目做什么？", [source])).resolves.toBe("这是回答。[1]");
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ messages: [expect.objectContaining({ content: expect.stringContaining(source.url) })] }));
  });

  it("does not call the model when retrieval is empty", async () => {
    const create = vi.fn();
    const generator = new AnthropicRagAnswerGenerator({ messages: { create } } as unknown as RagAnthropicMessagesClient, "model");
    await expect(generator.answer("问题", [])).resolves.toContain("没有找到");
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects an empty model response", async () => {
    const create = vi.fn().mockResolvedValue({ content: [] });
    const generator = new AnthropicRagAnswerGenerator({ messages: { create } } as unknown as RagAnthropicMessagesClient, "model");
    await expect(generator.answer("问题", [source])).rejects.toThrow("did not contain");
  });
});

describe("MockRagAnswerGenerator", () => {
  it("handles retrieval results and empty retrieval", async () => {
    const generator = new MockRagAnswerGenerator();
    await expect(generator.answer("问题", [source])).resolves.toContain("README");
    await expect(generator.answer("问题", [])).resolves.toContain("没有找到");
  });
});
