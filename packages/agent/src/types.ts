import type {
  ResearchCheckpoint,
  ResearchEventType,
  ResearchReport,
  ResearchRun,
  ResearchSource,
} from "@devscope/shared";

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

export interface ResearchStore {
  create(run: ResearchRun): Promise<void>;
  save(run: ResearchRun): Promise<void>;
  get(runId: string): Promise<ResearchRun | null>;
  list(limit: number): Promise<ResearchRun[]>;
}

export interface ResearchWorker {
  collect(runId: string, topic: string, onProgress: ResearchProgressHandler): Promise<ResearchCheckpoint>;
  generateReport(
    runId: string,
    topic: string,
    checkpoint: ResearchCheckpoint,
    guidance: string | undefined,
    onProgress: ResearchProgressHandler,
  ): Promise<ResearchReport>;
}
