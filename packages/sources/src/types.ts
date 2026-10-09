import type { RagSourceType, RepositoryTarget } from "@devscope/shared";

export interface SourceDocument {
  sourceType: RagSourceType;
  title: string;
  url: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface RepositorySourceCollector {
  collect(target: RepositoryTarget): Promise<SourceDocument[]>;
}
