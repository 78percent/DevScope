import { decode, encode } from "gpt-tokenizer";

export interface ChunkTextOptions {
  maxTokens?: number;
  overlapTokens?: number;
}

/** Token-aware chunks prevent README boundaries from silently exceeding the Day 2 target. */
export function chunkText(text: string, options: ChunkTextOptions = {}): string[] {
  const maxTokens = options.maxTokens ?? 500;
  const overlapTokens = options.overlapTokens ?? 50;
  if (maxTokens < 1) throw new Error("maxTokens must be positive");
  if (overlapTokens < 0 || overlapTokens >= maxTokens) throw new Error("overlapTokens must be between 0 and maxTokens - 1");
  const tokens = encode(text.trim());
  if (tokens.length === 0) return [];
  const chunks: string[] = [];
  const step = maxTokens - overlapTokens;
  for (let start = 0; start < tokens.length; start += step) {
    chunks.push(decode(tokens.slice(start, start + maxTokens)).trim());
    if (start + maxTokens >= tokens.length) break;
  }
  return chunks.filter(Boolean);
}
