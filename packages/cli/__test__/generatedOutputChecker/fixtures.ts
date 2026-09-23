import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Cause, Exit } from "effect";
import { expect } from "vitest";
import { effectRuntime } from "../../src/effectRuntime.js";
import { Generator } from "../../src/services/index.js";

export const GENERATION_TEST_TIMEOUT_MS = 15_000;

const testRoot = path.resolve(import.meta.dirname, "..");

const tempDirs: string[] = [];

/** Paths created outside tracked workspaces; removed by `removeTempPaths`. */
export const externalPaths: string[] = [];

export const removeTempPaths = (): void => {
  for (const tempDir of tempDirs.splice(0)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  for (const externalPath of externalPaths.splice(0)) {
    fs.rmSync(externalPath, { recursive: true, force: true });
  }
};

/** Creates an OS-temp workspace linked to the CLI package dependencies. */
export const createTempWorkspace = (suffix: string): string => {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), `typeweaver-check-${suffix}-`)
  );
  fs.symlinkSync(
    path.join(testRoot, "..", "node_modules"),
    path.join(tempDir, "node_modules"),
    process.platform === "win32" ? "junction" : "dir"
  );
  tempDirs.push(tempDir);
  return tempDir;
};

/** Creates a workspace inside the package tree so ancestor lookup applies. */
export const createProjectWorkspace = (suffix: string): string => {
  const tempDir = fs.mkdtempSync(
    path.join(testRoot, `.typeweaver-check-${suffix}-`)
  );
  tempDirs.push(tempDir);
  return tempDir;
};

export const checkParams = (workspace: string, clean?: boolean) =>
  ({
    inputFile: "spec/index.ts",
    outputDir: "generated/output",
    config: {
      input: "spec/index.ts",
      output: "generated/output",
      format: false,
      ...(clean === undefined ? {} : { clean }),
    },
    currentWorkingDirectory: workspace,
  }) as const;

export const runGenerate = (
  workspace: string,
  options: { readonly clean?: boolean } = {}
): Promise<void> =>
  effectRuntime.runPromise(
    Generator.generate({
      ...checkParams(workspace, options.clean),
    })
  );

export const extractFailure = (exit: Exit.Exit<unknown, unknown>): unknown => {
  expect(Exit.isFailure(exit)).toBe(true);
  if (Exit.isSuccess(exit)) {
    throw new Error("Expected a typed failure");
  }
  const failure = Cause.findErrorOption(exit.cause);
  if (failure._tag === "None") {
    throw new Error(`Expected typed failure: ${Cause.pretty(exit.cause)}`);
  }
  return failure.value;
};

export const failureProperty = (failure: unknown, property: string): unknown =>
  typeof failure === "object" && failure !== null && property in failure
    ? Reflect.get(failure, property)
    : undefined;
