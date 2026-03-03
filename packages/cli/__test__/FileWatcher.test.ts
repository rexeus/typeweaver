import { EventEmitter } from "node:events";
import fs from "node:fs";
import type { TypeweaverConfig } from "@rexeus/typeweaver-gen";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FileWatcher } from "../src/generators/FileWatcher";
import type { Generator } from "../src/generators/Generator";
import type { Mock } from "vitest";

class MockWatcher extends EventEmitter {
  public readonly close = vi.fn();
}

function createConfig(overrides?: Partial<TypeweaverConfig>): TypeweaverConfig {
  return {
    input: "/test/input",
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
    let resolve!: () => void;
    mockGenerate.mockImplementationOnce(
      () => new Promise<void>(r => { resolve = r; })
    );
    return { resolve: () => resolve() };
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, "info").mockImplementation(() => {});

    mockWatcher = new MockWatcher();
    vi.spyOn(fs, "watch").mockReturnValue(
      mockWatcher as unknown as fs.FSWatcher
    );

    mockGenerate = vi.fn().mockResolvedValue(undefined);

    fileWatcher = new FileWatcher(
      "/test/input",
      "/test/output",
      createConfig(),
      createGeneratorMock
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
      "/test/input",
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

  test("triggers regeneration on null filenames", async () => {
    await startWatching();

    emitChange(null);
    await flushDebounce();

    expect(mockGenerate).toHaveBeenCalledTimes(2);
  });

  test("triggers regeneration on extensionless filenames", async () => {
    await startWatching();

    emitChange("new-directory");
    await flushDebounce();

    expect(mockGenerate).toHaveBeenCalledTimes(2);
  });

  test("recovers from generation errors and continues watching", async () => {
    await startWatching();

    mockGenerate.mockRejectedValueOnce(new Error("Syntax error"));
    emitChange("broken.ts");
    await flushDebounce();

    emitChange("fixed.ts");
    await flushDebounce();

    expect(mockGenerate).toHaveBeenCalledTimes(3);
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
      "/test/input",
      "/test/output",
      expect.objectContaining({ clean: true })
    );

    emitChange("update.ts");
    await flushDebounce();

    expect(mockGenerate).toHaveBeenLastCalledWith(
      "/test/input",
      "/test/output",
      expect.objectContaining({ clean: false })
    );
  });

  test("respects --no-clean on initial run", async () => {
    fileWatcher = new FileWatcher(
      "/test/input",
      "/test/output",
      createConfig({ clean: false }),
      createGeneratorMock
    );

    await startWatching();

    expect(mockGenerate).toHaveBeenCalledWith(
      "/test/input",
      "/test/output",
      expect.objectContaining({ clean: false })
    );
  });

  test("watches shared directory when outside input", async () => {
    const secondMockWatcher = new MockWatcher();
    vi.mocked(fs.watch)
      .mockReturnValueOnce(mockWatcher as unknown as fs.FSWatcher)
      .mockReturnValueOnce(secondMockWatcher as unknown as fs.FSWatcher);

    fileWatcher = new FileWatcher(
      "/test/input",
      "/test/output",
      createConfig({ shared: "/external/shared" }),
      createGeneratorMock
    );

    await startWatching();

    expect(fs.watch).toHaveBeenCalledTimes(2);
    expect(fs.watch).toHaveBeenCalledWith("/test/input", { recursive: true });
    expect(fs.watch).toHaveBeenCalledWith("/external/shared", {
      recursive: true,
    });
  });

  test("does not create extra watcher when shared is inside input", async () => {
    fileWatcher = new FileWatcher(
      "/test/input",
      "/test/output",
      createConfig({ shared: "/test/input/shared" }),
      createGeneratorMock
    );

    await startWatching();

    expect(fs.watch).toHaveBeenCalledTimes(1);
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
});
