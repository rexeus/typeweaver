import fs from "node:fs";
import path from "node:path";
import { Cause, Exit, Option } from "effect";
import { afterEach, describe, expect, test } from "vitest";
import { effectRuntime } from "../src/effectRuntime.js";
import { UnsafeCleanTargetError } from "../src/errors/UnsafeCleanTargetError.js";
import { Generator } from "../src/services/Generator.js";

const tempDirs: string[] = [];

const createTempWorkspace = (suffix: string): string => {
  const tempDir = fs.mkdtempSync(
    path.join(process.cwd(), `.typeweaver-unsafe-${suffix}-`)
  );
  tempDirs.push(tempDir);
  return tempDir;
};

const writeTinySpec = (workspace: string): void => {
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
};

const runGenerateExit = (
  workspace: string,
  outputDir: string,
  clean: boolean
): Promise<Exit.Exit<unknown, unknown>> =>
  effectRuntime.runPromiseExit(
    Generator.generate({
      inputFile: "spec/index.ts",
      outputDir,
      config: {
        input: "spec/index.ts",
        output: outputDir,
        format: false,
        clean,
      },
      currentWorkingDirectory: workspace,
    })
  );

const expectUnsafeCleanTargetFailure = (
  exit: Exit.Exit<unknown, unknown>,
  reason: string
): void => {
  expect(Exit.isFailure(exit)).toBe(true);
  if (!Exit.isFailure(exit)) return;
  const failure = Option.getOrUndefined(Cause.failureOption(exit.cause));
  expect(failure).toBeInstanceOf(UnsafeCleanTargetError);
  expect(failure).toMatchObject({ reason });
};

describe("Generator output-target guard ordering", () => {
  afterEach(() => {
    for (const tempDir of tempDirs) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  test("rejects the cwd as output target with --no-clean before sweeping or creating directories", async () => {
    const workspace = createTempWorkspace("cwd");
    writeTinySpec(workspace);

    // Pre-seed crash debris that the orphan sweep would normally remove.
    // The guard must fire before the sweep, so this dir has to survive.
    const orphanDir = path.join(workspace, ".typeweaver-orphan1234");
    fs.mkdirSync(orphanDir);
    fs.writeFileSync(path.join(orphanDir, "generated.tmp"), "in-flight");

    const exit = await runGenerateExit(workspace, ".", false);

    expectUnsafeCleanTargetFailure(exit, "current-working-directory");
    expect(fs.existsSync(orphanDir)).toBe(true);
    expect(fs.existsSync(path.join(workspace, "responses"))).toBe(false);
  });

  test("rejects an output target carrying a workspace marker with --no-clean", async () => {
    const workspace = createTempWorkspace("marker");
    writeTinySpec(workspace);

    const target = path.join(workspace, "target");
    fs.mkdirSync(target);
    fs.writeFileSync(path.join(target, "pnpm-workspace.yaml"), "packages: []");

    const exit = await runGenerateExit(workspace, "target", false);

    expectUnsafeCleanTargetFailure(exit, "target-carries-workspace-marker");
    expect(fs.existsSync(path.join(target, "responses"))).toBe(false);
  });

  test("allows the spec input inside the output target when cleaning is disabled", async () => {
    const workspace = createTempWorkspace("input-inside");
    writeTinySpec(workspace);

    // With clean enabled this is rejected (`contains-input-file`); the
    // containment rule is clean-specific, so a no-clean run generating
    // alongside the source must succeed.
    const exit = await runGenerateExit(workspace, "spec", false);

    expect(Exit.isSuccess(exit)).toBe(true);
    expect(fs.existsSync(path.join(workspace, "spec", "index.ts"))).toBe(true);
  });

  test("rejects the spec input inside the output target when cleaning is enabled", async () => {
    const workspace = createTempWorkspace("input-clean");
    writeTinySpec(workspace);

    const exit = await runGenerateExit(workspace, "spec", true);

    expectUnsafeCleanTargetFailure(exit, "contains-input-file");
    expect(fs.existsSync(path.join(workspace, "spec", "index.ts"))).toBe(true);
  });
});
