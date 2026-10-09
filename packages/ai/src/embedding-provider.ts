import { z } from "zod";

export interface EmbeddingProvider {
  embed(texts: string[]): Promise<number[][]>;
}

const EmbeddingResponseSchema = z.object({
  data: z.array(z.object({ index: z.number().int().nonnegative(), embedding: z.array(z.number()) })),
}).passthrough();

export interface DashScopeEmbeddingOptions {
  apiKey: string;
  baseUrl: string;
  model: string;
  dimensions?: number;
  fetch?: typeof globalThis.fetch;
}

/** OpenAI-compatible DashScope adapter. qwen3.7 flash accepts at most 20 rows per request. */
export class DashScopeEmbeddingProvider implements EmbeddingProvider {
  private readonly fetchImpl: typeof globalThis.fetch;
  private readonly dimensions: number;

  public constructor(private readonly options: DashScopeEmbeddingOptions) {
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    this.dimensions = options.dimensions ?? 1024;
  }

  public async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const vectors: number[][] = [];
    for (let offset = 0; offset < texts.length; offset += 20) {
      const batch = texts.slice(offset, offset + 20);
      const response = await this.fetchImpl(`${this.options.baseUrl.replace(/\/$/, "")}/embeddings`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.options.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: this.options.model, input: batch }),
      });
      if (!response.ok) throw new Error(`DashScope embedding request failed with HTTP ${response.status}`);

      const parsed = EmbeddingResponseSchema.parse(await response.json());
      const ordered = [...parsed.data].sort((left, right) => left.index - right.index);
      if (ordered.length !== batch.length) throw new Error("DashScope returned an unexpected embedding count");
      for (const item of ordered) {
        if (item.embedding.length !== this.dimensions) {
          throw new Error(`Embedding dimension mismatch: expected ${this.dimensions}, got ${item.embedding.length}`);
        }
        vectors.push(item.embedding);
      }
    }
    return vectors;
  }
}

export class MockEmbeddingProvider implements EmbeddingProvider {
  public constructor(private readonly dimensions = 1024) {}

  public async embed(texts: string[]): Promise<number[][]> {
    return texts.map((text) => {
      const vector = Array<number>(this.dimensions).fill(0);
      for (let index = 0; index < text.length; index += 1) {
        const slot = text.charCodeAt(index) % this.dimensions;
        vector[slot] = (vector[slot] ?? 0) + 1;
      }
      return vector;
    });
  }
}
