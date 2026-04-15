import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, test, vi } from "vitest";
import { handleDoctorCommand } from "../src/commands/doctor.js";
import type { Logger } from "../src/logger.js";
import { createStarterTemplate } from "../src/templates/starterTemplate.js";
import { createTypeweaverConfigFileContent } from "../src/templates/typeweaverConfigTemplate.js";

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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

const temporaryDirectories: string[] = [];

const createFixtureDirectory = (name: string): string => {
  const temporaryDirectory = fs.mkdtempSync(
    path.join(packageDir, `.tmp-${name}-`)
  );
  temporaryDirectories.push(temporaryDirectory);

  return temporaryDirectory;
};

const writeWorkingProject = (
  directory: string,
  configContent: string
): void => {
  for (const file of createStarterTemplate().files) {
    const filePath = path.join(directory, file.relativePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, file.content, "utf-8");
  }

  fs.writeFileSync(path.join(directory, "typeweaver.config.mjs"), configContent, "utf-8");
};

describe("handleDoctorCommand", () => {
  afterEach(() => {
    process.exitCode = undefined;

    for (const temporaryDirectory of temporaryDirectories) {
      fs.rmSync(temporaryDirectory, { recursive: true, force: true });
    }

    temporaryDirectories.length = 0;
  });

  test("passes a healthy setup with deep checks without writing output", async () => {
    const fixtureDirectory = createFixtureDirectory("doctor-pass");
    const outputDirectory = path.join(fixtureDirectory, "generated");
    const logger = createLogger();

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
    const fixtureDirectory = createFixtureDirectory("doctor-broken");
    const logger = createLogger();

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

    expect(summary).toEqual(
      expect.objectContaining({
        failedChecks: 1,
        skippedChecks: 2,
        totalChecks: 10,
      })
    );
    expect(process.exitCode).toBe(1);
  });
});
