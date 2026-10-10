import type { RepositoryAnalyzer } from "@devscope/ai";
import type { ResearchJobManager } from "@devscope/agent";
import type { RagService } from "@devscope/core";
import type { WorkflowService } from "@devscope/core";

export interface ApiContext {
  analyzer: RepositoryAnalyzer;
  rag?: RagService;
  workflow?: WorkflowService;
  research?: Pick<ResearchJobManager, "start" | "get">;
}
