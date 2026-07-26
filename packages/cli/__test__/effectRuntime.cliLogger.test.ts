import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { effectRuntime } from "../src/effectRuntime.js";

describe("effectRuntime threads CliLoggerLayer end-to-end", () => {
  beforeEach(() => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("writes Effect.logInfo through the production runtime to console.info without timestamp or level prefix", async () => {
    await effectRuntime.runPromise(Effect.logInfo("ping"));

    expect(vi.mocked(console.info)).toHaveBeenCalledWith("ping");
    const callArgs = vi.mocked(console.info).mock.calls.flat().join(" ");
    expect(callArgs).not.toMatch(/timestamp=/);
    expect(callArgs).not.toMatch(/level=INFO/);
  });

  test("writes Effect.logWarning through the production runtime with the [WARN] prefix", async () => {
    await effectRuntime.runPromise(Effect.logWarning("careful"));

    expect(vi.mocked(console.warn)).toHaveBeenCalledWith("[WARN] careful");
    expect(vi.mocked(console.info)).not.toHaveBeenCalled();
  });
});
