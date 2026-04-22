import { EventEmitter } from "node:events";
import fs from "node:fs";
import type { TypeweaverConfig } from "@rexeus/typeweaver-gen";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FileWatcher } from "../src/generators/fileWatcher.js";
import { createTestLogger } from "./__helpers__/testLogger.js";
import type { GenerateSummary } from "../src/generationResult.js";
import type { Generator } from "../src/generators/generator.js";
import type { Logger } from "../src/logger.js";
import type { Mock } from "vitest";

class MockWatcher extends EventEmitter {
  public readonly close = vi.fn();
}

const generationSummary: GenerateSummary = {
  mode: "generate",
  dryRun: false,
  targetOutputDir: "/test/output",
  resourceCount: 1,
  operationCount: 1,
  responseCount: 1,
  pluginCount: 1,
  generatedFiles: ["index.ts"],
  warnings: [],
};

function createConfig(overrides?: Partial<TypeweaverConfig>): TypeweaverConfig {
  return {
    input: "/test/input/spec.ts",
    output: "/test/output",
    format: false,
    clean: true,
    ...overrides,
  };
}

describe("FileWatcher", () => {
  let mockWatcher: MockWatcher;
  let mockGenerate: Mock;
  let fileWatcher: FileWatcher;
  let activeWatchPromise: Promise<void> | null = null;
  let logger: Logger;

  const createGeneratorMock = () =>
    ({ generate: mockGenerate }) as unknown as Generator;

  const startWatching = async () => {
    activeWatchPromise = fileWatcher.watch();
    await vi.advanceTimersByTimeAsync(0);
  };

  const emitChange = (filename: string | null = "file.ts") => {
    mockWatcher.emit("change", "rename", filename);
  };

  const flushDebounce = () => vi.advanceTimersByTimeAsync(200);

  const blockNextGeneration = () => {
    let resolve!: (value: GenerateSummary) => void;
    mockGenerate.mockImplementationOnce(
      () =>
        new Promise<GenerateSummary>(promiseResolve => {
          resolve = promiseResolve;
        })
    );
    return { resolve: () => resolve(generationSummary) };
  };

  beforeEach(() => {
    vi.useFakeTimers();

    mockWatcher = new MockWatcher();
    vi.spyOn(fs, "watch").mockReturnValue(
      mockWatcher as unknown as fs.FSWatcher
    );

    mockGenerate = vi.fn().mockResolvedValue(generationSummary);
    logger = createTestLogger();

    fileWatcher = new FileWatcher(
      "/test/input/spec.ts",
      "/test/output",
      createConfig(),
      createGeneratorMock,
      logger
    );
  });

  afterEach(async () => {
    fileWatcher.stop();
    if (activeWatchPromise) await activeWatchPromise;
    activeWatchPromise = null;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  test("runs initial generation on watch start", async () => {
    await startWatching();

    expect(mockGenerate).toHaveBeenCalledTimes(1);
    expect(mockGenerate).toHaveBeenCalledWith(
      "/test/input/spec.ts",
      "/test/output",
      expect.objectContaining({ clean: true })
    );
  });

  test("debounces multiple rapid changes into single regeneration", async () => {
    await startWatching();

    emitChange("foo.ts");
    emitChange("bar.ts");
    emitChange("baz.ts");
    expect(mockGenerate).toHaveBeenCalledTimes(1);

    await flushDebounce();
    expect(mockGenerate).toHaveBeenCalledTimes(2);
  });

  test("ignores files with non-watched extensions", async () => {
    await startWatching();

    emitChange("readme.md");
    emitChange("image.png");
    emitChange("styles.css");
    await flushDebounce();

    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });

  test("triggers on all watched extensions", async () => {
    await startWatching();

    for (const ext of [".ts", ".js", ".json", ".mjs", ".cjs"]) {
      mockGenerate.mockClear();
      emitChange(`file${ext}`);
      await flushDebounce();
      expect(mockGenerate).toHaveBeenCalledTimes(1);
    }
  });

  test("does not ignore events whose filename has no detectable extension", async () => {
    await startWatching();

    // Covers both branches of `shouldIgnore`: a null filename (permission-denied
    // or kernel-coalesced event) and an extensionless filename (e.g. a directory
    // rename). Both must fall through to regeneration.
    emitChange(null);
    await flushDebounce();
    expect(mockGenerate).toHaveBeenCalledTimes(2);

    emitChange("new-directory");
    await flushDebounce();
    expect(mockGenerate).toHaveBeenCalledTimes(3);
  });

  test("recovers from generation errors and continues watching", async () => {
    await startWatching();

    mockGenerate.mockRejectedValueOnce(new Error("Syntax error"));
    emitChange("broken.ts");
    await flushDebounce();

    emitChange("fixed.ts");
    await flushDebounce();

    expect(mockGenerate).toHaveBeenCalledTimes(3);
    expect(logger.error).toHaveBeenCalled();
  });

  test("queues rebuild when change arrives during generation", async () => {
    await startWatching();

    const pending = blockNextGeneration();
    emitChange("first.ts");
    await flushDebounce();
    expect(mockGenerate).toHaveBeenCalledTimes(2);

    emitChange("second.ts");
    await flushDebounce();
    expect(mockGenerate).toHaveBeenCalledTimes(2);

    pending.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(mockGenerate).toHaveBeenCalledTimes(3);
  });

  test("disables clean on rebuilds", async () => {
    await startWatching();

    expect(mockGenerate).toHaveBeenCalledWith(
      "/test/input/spec.ts",
      "/test/output",
      expect.objectContaining({ clean: true })
    );

    emitChange("update.ts");
    await flushDebounce();

    expect(mockGenerate).toHaveBeenLastCalledWith(
      "/test/input/spec.ts",
      "/test/output",
      expect.objectContaining({ clean: false })
    );
  });

  test("respects --no-clean on initial run", async () => {
    fileWatcher = new FileWatcher(
      "/test/input/spec.ts",
      "/test/output",
      createConfig({ clean: false }),
      createGeneratorMock,
      logger
    );

    await startWatching();

    expect(mockGenerate).toHaveBeenCalledWith(
      "/test/input/spec.ts",
      "/test/output",
      expect.objectContaining({ clean: false })
    );
  });

  test("watches parent directory derived from input file path", async () => {
    await startWatching();

    expect(fs.watch).toHaveBeenCalledTimes(1);
    expect(fs.watch).toHaveBeenCalledWith("/test/input", { recursive: true });
  });

  test("closes all watchers on stop", async () => {
    await startWatching();

    fileWatcher.stop();

    expect(mockWatcher.close).toHaveBeenCalledTimes(1);
  });

  test("clears pending debounce timer on stop", async () => {
    await startWatching();

    emitChange("pending.ts");
    fileWatcher.stop();

    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });

  test("skips queued rebuild when stopped during generation", async () => {
    await startWatching();

    const pending = blockNextGeneration();
    emitChange("first.ts");
    await flushDebounce();

    emitChange("second.ts");
    await flushDebounce();

    fileWatcher.stop();
    pending.resolve();
    await vi.advanceTimersByTimeAsync(0);

    expect(mockGenerate).toHaveBeenCalledTimes(2);
  });

  test("ignores change events that arrive after stop()", async () => {
    await startWatching();
    fileWatcher.stop();

    emitChange("late.ts");
    await flushDebounce();

    // 1 = the initial generation; the post-stop change must not schedule another.
    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });
});
