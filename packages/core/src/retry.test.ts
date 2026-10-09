import { describe, expect, it, vi } from "vitest";
import { withRetry } from "./retry.js";

describe("withRetry", () => {
  it("uses safe defaults for successful operations", async () => {
    await expect(withRetry(async () => "default-ok")).resolves.toBe("default-ok");
  });

  it("returns after a later attempt succeeds", async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce(new Error("temporary"))
      .mockRejectedValueOnce(new Error("temporary"))
      .mockResolvedValue("ok");
    const attempts: number[] = [];
    await expect(withRetry(operation, { attempts: 3, baseDelayMs: 0, onAttempt: (attempt) => { attempts.push(attempt); } })).resolves.toBe("ok");
    expect(attempts).toEqual([1, 2, 3]);
  });

  it("throws the final error after the configured attempts", async () => {
    const operation = vi.fn().mockRejectedValue(new Error("still broken"));
    await expect(withRetry(operation, { attempts: 3, baseDelayMs: 0 })).rejects.toThrow("still broken");
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it("normalizes non-Error failures", async () => {
    await expect(withRetry(async () => { throw "plain failure"; }, { attempts: 1 })).rejects.toThrow("plain failure");
  });
});
