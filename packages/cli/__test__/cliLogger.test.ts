import { Effect, Logger, LogLevel } from "effect";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { CliLoggerLayer, VerboseCliLoggerLayer } from "../src/cliLogger.js";

const runWithCliLogger = (effect: Effect.Effect<void>): Promise<void> =>
  Effect.runPromise(effect.pipe(Effect.provide(CliLoggerLayer)));

const runWithVerboseCliLogger = (effect: Effect.Effect<void>): Promise<void> =>
  Effect.runPromise(
    effect.pipe(
      Effect.provide(VerboseCliLoggerLayer),
      Logger.withMinimumLogLevel(LogLevel.Debug)
    )
  );

describe("cliLogger", () => {
  beforeEach(() => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("writes an Info-level string message to console.info without a level prefix", async () => {
    await runWithCliLogger(Effect.logInfo("Generation complete"));

    expect(vi.mocked(console.info)).toHaveBeenCalledWith("Generation complete");
    expect(vi.mocked(console.warn)).not.toHaveBeenCalled();
    expect(vi.mocked(console.error)).not.toHaveBeenCalled();
  });

  test("joins an Info-level array message with single spaces", async () => {
    await runWithCliLogger(Effect.logInfo("Generated", "42", "files"));

    expect(vi.mocked(console.info)).toHaveBeenCalledWith("Generated 42 files");
  });

  test("prefixes a Warning-level message with [WARN] and routes it to console.warn", async () => {
    await runWithCliLogger(Effect.logWarning("Plugin override detected"));

    expect(vi.mocked(console.warn)).toHaveBeenCalledWith(
      "[WARN] Plugin override detected"
    );
    expect(vi.mocked(console.info)).not.toHaveBeenCalled();
    expect(vi.mocked(console.error)).not.toHaveBeenCalled();
  });

  test("prefixes an Error-level message with [ERROR] and routes it to console.error", async () => {
    await runWithCliLogger(Effect.logError("Generation failed"));

    expect(vi.mocked(console.error)).toHaveBeenCalledWith(
      "[ERROR] Generation failed"
    );
    expect(vi.mocked(console.info)).not.toHaveBeenCalled();
    expect(vi.mocked(console.warn)).not.toHaveBeenCalled();
  });

  test("treats a Fatal-level message the same as Error and routes it to console.error", async () => {
    await runWithCliLogger(Effect.logFatal("Unrecoverable error"));

    expect(vi.mocked(console.error)).toHaveBeenCalledWith(
      "[ERROR] Unrecoverable error"
    );
    expect(vi.mocked(console.info)).not.toHaveBeenCalled();
    expect(vi.mocked(console.warn)).not.toHaveBeenCalled();
  });
});

describe("verboseCliLogger", () => {
  beforeEach(() => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("prefixes a Debug-level message with [DEBUG] and routes it to console.info", async () => {
    await runWithVerboseCliLogger(Effect.logDebug("Acquired output lock"));

    expect(vi.mocked(console.info)).toHaveBeenCalledWith(
      "[DEBUG] Acquired output lock"
    );
    expect(vi.mocked(console.warn)).not.toHaveBeenCalled();
    expect(vi.mocked(console.error)).not.toHaveBeenCalled();
  });

  test("emits an Info-level message without the [DEBUG] tag", async () => {
    await runWithVerboseCliLogger(Effect.logInfo("Starting generation"));

    expect(vi.mocked(console.info)).toHaveBeenCalledWith("Starting generation");
  });
});
