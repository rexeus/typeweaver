import { afterEach, describe, expect, test, vi } from "vitest";
import { handleGenerateCommand } from "../src/commands/generate.js";
import { createTestLogger } from "./__helpers__/testLogger.js";
import type { GenerateSummary } from "../src/generationResult.js";
import type { ValidationReport } from "../src/validate/index.js";

const { loadConfigMock } = vi.hoisted(() => ({
  loadConfigMock: vi.fn(),
}));

vi.mock("../src/configLoader.js", async importOriginal => {
  const actual =
    await importOriginal<typeof import("../src/configLoader.js")>();

  return {
    ...actual,
    loadConfig: loadConfigMock,
  };
});

const createCleanPreflightReport = (): ValidationReport => ({
  checks: [],
  issues: [],
  stats: {
    errors: 0,
    warnings: 0,
    infos: 0,
    resources: 0,
    operations: 0,
    responses: 0,
  },
  hasErrors: false,
  failOn: "error",
});

const passingPreflight = (): Promise<ValidationReport> =>
  Promise.resolve(createCleanPreflightReport());

const createFailingPreflightReport = (
  message: string = "boom"
): ValidationReport => ({
  checks: [],
  issues: [{ code: "TW-SPEC-001", severity: "error", message }],
  stats: {
    errors: 1,
    warnings: 0,
    infos: 0,
    resources: 0,
    operations: 0,
    responses: 0,
  },
  hasErrors: true,
  failOn: "error",
});

const summary: GenerateSummary = {
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
    const logger = createTestLogger();
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
        runPreflight: passingPreflight,
      }
    );

    expect(generate).toHaveBeenCalledWith(
      "/workspace/spec/index.ts",
      "/workspace/generated",
      expect.objectContaining({ dryRun: true }),
      "/workspace"
    );
    expect(result).toEqual({
      kind: "once",
      summary: expect.objectContaining({ dryRun: true }),
    });
    expect(logger.summary).toHaveBeenCalledWith(
      expect.objectContaining({ dryRun: true })
    );
  });

  test("branches to watch mode instead of generation when requested", async () => {
    const logger = createTestLogger();
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
        runPreflight: passingPreflight,
      }
    );

    expect(watch).toHaveBeenCalledTimes(1);
    expect(generate).not.toHaveBeenCalled();
    expect(result).toEqual({ kind: "watch" });
  });

  test("rejects combining dry-run with watch", async () => {
    const logger = createTestLogger();
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

  test("aborts before running the generator when preflight reports errors", async () => {
    const logger = createTestLogger();
    const generate = vi.fn();
    const runPreflight = vi
      .fn()
      .mockResolvedValue(createFailingPreflightReport());

    const result = await handleGenerateCommand(
      {
        input: "spec/index.ts",
        output: "generated",
      },
      {
        execDir: "/workspace",
        createLogger: () => logger,
        createGenerator: () => ({ generate }) as never,
        runPreflight,
      }
    );

    expect(runPreflight).toHaveBeenCalledTimes(1);
    expect(generate).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
    expect(process.exitCode).toBe(1);
    expect(logger.error).toHaveBeenCalledWith(
      "Spec validation failed. Fix the issues above or run 'typeweaver validate' for details."
    );
  });

  test("fails when required arguments are missing", async () => {
    const logger = createTestLogger();

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
    const logger = createTestLogger();
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
        runPreflight: passingPreflight,
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
