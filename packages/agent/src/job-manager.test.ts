import type { ResearchReport } from "@devscope/shared";
import { describe, expect, it, vi } from "vitest";
import { ResearchJobManager } from "./job-manager.js";

describe("ResearchJobManager", () => {
  it("tracks progress and completion", async () => {
    const run = vi.fn(async (runId: string, topic: string, progress: (event: { type: "phase"; message: string }) => void): Promise<ResearchReport> => {
      progress({ type: "phase", message: "collecting" });
      return {
        run_id: runId,
        topic,
        markdown: "x".repeat(120),
        sources: [{ kind: "github", title: "source", url: "https://github.com/acme/demo", retrieved_at: new Date().toISOString() }],
        report_path: `reports/${runId}.md`,
        generated_at: new Date().toISOString(),
      };
    });
    const manager = new ResearchJobManager({ run });
    const id = manager.start("Agent frameworks");
    await vi.waitFor(() => expect(manager.get(id)?.status).toBe("completed"));
    expect(manager.get(id)?.events).toMatchObject([{ id: 0, message: "collecting" }, { id: 1, type: "completed" }]);
  });

  it("records a failed run", async () => {
    const manager = new ResearchJobManager({ run: vi.fn().mockRejectedValue(new Error("model unavailable")) });
    const id = manager.start("Agent frameworks");
    await vi.waitFor(() => expect(manager.get(id)?.status).toBe("failed"));
    expect(manager.get(id)?.error).toContain("model unavailable");
    expect(manager.get(id)?.events.at(-1)?.type).toBe("error");
  });

  it("notifies subscribers and rejects invalid topics", async () => {
    let finish!: () => void;
    const gate = new Promise<void>((resolve) => { finish = resolve; });
    const run = vi.fn(async (runId: string, topic: string, progress: (event: { type: "phase"; message: string }) => void): Promise<ResearchReport> => {
      await gate;
      progress({ type: "phase", message: "working" });
      return {
        run_id: runId,
        topic,
        markdown: "x".repeat(120),
        sources: [{ kind: "github", title: "source", url: "https://github.com/acme/demo", retrieved_at: new Date().toISOString() }],
        report_path: `reports/${runId}.md`,
        generated_at: new Date().toISOString(),
      };
    });
    const manager = new ResearchJobManager({ run });
    expect(() => manager.start("x")).toThrow();
    expect(manager.get(crypto.randomUUID())).toBeNull();
    const id = manager.start("Agent frameworks");
    const listener = vi.fn();
    const unsubscribe = manager.subscribe(id, listener);
    finish();
    await vi.waitFor(() => expect(manager.get(id)?.status).toBe("completed"));
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ message: "working" }));
    unsubscribe();
  });
});
