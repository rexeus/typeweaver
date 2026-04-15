import { afterEach, describe, expect, test, vi } from "vitest";
import type { GenerationSummary } from "../src/generationResult.js";
import { handleGenerateCommand } from "../src/commands/generate.js";
import type { Logger } from "../src/logger.js";

const { loadConfigMock } = vi.hoisted(() => ({
  loadConfigMock: vi.fn(),
}));

vi.mock("../src/configLoader.js", async importOriginal => {
  const actual = await importOriginal<typeof import("../src/configLoader.js")>();

  return {
    ...actual,
    loadConfig: loadConfigMock,
  };
});

const createLogger = (): Logger => {
  return {
    isVerbose: false,
    debug: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    step: vi.fn(),
    summary: vi.fn(),
  };
};

const summary: GenerationSummary = {
  mode: "generate",
  dryRun: false,
  targetOutputDir: "/workspace/generated",
  resourceCount: 1,
  operationCount: 2,
  responseCount: 3,
  pluginCount: 1,
  generatedFiles: ["index.ts"],
  warnings: [],
};

describe("handleGenerateCommand", () => {
  afterEach(() => {
    vi.clearAllMocks();
    process.exitCode = undefined;
  });

  test("passes dry-run through to the generator and logs the summary", async () => {
    const logger = createLogger();
    const generate = vi.fn().mockResolvedValue({ ...summary, dryRun: true });

    const result = await handleGenerateCommand(
      {
        input: "spec/index.ts",
        output: "generated",
        dryRun: true,
      },
      {
        execDir: "/workspace",
        createLogger: () => logger,
        createGenerator: () => ({ generate }) as never,
      }
    );

    expect(generate).toHaveBeenCalledWith(
      "/workspace/spec/index.ts",
      "/workspace/generated",
      expect.objectContaining({ dryRun: true }),
      "/workspace"
    );
    expect(result).toEqual(expect.objectContaining({ dryRun: true }));
    expect(logger.summary).toHaveBeenCalledWith(
      expect.objectContaining({ dryRun: true })
    );
  });

  test("branches to watch mode instead of generation when requested", async () => {
    const logger = createLogger();
    const watch = vi.fn().mockResolvedValue(undefined);
    const generate = vi.fn();

    const result = await handleGenerateCommand(
      {
        input: "spec/index.ts",
        output: "generated",
        watch: true,
      },
      {
        execDir: "/workspace",
        createLogger: () => logger,
        createGenerator: () => ({ generate }) as never,
        createWatcher: () => ({ watch }) as never,
      }
    );

    expect(watch).toHaveBeenCalledTimes(1);
    expect(generate).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  test("rejects combining dry-run with watch clearly", async () => {
    const logger = createLogger();
    const watch = vi.fn();

    const result = await handleGenerateCommand(
      {
        input: "spec/index.ts",
        output: "generated",
        dryRun: true,
        watch: true,
      },
      {
        execDir: "/workspace",
        createLogger: () => logger,
        createWatcher: () => ({ watch }) as never,
      }
    );

    expect(result).toBeUndefined();
    expect(watch).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      "Cannot combine --dry-run with --watch. Dry-run is a one-time preview mode; rerun without --dry-run to watch and regenerate files."
    );
    expect(process.exitCode).toBe(1);
  });

  test("fails clearly when required arguments are missing", async () => {
    const logger = createLogger();

    await handleGenerateCommand(
      { output: "generated" },
      {
        execDir: "/workspace",
        createLogger: () => logger,
      }
    );

    expect(logger.error).toHaveBeenCalledWith(
      "No input spec entrypoint provided. Use --input or specify it in a config file."
    );
    expect(process.exitCode).toBe(1);
  });

  test("loads config and lets CLI options override config values", async () => {
    const logger = createLogger();
    const generate = vi.fn().mockResolvedValue(summary);

    loadConfigMock.mockResolvedValueOnce({
      input: "config/spec.ts",
      output: "config/generated",
      clean: false,
      format: false,
      plugins: ["clients"],
    });

    await handleGenerateCommand(
      {
        config: "typeweaver.config.mjs",
        output: "cli/generated",
        plugins: "hono,clients",
      },
      {
        execDir: "/workspace",
        createLogger: () => logger,
        createGenerator: () => ({ generate }) as never,
      }
    );

    expect(loadConfigMock).toHaveBeenCalledWith(
      "/workspace/typeweaver.config.mjs"
    );
    expect(logger.info).toHaveBeenCalledWith(
      "Loaded configuration from /workspace/typeweaver.config.mjs"
    );
    expect(generate).toHaveBeenCalledWith(
      "/workspace/config/spec.ts",
      "/workspace/cli/generated",
      expect.objectContaining({
        format: false,
        clean: false,
        plugins: ["hono", "clients"],
      }),
      "/workspace"
    );
  });
});
