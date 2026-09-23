import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Cause, Exit } from "effect";
import { afterEach, describe, expect, test } from "vitest";
import { effectRuntime } from "../../src/effectRuntime.js";
import { ConcurrentGenerationError } from "../../src/errors/ConcurrentGenerationError.js";
import {
  acquireOutputLock,
  releaseOutputLock,
} from "../../src/services/generatorIO.js";
import { GeneratedOutputChecker, Generator } from "../../src/services/index.js";

const GENERATION_TEST_TIMEOUT_MS = 15_000;

const tempDirs: string[] = [];

const externalPaths: string[] = [];

const createTempWorkspace = (suffix: string): string => {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), `typeweaver-check-${suffix}-`)
  );
  fs.symlinkSync(
    path.join(import.meta.dirname, "..", "..", "node_modules"),
    path.join(tempDir, "node_modules"),
    process.platform === "win32" ? "junction" : "dir"
  );
  tempDirs.push(tempDir);
  return tempDir;
};

const createProjectWorkspace = (suffix: string): string => {
  const tempDir = fs.mkdtempSync(
    path.join(import.meta.dirname, "..", `.typeweaver-check-${suffix}-`)
  );
  tempDirs.push(tempDir);
  return tempDir;
};

const writeTinySpecAt = (workspace: string): string => {
  const specFile = path.join(workspace, "spec", "index.ts");
  fs.mkdirSync(path.dirname(specFile), { recursive: true });
  fs.writeFileSync(
    specFile,
    [
      'import { defineOperation, defineResponse, defineSpec, HttpMethod, HttpStatusCode } from "@rexeus/typeweaver-core";',
      'import { z } from "zod";',
      "",
      "const itemLoaded = defineResponse({",
      '  name: "ItemLoaded",',
      "  statusCode: HttpStatusCode.OK,",
      '  description: "Item loaded",',
      "  body: z.object({ id: z.string() }),",
      "});",
      "",
      "export const spec = defineSpec({",
      '  metadata: { title: "Items API", version: "1.0.0" },',
      "  resources: {",
      "    item: {",
      "      operations: [",
      "        defineOperation({",
      '          operationId: "getItem",',
      '          path: "/items/:itemId",',
      "          method: HttpMethod.GET,",
      '          summary: "Get item",',
      "          request: { param: z.object({ itemId: z.string() }) },",
      "          responses: [itemLoaded],",
      "        }),",
      "      ],",
      "    },",
      "  },",
      "});",
      "",
    ].join("\n")
  );
  return specFile;
};

const writeTinySpec = (workspace: string): string => writeTinySpecAt(workspace);

const writeEmptySpec = (workspace: string): string => {
  const specFile = path.join(workspace, "spec", "index.ts");
  fs.mkdirSync(path.dirname(specFile), { recursive: true });
  fs.writeFileSync(
    specFile,
    [
      'import { defineSpec } from "@rexeus/typeweaver-core";',
      "",
      'export const spec = defineSpec({ metadata: { title: "Empty API", version: "1.0.0" }, resources: {} });',
      "",
    ].join("\n")
  );
  return specFile;
};

const snapshotTree = (root: string): Record<string, string> => {
  const snapshot: Record<string, string> = {};
  if (!fs.existsSync(root)) {
    return snapshot;
  }
  const pending = [""];
  while (pending.length > 0) {
    const relativeDirectory = pending.pop() ?? "";
    const absoluteDirectory = path.join(root, relativeDirectory);
    for (const entry of fs.readdirSync(absoluteDirectory, {
      withFileTypes: true,
    })) {
      const relativePath =
        relativeDirectory === ""
          ? entry.name
          : `${relativeDirectory}/${entry.name}`;
      if (entry.isDirectory()) {
        pending.push(relativePath);
      } else {
        snapshot[relativePath] = fs
          .readFileSync(path.join(root, relativePath))
          .toString("base64");
      }
    }
  }
  return snapshot;
};

const checkParams = (workspace: string, clean?: boolean) =>
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

const runGenerate = (
  workspace: string,
  options: { readonly clean?: boolean } = {}
): Promise<void> =>
  effectRuntime.runPromise(
    Generator.generate({
      ...checkParams(workspace, options.clean),
    })
  );

const extractFailure = (exit: Exit.Exit<unknown, unknown>): unknown => {
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

const failureProperty = (failure: unknown, property: string): unknown =>
  typeof failure === "object" && failure !== null && property in failure
    ? Reflect.get(failure, property)
    : undefined;

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  for (const externalPath of externalPaths.splice(0)) {
    fs.rmSync(externalPath, { recursive: true, force: true });
  }
});

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
