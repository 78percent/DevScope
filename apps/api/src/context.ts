import type { RepositoryAnalyzer } from "@devscope/ai";
import type { RagService } from "@devscope/core";
import type { WorkflowService } from "@devscope/core";

export interface ApiContext {
  analyzer: RepositoryAnalyzer;
  rag?: RagService;
  workflow?: WorkflowService;
}
