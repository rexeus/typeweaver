import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Cause, Exit } from "effect";
import { afterEach, describe, expect, test } from "vitest";
import { effectRuntime } from "../src/effectRuntime.js";
import { GeneratedOutputChecker, Generator } from "../src/services/index.js";
import { canonicalHostTempDirectory } from "../src/services/internal/hostTemp.js";
import { outputLockDirectory } from "../src/services/internal/outputCoordinationArtifact.js";

const tempDirs: string[] = [];

const createTempWorkspace = (suffix: string): string => {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), `typeweaver-check-${suffix}-`)
  );
  fs.symlinkSync(
    path.join(import.meta.dirname, "..", "node_modules"),
    path.join(tempDir, "node_modules"),
    process.platform === "win32" ? "junction" : "dir"
  );
  tempDirs.push(tempDir);
  return tempDir;
};

const writeTinySpec = (workspace: string): string => {
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

const checkParams = (workspace: string) =>
  ({
    inputFile: "spec/index.ts",
    outputDir: "generated/output",
    config: {
      input: "spec/index.ts",
      output: "generated/output",
      format: false,
    },
    currentWorkingDirectory: workspace,
  }) as const;

const runGenerate = (workspace: string): Promise<void> =>
  effectRuntime.runPromise(
    Generator.generate({
      ...checkParams(workspace),
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

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

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
