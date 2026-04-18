import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, test, vi } from "vitest";
import { handleGenerateCommand } from "../src/commands/generate.js";
import { handleInitCommand } from "../src/commands/init.js";
import { handleValidateCommand } from "../src/commands/validate.js";
import { TYPEWEAVER_CONFIG_FILE } from "../src/templates/typeweaverConfigTemplate.js";
import { createTempDirFactory } from "./__helpers__/tempDir.js";
import { createTestLogger } from "./__helpers__/testLogger.js";

// Init fixtures live inside the CLI package so pnpm-workspace module
// resolution picks up `@rexeus/typeweaver-core` during the init→generate flow.
const PACKAGE_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

describe("handleInitCommand", () => {
  const createWorkspaceTempDir = createTempDirFactory(
    ".tmp-init-",
    PACKAGE_DIR
  );

  afterEach(() => {
    vi.clearAllMocks();
    process.exitCode = undefined;
  });

  test("writes a starter spec and config with the requested plugins", async () => {
    const tempDir = createWorkspaceTempDir();
    const logger = createTestLogger();

    const summary = await handleInitCommand(
      {
        output: "api/generated",
        plugins: "clients,hono",
      },
      {
        execDir: tempDir,
        createLogger: () => logger,
      }
    );

    expect(summary).toEqual(
      expect.objectContaining({
        mode: "init",
        targetOutputDir: "api/generated",
        pluginCount: 2,
        resourceCount: 1,
        operationCount: 3,
      })
    );
    expect(fs.existsSync(path.join(tempDir, "spec/index.ts"))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, "spec/README.md"))).toBe(true);
    expect(
      fs.existsSync(path.join(tempDir, "spec/shared/defaultRequestHeader.ts"))
    ).toBe(true);
    expect(
      fs.readFileSync(path.join(tempDir, TYPEWEAVER_CONFIG_FILE), "utf-8")
    ).toContain('output: "./api/generated"');
    expect(
      fs.readFileSync(path.join(tempDir, TYPEWEAVER_CONFIG_FILE), "utf-8")
    ).toContain('plugins: ["clients", "hono"]');
    expect(logger.summary).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "init" })
    );
  });

  test("refuses to overwrite existing starter files unless forced", async () => {
    const tempDir = createWorkspaceTempDir();
    const logger = createTestLogger();

    fs.mkdirSync(path.join(tempDir, "spec"), { recursive: true });

    const summary = await handleInitCommand(
      {},
      {
        execDir: tempDir,
        createLogger: () => logger,
      }
    );

    expect(summary).toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("Refusing to write into existing")
    );
    expect(process.exitCode).toBe(1);
  });

  test("overwrites starter files when force is enabled", async () => {
    const tempDir = createWorkspaceTempDir();
    const logger = createTestLogger();

    fs.mkdirSync(path.join(tempDir, "spec"), { recursive: true });
    fs.writeFileSync(
      path.join(tempDir, TYPEWEAVER_CONFIG_FILE),
      "export default {};\n"
    );
    fs.writeFileSync(
      path.join(tempDir, "spec/index.ts"),
      "export const broken = true;\n"
    );

    await handleInitCommand(
      {
        force: true,
      },
      {
        execDir: tempDir,
        createLogger: () => logger,
      }
    );

    expect(
      fs.readFileSync(path.join(tempDir, "spec/index.ts"), "utf-8")
    ).toContain("defineSpec");
    expect(
      fs.readFileSync(path.join(tempDir, TYPEWEAVER_CONFIG_FILE), "utf-8")
    ).toContain('output: "./generated"');
  });

  test("creates a starter that validates and generates plugin output successfully", async () => {
    const tempDir = createWorkspaceTempDir();
    const initLogger = createTestLogger();
    const validateLogger = createTestLogger();
    const generateLogger = createTestLogger();

    await handleInitCommand(
      {
        plugins: "clients,hono",
      },
      {
        execDir: tempDir,
        createLogger: () => initLogger,
      }
    );

    const validationSummary = await handleValidateCommand(
      {
        config: TYPEWEAVER_CONFIG_FILE,
      },
      {
        execDir: tempDir,
        createLogger: () => validateLogger,
      }
    );
    const generationSummary = await handleGenerateCommand(
      {
        config: TYPEWEAVER_CONFIG_FILE,
      },
      {
        execDir: tempDir,
        createLogger: () => generateLogger,
      }
    );

    expect(validationSummary).toEqual(
      expect.objectContaining({
        hasErrors: false,
        stats: expect.objectContaining({
          errors: 0,
          resources: 1,
          operations: 3,
        }),
      })
    );
    expect(generationSummary).toEqual({
      kind: "once",
      summary: expect.objectContaining({
        mode: "generate",
        pluginCount: 2,
        targetOutputDir: "./generated",
      }),
    });
    expect(fs.existsSync(path.join(tempDir, "generated/index.ts"))).toBe(true);
    expect(
      fs.existsSync(path.join(tempDir, "generated/clients/todo/TodoClient.ts"))
    ).toBe(true);
    expect(
      fs.existsSync(path.join(tempDir, "generated/hono/todo/TodoHono.ts"))
    ).toBe(true);
  });
});
