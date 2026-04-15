import { describe, expect, test, vi } from "vitest";
import type { GenerationSummary } from "../src/generationResult.js";
import { createLogger } from "../src/logger.js";

const summary: GenerationSummary = {
  mode: "generate",
  dryRun: true,
  targetOutputDir: "/tmp/generated",
  resourceCount: 2,
  operationCount: 3,
  responseCount: 4,
  pluginCount: 1,
  generatedFiles: ["index.ts", "todo/GetTodoRequest.ts"],
  warnings: ["formatter missing"],
};

describe("logger", () => {
  test("suppresses info output in quiet mode but still shows errors", () => {
    const stdout = { isTTY: false, write: vi.fn() };
    const stderr = { isTTY: false, write: vi.fn() };
    const logger = createLogger({ quiet: true, stdout, stderr });

    logger.info("hello");
    logger.error("boom");

    expect(stdout.write).not.toHaveBeenCalled();
    expect(stderr.write).toHaveBeenCalledWith("✖ boom\n");
  });

  test("only emits debug lines in verbose mode", () => {
    const stderr = { isTTY: false, write: vi.fn() };
    const quietLogger = createLogger({ stderr, stdout: stderr });
    const verboseLogger = createLogger({ verbose: true, stderr, stdout: stderr });

    quietLogger.debug("hidden");
    verboseLogger.debug("visible");

    expect(stderr.write).toHaveBeenCalledTimes(1);
    expect(stderr.write).toHaveBeenCalledWith("debug visible\n");
  });

  test("prints verbose summary details with generated files", () => {
    const stdout = { isTTY: false, write: vi.fn() };
    const logger = createLogger({ verbose: true, stdout, stderr: stdout });

    logger.summary(summary);

    expect(stdout.write).toHaveBeenCalledWith(
      "Summary Generated (dry run): 2 resource(s), 3 operation(s), 4 response(s), 2 file(s), 1 plugin(s)\n"
    );
    expect(stdout.write).toHaveBeenCalledWith("  output: /tmp/generated\n");
    expect(stdout.write).toHaveBeenCalledWith("  warnings: 1\n");
    expect(stdout.write).toHaveBeenCalledWith("  ! formatter missing\n");
    expect(stdout.write).toHaveBeenCalledWith("  - index.ts\n");
    expect(stdout.write).toHaveBeenCalledWith(
      "  - todo/GetTodoRequest.ts\n"
    );
  });

  test("prints doctor summary counts", () => {
    const stdout = { isTTY: false, write: vi.fn() };
    const logger = createLogger({ stdout, stderr: stdout });

    logger.summary({
      mode: "doctor",
      dryRun: false,
      targetConfigPath: "/tmp/typeweaver.config.mjs",
      totalChecks: 10,
      passedChecks: 8,
      warnedChecks: 1,
      failedChecks: 0,
      skippedChecks: 1,
      resourceCount: 0,
      operationCount: 0,
      responseCount: 0,
      pluginCount: 0,
      generatedFiles: [],
      warnings: [],
    });

    expect(stdout.write).toHaveBeenCalledWith(
      "Summary Doctor: 8 passed, 1 warned, 0 failed, 1 skipped (10 total)\n"
    );
    expect(stdout.write).toHaveBeenCalledWith(
      "  config: /tmp/typeweaver.config.mjs\n"
    );
  });
});
