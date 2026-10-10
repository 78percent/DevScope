import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FileReportWriter } from "./report-writer.js";

describe("FileReportWriter", () => {
  it("writes a report into the configured directory", async () => {
    const directory = await mkdtemp(join(tmpdir(), "devscope-report-"));
    const path = await new FileReportWriter(directory).write("run-id", "# Report");
    expect(path).toContain("run-id.md");
    await expect(readFile(join(directory, "run-id.md"), "utf8")).resolves.toBe("# Report");
  });
});
