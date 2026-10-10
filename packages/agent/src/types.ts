import type { ResearchEventType, ResearchSource } from "@devscope/shared";

export interface ResearchProgress {
  type: ResearchEventType;
  message: string;
  data?: unknown;
}

export type ResearchProgressHandler = (event: ResearchProgress) => void;

export interface ResearchToolSession {
  server: unknown;
  sources: ResearchSource[];
}

export interface ResearchToolFactory {
  create(onProgress: ResearchProgressHandler): ResearchToolSession;
}
