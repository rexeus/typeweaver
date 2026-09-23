import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Cause, Exit, Option } from "effect";
import { expect } from "vitest";
import { effectRuntime } from "../../../src/effectRuntime.js";
import { UnsafeCleanTargetError } from "../../../src/errors/UnsafeCleanTargetError.js";
import { Generator } from "../../../src/services/Generator.js";

const tempDirs: string[] = [];

export const removeTempDirs = (): void => {
  for (const tempDir of tempDirs) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  tempDirs.length = 0;
};

export const createTempWorkspace = (suffix: string): string => {
  const tempDir = fs.mkdtempSync(
    path.join(process.cwd(), `.typeweaver-unsafe-${suffix}-`)
  );
  tempDirs.push(tempDir);
  return tempDir;
};

/** Creates a directory outside the package tree, under the OS temp root. */
export const createIsolatedTempDirectory = (suffix: string): string => {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), `typeweaver-unsafe-${suffix}-`)
  );
  tempDirs.push(tempDir);
  return tempDir;
};

export const runGenerateExit = (
  workspace: string,
  outputDir: string,
  clean: boolean,
  inputFile = "spec/index.ts"
): Promise<Exit.Exit<unknown, unknown>> =>
  effectRuntime.runPromiseExit(
    Generator.generate({
      inputFile,
      outputDir,
      config: {
        input: inputFile,
        output: outputDir,
        format: false,
        clean,
      },
      currentWorkingDirectory: workspace,
    })
  );

export const expectUnsafeCleanTargetFailure = (
  exit: Exit.Exit<unknown, unknown>,
  reason: string
): UnsafeCleanTargetError => {
  expect(Exit.isFailure(exit)).toBe(true);
  if (!Exit.isFailure(exit)) {
    throw new Error("Expected generation to fail");
  }
  const failure = Option.getOrUndefined(Cause.findErrorOption(exit.cause));
  expect(failure).toBeInstanceOf(UnsafeCleanTargetError);
  if (!(failure instanceof UnsafeCleanTargetError)) {
    throw new Error("Expected an UnsafeCleanTargetError");
  }
  expect(failure.reason).toBe(reason);
  return failure;
};
