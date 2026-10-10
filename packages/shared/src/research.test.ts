import { describe, expect, it } from "vitest";
import { ResearchEventSchema, ResearchReportSchema, ResearchStartInputSchema } from "./research.js";

describe("research contracts", () => {
  it("normalizes a valid research topic", () => {
    expect(ResearchStartInputSchema.parse({ topic: "  TypeScript Agent frameworks  " })).toEqual({
      topic: "TypeScript Agent frameworks",
    });
  });

  it("rejects invalid events and reports without traceable sources", () => {
    expect(() => ResearchEventSchema.parse({ id: -1 })).toThrow();
    expect(() => ResearchReportSchema.parse({
      run_id: crypto.randomUUID(),
      topic: "Agent frameworks",
      markdown: "x".repeat(120),
      sources: [],
      report_path: "reports/test.md",
      generated_at: new Date().toISOString(),
    })).toThrow();
  });
});
