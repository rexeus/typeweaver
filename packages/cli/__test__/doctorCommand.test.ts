import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, test } from "vitest";
import { handleDoctorCommand } from "../src/commands/doctor.js";
import { STARTER_TEMPLATE } from "../src/templates/starterTemplate.js";
import { createTypeweaverConfigFileContent } from "../src/templates/typeweaverConfigTemplate.js";
import { createTempDirFactory } from "./__helpers__/tempDir.js";
import { createTestLogger } from "./__helpers__/testLogger.js";

const PACKAGE_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

const writeWorkingProject = (
  directory: string,
  configContent: string
): void => {
  for (const file of STARTER_TEMPLATE.files) {
    const filePath = path.join(directory, file.relativePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, file.content, "utf-8");
  }

  fs.writeFileSync(
    path.join(directory, "typeweaver.config.mjs"),
    configContent,
    "utf-8"
  );
};

describe("handleDoctorCommand", () => {
  // Fixtures live inside the CLI package so pnpm-workspace module resolution
  // picks up `@rexeus/typeweaver-core` during spec bundling.
  const createFixtureDirectory = createTempDirFactory(
    ".tmp-doctor-",
    PACKAGE_DIR
  );

  afterEach(() => {
    process.exitCode = undefined;
  });

  test("passes a healthy setup with deep checks without writing output", async () => {
    const fixtureDirectory = createFixtureDirectory();
    const outputDirectory = path.join(fixtureDirectory, "generated");
    const logger = createTestLogger();

    writeWorkingProject(
      fixtureDirectory,
      createTypeweaverConfigFileContent({
        inputPath: "spec/index.ts",
        outputPath: "generated",
        plugins: [],
      }).replace("  format: true,", "  format: false,")
    );

    const summary = await handleDoctorCommand(
      { deep: true },
      {
        execDir: fixtureDirectory,
        createLogger: () => logger,
      }
    );

    expect(summary).toEqual(
      expect.objectContaining({
        mode: "doctor",
        failedChecks: 0,
        skippedChecks: 0,
      })
    );
    expect(process.exitCode).toBeUndefined();
    expect(fs.existsSync(outputDirectory)).toBe(false);
  });

  test("cascades skips for deep checks when the input path is broken", async () => {
    const fixtureDirectory = createFixtureDirectory();
    const logger = createTestLogger();

    writeWorkingProject(
      fixtureDirectory,
      createTypeweaverConfigFileContent({
        inputPath: "spec/missing.ts",
        outputPath: "generated",
        plugins: [],
      }).replace("  format: true,", "  format: false,")
    );

    const summary = await handleDoctorCommand(
      { deep: true },
      {
        execDir: fixtureDirectory,
        createLogger: () => logger,
      }
    );

    // The input-exists check fails, and every deep check that depends on it
    // cascades into a skip. Asserting relative relationships keeps the test
    // stable when new doctor checks are introduced.
    expect(summary?.failedChecks).toBe(1);
    expect(summary?.skippedChecks).toBeGreaterThanOrEqual(1);
    expect(summary?.passedChecks).toBeGreaterThanOrEqual(1);
    expect(process.exitCode).toBe(1);
  });
});
