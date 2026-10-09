import type { EmbeddingProvider, RagAnswerGenerator } from "@devscope/ai";
import type { RagChunkRecord, RagStore } from "@devscope/db";
import { IngestRepositoryResultSchema, SemanticSearchResultSchema, type IngestRepositoryInput, type IngestRepositoryResult, type RagSourceType, type SemanticSearchInput, type SemanticSearchResult } from "@devscope/shared";
import type { RepositorySourceCollector } from "@devscope/sources";
import { chunkText } from "./chunk-text.js";

export interface RagService {
  ingestRepository(input: IngestRepositoryInput): Promise<IngestRepositoryResult>;
  search(input: SemanticSearchInput): Promise<SemanticSearchResult>;
}

export class DefaultRagService implements RagService {
  public constructor(
    private readonly collector: RepositorySourceCollector,
    private readonly embeddings: EmbeddingProvider,
    private readonly store: RagStore,
    private readonly answers: RagAnswerGenerator,
  ) {}

  public async ingestRepository(input: IngestRepositoryInput): Promise<IngestRepositoryResult> {
    const documents = await this.collector.collect(input);
    const chunksWithoutVectors: Omit<RagChunkRecord, "embedding">[] = documents.flatMap((document) => {
      const chunks = chunkText(document.content);
      return chunks.map((content, chunkIndex) => ({
        sourceType: document.sourceType,
        title: chunks.length > 1 ? `${document.title} (${chunkIndex + 1}/${chunks.length})` : document.title,
        content,
        sourceUrl: document.url,
        metadata: { ...document.metadata, chunkIndex, chunkCount: chunks.length },
      }));
    });
    const vectors = await this.embeddings.embed(chunksWithoutVectors.map((chunk) => chunk.content));
    if (vectors.length !== chunksWithoutVectors.length) throw new Error("Embedding count does not match chunk count");
    const chunks = chunksWithoutVectors.map((chunk, index): RagChunkRecord => ({ ...chunk, embedding: vectors[index] ?? [] }));
    await this.store.replaceRepositoryChunks(input, chunks);

    const counts: Record<RagSourceType, number> = { repository: 0, readme: 0, hacker_news: 0 };
    for (const document of documents) counts[document.sourceType] += 1;
    return IngestRepositoryResultSchema.parse({
      repository: `${input.owner}/${input.name}`,
      chunks_stored: chunks.length,
      sources: counts,
    });
  }

  public async search(input: SemanticSearchInput): Promise<SemanticSearchResult> {
    const [queryEmbedding] = await this.embeddings.embed([input.query]);
    if (!queryEmbedding) throw new Error("Embedding provider did not return a query vector");
    const searchOptions = input.repository ? { repository: input.repository, limit: input.limit } : { limit: input.limit };
    const sources = await this.store.search(queryEmbedding, searchOptions);
    const answer = await this.answers.answer(input.query, sources);
    return SemanticSearchResultSchema.parse({ answer, sources });
  }
}
