import fs from "node:fs";
import path from "node:path";
import { Cause, Exit } from "effect";
import { vi } from "vitest";
import { effectRuntime } from "../../../src/effectRuntime.js";
import { Generator } from "../../../src/services/Generator.js";
import { outputLockDirectory } from "../../../src/services/internal/outputCoordinationArtifact.js";

const tempDirs: string[] = [];

export const removeTempDirs = (): void => {
  for (const tempDir of tempDirs) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  tempDirs.length = 0;
};

export const createTempWorkspace = (suffix: string): string => {
  const tempDir = fs.mkdtempSync(
    path.join(process.cwd(), `.typeweaver-lockfile-${suffix}-`)
  );
  tempDirs.push(tempDir);
  return tempDir;
};

/** Publishes a complete lock for `info.pid` over `generated/output`. */
export const seedHeldLock = (
  workspace: string,
  info: { readonly pid: number; readonly startedAt: string }
): string => {
  const outputDir = path.join(workspace, "generated", "output");
  const lockDir = outputLockDirectory(outputDir);
  fs.mkdirSync(lockDir, { recursive: true });
  fs.writeFileSync(
    path.join(lockDir, "info.json"),
    JSON.stringify(
      { ...info, inputFile: "", ownerToken: `seed-${info.pid}` },
      null,
      2
    )
  );
  return lockDir;
};

/** Makes liveness probes for `pid` fail with the given errno `code`. */
export const mockProcessLookupError = (pid: number, code: string) =>
  vi.spyOn(process, "kill").mockImplementation(candidatePid => {
    if (candidatePid === pid) {
      throw Object.assign(new Error(`process lookup failed with ${code}`), {
        code,
      });
    }
    return true;
  });

export const extractFailure = <A>(exit: Exit.Exit<A, unknown>): unknown => {
  if (Exit.isSuccess(exit)) {
    throw new Error("Expected generation to fail with the held lock");
  }
  const failure = Cause.findErrorOption(exit.cause);
  if (failure._tag === "None") {
    throw new Error(`Expected typed failure; got: ${Cause.pretty(exit.cause)}`);
  }
  return failure.value;
};

export const runGenerate = (workspace: string): Promise<void> =>
  effectRuntime.runPromise(
    Generator.generate({
      inputFile: "spec/index.ts",
      outputDir: "generated/output",
      config: {
        input: "spec/index.ts",
        output: "generated/output",
        format: false,
      },
      currentWorkingDirectory: workspace,
    })
  );

export const runGenerateExit = (
  workspace: string
): Promise<Exit.Exit<void, unknown>> =>
  effectRuntime.runPromiseExit(
    Generator.generate({
      inputFile: "spec/index.ts",
      outputDir: "generated/output",
      config: {
        input: "spec/index.ts",
        output: "generated/output",
        format: false,
      },
      currentWorkingDirectory: workspace,
    })
  );
