import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Cause, Exit, Option } from "effect";
import { afterEach, describe, expect, test } from "vitest";
import { effectRuntime } from "../src/effectRuntime.js";
import { UnsafeCleanTargetError } from "../src/errors/UnsafeCleanTargetError.js";
import { Generator } from "../src/services/Generator.js";

const tempDirs: string[] = [];

const directorySymlinkType = process.platform === "win32" ? "junction" : "dir";

const canCreateDirectorySymlinks = (): boolean => {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "typeweaver-clean-symlink-support-")
  );
  const targetDirectory = path.join(tempDir, "target");
  const symlinkDirectory = path.join(tempDir, "link");

  try {
    fs.mkdirSync(targetDirectory);
    fs.symlinkSync(targetDirectory, symlinkDirectory, directorySymlinkType);
    return true;
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      ["EACCES", "EINVAL", "ENOTSUP", "EPERM"].includes(String(error.code))
    ) {
      return false;
    }
    throw error;
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
};

const createIsolatedTempDirectory = (suffix: string): string => {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), `typeweaver-unsafe-${suffix}-`)
  );
  tempDirs.push(tempDir);
  return tempDir;
};

afterEach(() => {
  for (const tempDir of tempDirs) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  tempDirs.length = 0;
});

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
};

const runGenerateExit = (
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

const expectUnsafeCleanTargetFailure = (
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

describe("Generator markerless ancestor safety", () => {
  test("rejects a lexical cwd ancestor before the no-clean orphan sweep", async () => {
    const isolatedRoot = createIsolatedTempDirectory("lexical-ancestor");
    const workspace = path.join(isolatedRoot, "workspace");
    fs.mkdirSync(workspace);
    writeTinySpec(workspace);

    const orphanDir = path.join(isolatedRoot, ".typeweaver-ABC123");
    const sentinel = path.join(orphanDir, "keep.txt");
    fs.mkdirSync(orphanDir);
    fs.writeFileSync(sentinel, "must survive");

    const exit = await runGenerateExit(workspace, "..", false);

    expectUnsafeCleanTargetFailure(
      exit,
      "ancestor-of-current-working-directory"
    );
    expect(fs.readFileSync(sentinel, "utf8")).toBe("must survive");
  });

  test.skipIf(!canCreateDirectorySymlinks())(
    "rejects a canonical cwd ancestor before the no-clean orphan sweep",
    async () => {
      const canonicalRoot = createIsolatedTempDirectory("canonical-ancestor");
      const canonicalWorkspace = path.join(canonicalRoot, "workspace");
      fs.mkdirSync(canonicalWorkspace);
      writeTinySpec(canonicalWorkspace);

      const aliasRoot = createIsolatedTempDirectory("canonical-alias");
      const workspaceAlias = path.join(aliasRoot, "workspace-link");
      fs.symlinkSync(canonicalWorkspace, workspaceAlias, directorySymlinkType);

      const orphanDir = path.join(canonicalRoot, ".typeweaver-ABC123");
      const sentinel = path.join(orphanDir, "keep.txt");
      fs.mkdirSync(orphanDir);
      fs.writeFileSync(sentinel, "must survive");

      const exit = await runGenerateExit(workspaceAlias, canonicalRoot, false);

      expectUnsafeCleanTargetFailure(
        exit,
        "ancestor-of-current-working-directory"
      );
      expect(fs.readFileSync(sentinel, "utf8")).toBe("must survive");
    }
  );
});
