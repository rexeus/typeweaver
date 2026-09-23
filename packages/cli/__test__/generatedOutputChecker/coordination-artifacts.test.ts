import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { effectRuntime } from "../../src/effectRuntime.js";
import { GeneratedOutputChecker, Generator } from "../../src/services/index.js";
import { canonicalHostTempDirectory } from "../../src/services/internal/hostTemp.js";
import { outputLockDirectory } from "../../src/services/internal/outputCoordinationArtifact.js";
import { writeTinySpec } from "../helpers/specFiles.js";
import {
  checkParams,
  createTempWorkspace,
  extractFailure,
  removeTempPaths,
  runGenerate,
} from "./fixtures.js";

afterEach(removeTempPaths);

describe("GeneratedOutputChecker coordination cleanup", () => {
  test("repeated checks leave no flat lock or fence behind", async () => {
    const workspace = createTempWorkspace("repeated");
    writeTinySpec(workspace);
    await runGenerate(workspace);
    const outputDir = path.join(workspace, "generated", "output");
    const lockPath = outputLockDirectory(outputDir);

    await effectRuntime.runPromise(
      GeneratedOutputChecker.check(checkParams(workspace))
    );
    await effectRuntime.runPromise(
      GeneratedOutputChecker.check(checkParams(workspace))
    );

    expect(fs.existsSync(lockPath)).toBe(false);
    const leftoverFences = fs
      .readdirSync(path.dirname(lockPath))
      .filter(entry => entry.startsWith(`${path.basename(lockPath)}.fence-`));
    expect(leftoverFences).toEqual([]);
  });

  test("rejects a reserved configured output without writing", async () => {
    const reservedOutput = path.join(
      canonicalHostTempDirectory(),
      `.typeweaver-output-lock-${"a".repeat(64)}`
    );
    const exit = await effectRuntime.runPromiseExit(
      GeneratedOutputChecker.check({
        inputFile: "spec/index.ts",
        outputDir: reservedOutput,
        config: {
          input: "spec/index.ts",
          output: reservedOutput,
          format: false,
        },
        currentWorkingDirectory: process.cwd(),
      })
    );

    expect(extractFailure(exit)).toEqual(
      expect.objectContaining({ _tag: "ReservedCoordinationPathError" })
    );
    expect(fs.existsSync(reservedOutput)).toBe(false);
  });

  test("normal generation rejects a reserved configured output", async () => {
    const reservedOutput = path.join(
      canonicalHostTempDirectory(),
      `.typeweaver-output-lock-${"a".repeat(64)}`
    );
    const exit = await effectRuntime.runPromiseExit(
      Generator.generate({
        inputFile: "spec/index.ts",
        outputDir: reservedOutput,
        config: {
          input: "spec/index.ts",
          output: reservedOutput,
          format: false,
        },
        currentWorkingDirectory: process.cwd(),
      })
    );

    expect(extractFailure(exit)).toEqual(
      expect.objectContaining({ _tag: "ReservedCoordinationPathError" })
    );
    expect(fs.existsSync(reservedOutput)).toBe(false);
  });
});
