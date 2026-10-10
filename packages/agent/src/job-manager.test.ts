import type { ResearchCheckpoint, ResearchReport } from "@devscope/shared";
import { describe, expect, it, vi } from "vitest";
import { ResearchJobManager } from "./job-manager.js";

const checkpoint: ResearchCheckpoint = {
  plan: "Collect repository and community evidence, then compare candidates.",
  summary: "Evidence-backed intermediate analysis. ".repeat(5),
  agents: ["orchestrator", "fetch", "community", "competitor"],
  sources: [{ kind: "github", title: "source", url: "https://github.com/acme/demo", retrieved_at: "2026-01-01T00:00:00.000Z" }],
  collected_at: "2026-01-01T00:00:00.000Z",
};

function report(runId: string, topic: string): ResearchReport {
  return {
    run_id: runId,
    topic,
    markdown: "Final evidence-backed report. ".repeat(5),
    sources: checkpoint.sources,
    report_path: `reports/${runId}.md`,
    generated_at: new Date().toISOString(),
  };
}

describe("ResearchJobManager", () => {
  it("pauses for review and completes only after confirmation", async () => {
    const collect = vi.fn(async (_runId: string, _topic: string, progress: (event: { type: "phase"; message: string }) => void) => {
      progress({ type: "phase", message: "collecting" });
      return checkpoint;
    });
    const generateReport = vi.fn(async (runId: string, topic: string) => report(runId, topic));
    const manager = new ResearchJobManager({ collect, generateReport });
    const id = await manager.start("Agent frameworks");
    await vi.waitFor(async () => expect((await manager.get(id))?.status).toBe("awaiting_review"));
    expect((await manager.get(id))?.events.at(-1)?.type).toBe("awaiting_review");

    await manager.review({ run_id: id, action: "continue" });
    await vi.waitFor(async () => expect((await manager.get(id))?.status).toBe("completed"));
    expect(generateReport).toHaveBeenCalledOnce();
    expect((await manager.get(id))?.report?.report_path).toContain(id);
  });

  it("passes adjustment guidance to the report worker", async () => {
    let receivedGuidance: string | undefined;
    const generateReport = vi.fn(async (runId: string, topic: string, _checkpoint: ResearchCheckpoint, guidance: string | undefined) => {
      receivedGuidance = guidance;
      return report(runId, topic);
    });
    const manager = new ResearchJobManager({ collect: vi.fn().mockResolvedValue(checkpoint), generateReport });
    const id = await manager.start("Agent frameworks");
    await vi.waitFor(async () => expect((await manager.get(id))?.status).toBe("awaiting_review"));
    await manager.review({ run_id: id, action: "adjust", guidance: "Focus on deployment cost" });
    await vi.waitFor(() => expect(generateReport).toHaveBeenCalled());
    expect(receivedGuidance).toBe("Focus on deployment cost");
  });

  it("can stop at the human review checkpoint", async () => {
    const generateReport = vi.fn();
    const manager = new ResearchJobManager({ collect: vi.fn().mockResolvedValue(checkpoint), generateReport });
    const id = await manager.start("Agent frameworks");
    await vi.waitFor(async () => expect((await manager.get(id))?.status).toBe("awaiting_review"));
    await manager.review({ run_id: id, action: "stop" });
    expect((await manager.get(id))?.status).toBe("cancelled");
    expect(generateReport).not.toHaveBeenCalled();
  });

  it("records collection failures", async () => {
    const manager = new ResearchJobManager({ collect: vi.fn().mockRejectedValue(new Error("model unavailable")), generateReport: vi.fn() });
    const id = await manager.start("Agent frameworks");
    await vi.waitFor(async () => expect((await manager.get(id))?.status).toBe("failed"));
    expect((await manager.get(id))?.error).toContain("model unavailable");
  });
});
