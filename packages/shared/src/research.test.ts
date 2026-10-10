import { describe, expect, it } from "vitest";
import { ResearchReviewInputSchema, ResearchRunSchema } from "./research.js";

describe("research schemas", () => {
  it("requires guidance when the user adjusts the research direction", () => {
    const runId = "00000000-0000-4000-8000-000000000001";
    expect(() => ResearchReviewInputSchema.parse({ run_id: runId, action: "adjust" })).toThrow();
    expect(ResearchReviewInputSchema.parse({ run_id: runId, action: "adjust", guidance: "关注部署成本" })).toMatchObject({ action: "adjust" });
  });

  it("accepts a persisted human-review checkpoint", () => {
    const timestamp = "2026-01-01T00:00:00.000Z";
    expect(ResearchRunSchema.parse({
      id: "00000000-0000-4000-8000-000000000001",
      topic: "Agent frameworks",
      status: "awaiting_review",
      events: [],
      checkpoint: {
        plan: "Collect two evidence streams and compare the strongest candidates.",
        summary: "Evidence-backed intermediate research. ".repeat(5),
        agents: ["orchestrator", "fetch", "community", "competitor"],
        sources: [{ kind: "github", title: "source", url: "https://github.com/acme/demo", retrieved_at: timestamp }],
        collected_at: timestamp,
      },
      created_at: timestamp,
    }).status).toBe("awaiting_review");
  });
});
