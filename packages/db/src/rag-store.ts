import { and, cosineDistance, desc, eq, gte, sql } from "drizzle-orm";
import type { RagSearchSource, RagSourceType, RepositoryTarget } from "@devscope/shared";
import type { createDatabase } from "./client.js";
import { repoEmbeddings, repositories } from "./schema.js";

type Database = ReturnType<typeof createDatabase>["db"];

export interface RagChunkRecord {
  sourceType: RagSourceType;
  title: string;
  content: string;
  sourceUrl: string;
  metadata?: Record<string, unknown>;
  embedding: number[];
}

export interface RagStore {
  replaceRepositoryChunks(target: RepositoryTarget, chunks: RagChunkRecord[]): Promise<void>;
  search(queryEmbedding: number[], options: { repository?: RepositoryTarget; limit: number; minimumSimilarity?: number }): Promise<RagSearchSource[]>;
}

export class PostgresRagStore implements RagStore {
  public constructor(private readonly db: Database) {}

  public async replaceRepositoryChunks(target: RepositoryTarget, chunks: RagChunkRecord[]): Promise<void> {
    const url = `https://github.com/${target.owner}/${target.name}`;
    await this.db.transaction(async (tx) => {
      const [repository] = await tx.insert(repositories).values({ owner: target.owner, name: target.name, url })
        .onConflictDoUpdate({ target: repositories.url, set: { owner: target.owner, name: target.name } })
        .returning({ id: repositories.id });
      if (!repository) throw new Error("Repository upsert did not return an id");
      await tx.delete(repoEmbeddings).where(eq(repoEmbeddings.repositoryId, repository.id));
      if (chunks.length > 0) {
        await tx.insert(repoEmbeddings).values(chunks.map((chunk) => ({
          repositoryId: repository.id,
          sourceType: chunk.sourceType,
          title: chunk.title,
          content: chunk.content,
          sourceUrl: chunk.sourceUrl,
          metadata: chunk.metadata ?? {},
          embedding: chunk.embedding,
        })));
      }
    });
  }

  public async search(queryEmbedding: number[], options: { repository?: RepositoryTarget; limit: number; minimumSimilarity?: number }): Promise<RagSearchSource[]> {
    const similarity = sql<number>`1 - (${cosineDistance(repoEmbeddings.embedding, queryEmbedding)})`;
    const repositoryFilter = options.repository
      ? and(eq(repositories.owner, options.repository.owner), eq(repositories.name, options.repository.name))
      : undefined;
    const rows = await this.db.select({
      id: repoEmbeddings.id,
      sourceType: repoEmbeddings.sourceType,
      title: repoEmbeddings.title,
      url: repoEmbeddings.sourceUrl,
      content: repoEmbeddings.content,
      similarity,
    }).from(repoEmbeddings)
      .innerJoin(repositories, eq(repoEmbeddings.repositoryId, repositories.id))
      .where(and(gte(similarity, options.minimumSimilarity ?? 0.2), repositoryFilter))
      .orderBy(desc(similarity))
      .limit(options.limit);

    return rows.map((row) => ({
      id: row.id,
      source_type: row.sourceType,
      title: row.title,
      url: row.url,
      content: row.content,
      similarity: Number(row.similarity),
    }));
  }
}
