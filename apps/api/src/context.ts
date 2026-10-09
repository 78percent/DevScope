import type { RepositoryAnalyzer } from "@devscope/ai";
import type { RagService } from "@devscope/core";

export interface ApiContext {
  analyzer: RepositoryAnalyzer;
  rag?: RagService;
}
