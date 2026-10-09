import { describe, expect, it, vi } from "vitest";
import type { CliRepositorySource } from "@devscope/sources";
import { fetchRepository, parseFetchArguments } from "./index.js";

describe("repo-fetch", () => {
  it("parses a positional repository and optional flags", () => {
    expect(parseFetchArguments(["acme/demo", "--include-issues"])).toEqual({ reference: "acme/demo", options: { include_issues: true, include_commits: false } });
    expect(parseFetchArguments(["--include-commits"])).toEqual({ options: { include_issues: false, include_commits: true } });
  });

  it("validates the repository before delegating", async () => {
    const source = { fetch: vi.fn() } as unknown as CliRepositorySource;
    await expect(fetchRepository(source, "invalid", { include_issues: false, include_commits: false })).rejects.toThrow("owner/repo");
    expect(source.fetch).not.toHaveBeenCalled();
  });
});
