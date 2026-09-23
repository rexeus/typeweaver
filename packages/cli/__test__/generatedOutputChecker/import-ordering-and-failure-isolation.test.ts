import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { effectRuntime } from "../../src/effectRuntime.js";
import { ConcurrentGenerationError } from "../../src/errors/ConcurrentGenerationError.js";
import {
  acquireOutputLock,
  releaseOutputLock,
} from "../../src/services/generatorIO.js";
import { GeneratedOutputChecker } from "../../src/services/index.js";
import { writeEmptySpec, writeTinySpec } from "../helpers/specFiles.js";
import { snapshotTree } from "../helpers/treeSnapshots.js";
import {
  checkParams,
  createProjectWorkspace,
  createTempWorkspace,
  extractFailure,
  failureProperty,
  GENERATION_TEST_TIMEOUT_MS,
  removeTempPaths,
  runGenerate,
} from "./fixtures.js";

afterEach(removeTempPaths);

describe("GeneratedOutputChecker import ordering", () => {
  test(
    "builds the portable bundle before isolated spec side effects run",
    async () => {
      const workspace = createProjectWorkspace("import-side-effect");
      const helperFile = path.join(workspace, "spec", "operation.ts");
      const initialHelperSource = [
        'import fs from "node:fs";',
        `fs.writeFileSync(${JSON.stringify(helperFile)}, 'export const operationId = "mutatedOperation";\\n');`,
        'export const operationId = "stableOperation";',
        "",
      ].join("\n");
      fs.mkdirSync(path.dirname(helperFile), { recursive: true });
      fs.writeFileSync(helperFile, initialHelperSource);
      fs.writeFileSync(
        path.join(workspace, "spec", "index.ts"),
        [
          'import { operationId } from "./operation.js";',
          'import { defineOperation, defineResponse, defineSpec, HttpMethod, HttpStatusCode } from "@rexeus/typeweaver-core";',
          'const ok = defineResponse({ name: "Ok", statusCode: HttpStatusCode.OK, description: "OK" });',
          'export const spec = defineSpec({ metadata: { title: "Side effect", version: "1.0.0" }, resources: { probe: { operations: [defineOperation({ operationId, path: "/probe", method: HttpMethod.GET, summary: "Probe", request: {}, responses: [ok] })] } } });',
          "",
        ].join("\n")
      );

      await runGenerate(workspace);
      fs.writeFileSync(helperFile, initialHelperSource);

      await expect(
        effectRuntime.runPromise(
          GeneratedOutputChecker.check(checkParams(workspace))
        )
      ).resolves.toBeUndefined();
    },
    GENERATION_TEST_TIMEOUT_MS
  );
});

describe("GeneratedOutputChecker output identity", () => {
  test("rejects a dangling configured-output alias before locking", async () => {
    const workspace = createTempWorkspace("dangling-output-alias");
    writeTinySpec(workspace);
    const generatedDirectory = path.join(workspace, "generated");
    const target = path.join(workspace, "eventual-output");
    fs.mkdirSync(generatedDirectory);
    fs.symlinkSync(
      target,
      path.join(generatedDirectory, "output"),
      process.platform === "win32" ? "junction" : "dir"
    );

    const exit = await effectRuntime.runPromiseExit(
      GeneratedOutputChecker.check(checkParams(workspace))
    );

    const failure = extractFailure(exit);
    expect(failureProperty(failure, "_tag")).toBe("UnsafeCleanTargetError");
    expect(failureProperty(failure, "reason")).toBe("symbolic-link");
    expect(fs.existsSync(target)).toBe(false);
  });
});

describe("GeneratedOutputChecker failure isolation", () => {
  test("does not mutate configured output when fresh generation fails", async () => {
    const workspace = createTempWorkspace("generation-failure");
    writeTinySpec(workspace);
    await runGenerate(workspace);
    const outputDir = path.join(workspace, "generated", "output");
    const before = snapshotTree(outputDir);
    writeEmptySpec(workspace);

    await expect(
      effectRuntime.runPromise(
        GeneratedOutputChecker.check(checkParams(workspace))
      )
    ).rejects.toBeDefined();

    expect(snapshotTree(outputDir)).toEqual(before);
  });
  test("fails with ConcurrentGenerationError while the configured output lock is held", async () => {
    const workspace = createTempWorkspace("locked");
    writeTinySpec(workspace);
    const outputDir = path.join(workspace, "generated", "output");
    const lock = await effectRuntime.runPromise(
      acquireOutputLock({
        outputDir,
        inputFile: path.join(workspace, "spec", "index.ts"),
      })
    );

    try {
      const exit = await effectRuntime.runPromiseExit(
        GeneratedOutputChecker.check(checkParams(workspace))
      );
      expect(extractFailure(exit)).toBeInstanceOf(ConcurrentGenerationError);
    } finally {
      await effectRuntime.runPromise(releaseOutputLock(lock));
    }
  });
});
