import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Cause, Effect, Exit, Option } from "effect";
import { afterEach, describe, expect, test } from "vitest";
import { effectRuntime } from "../src/effectRuntime.js";
import { UnsafeCleanTargetError } from "../src/errors/UnsafeCleanTargetError.js";
import { Generator } from "../src/services/Generator.js";
import {
  prepareGeneration,
  resolveGenerationPaths,
  withGenerationLock,
} from "../src/services/internal/generatorPreflight.js";

const tempDirs: string[] = [];
const directorySymlinkType = process.platform === "win32" ? "junction" : "dir";
const trailingPathWhitespace = process.platform === "win32" ? "\u00a0" : " ";

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

const createTempWorkspace = (suffix: string): string => {
  const tempDir = fs.mkdtempSync(
    path.join(process.cwd(), `.typeweaver-unsafe-${suffix}-`)
  );
  tempDirs.push(tempDir);
  return tempDir;
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
  const failure = Option.getOrUndefined(Cause.failureOption(exit.cause));
  expect(failure).toBeInstanceOf(UnsafeCleanTargetError);
  if (!(failure instanceof UnsafeCleanTargetError)) {
    throw new Error("Expected an UnsafeCleanTargetError");
  }
  expect(failure.reason).toBe(reason);
  return failure;
};

describe("Generator output-target guard ordering", () => {
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

  test.skipIf(!canCreateDirectorySymlinks())(
    "rejects an input path reached through a symlink inside the clean target before deleting the link",
    async () => {
      const workspace = createTempWorkspace("input-symlink");
      const externalSourceDirectory = createTempWorkspace(
        "input-symlink-source"
      );
      writeTinySpec(externalSourceDirectory);

      const outputDir = path.join(workspace, "generated", "output");
      const inputLink = path.join(outputDir, "source-link");
      fs.mkdirSync(outputDir, { recursive: true });
      fs.symlinkSync(
        path.join(externalSourceDirectory, "spec"),
        inputLink,
        directorySymlinkType
      );

      const exit = await runGenerateExit(
        workspace,
        "generated/output",
        true,
        "generated/output/source-link/index.ts"
      );

      expectUnsafeCleanTargetFailure(exit, "contains-input-file");
      expect(fs.lstatSync(inputLink).isSymbolicLink()).toBe(true);
      expect(
        fs.existsSync(path.join(externalSourceDirectory, "spec", "index.ts"))
      ).toBe(true);
    }
  );

  test.skipIf(!canCreateDirectorySymlinks())(
    "rejects a symlinked output directory before cleaning its external target",
    async () => {
      const workspace = createTempWorkspace("output-symlink");
      const externalOutputDirectory = createTempWorkspace(
        "output-symlink-target"
      );
      writeTinySpec(workspace);

      const sentinel = path.join(externalOutputDirectory, "keep.txt");
      fs.writeFileSync(sentinel, "must survive");
      const outputLink = path.join(workspace, "generated", "output");
      fs.mkdirSync(path.dirname(outputLink), { recursive: true });
      fs.symlinkSync(externalOutputDirectory, outputLink, directorySymlinkType);

      const exit = await runGenerateExit(workspace, "generated/output", true);

      expectUnsafeCleanTargetFailure(exit, "symbolic-link");
      expect(fs.lstatSync(outputLink).isSymbolicLink()).toBe(true);
      expect(fs.readFileSync(sentinel, "utf8")).toBe("must survive");
    }
  );
});

describe("Generator output-target symlink revalidation", () => {
  test.skipIf(!canCreateDirectorySymlinks())(
    "rejects a dangling output symlink even though existsSync reports false",
    async () => {
      const workspace = createTempWorkspace("dangling-output-symlink");
      writeTinySpec(workspace);

      const missingTarget = path.join(workspace, "missing-target");
      const outputLink = path.join(workspace, "generated", "output");
      fs.mkdirSync(path.dirname(outputLink), { recursive: true });
      fs.symlinkSync(missingTarget, outputLink, directorySymlinkType);
      expect(fs.existsSync(outputLink)).toBe(false);

      const exit = await runGenerateExit(workspace, "generated/output", false);

      expectUnsafeCleanTargetFailure(exit, "symbolic-link");
      expect(fs.lstatSync(outputLink).isSymbolicLink()).toBe(true);
    }
  );

  test.skipIf(!canCreateDirectorySymlinks())(
    "revalidates a swapped output root under lock before the no-clean orphan sweep",
    async () => {
      const workspace = createTempWorkspace("output-root-swap");
      const externalOutputDirectory = createTempWorkspace(
        "output-root-swap-target"
      );
      writeTinySpec(workspace);

      const params = {
        inputFile: "spec/index.ts",
        outputDir: "generated/output",
        config: {
          input: "spec/index.ts",
          output: "generated/output",
          format: false,
          clean: false,
        },
        currentWorkingDirectory: workspace,
      };
      const plan = await effectRuntime.runPromise(
        prepareGeneration(resolveGenerationPaths(params))
      );

      fs.rmSync(plan.outputDir, { recursive: true });
      const orphanDir = path.join(
        externalOutputDirectory,
        ".typeweaver-ABC123"
      );
      const sentinel = path.join(orphanDir, "keep.txt");
      fs.mkdirSync(orphanDir);
      fs.writeFileSync(sentinel, "must survive");
      fs.symlinkSync(
        externalOutputDirectory,
        plan.outputDir,
        directorySymlinkType
      );

      const exit = await effectRuntime.runPromiseExit(
        withGenerationLock(plan, Effect.void)
      );

      const failure = expectUnsafeCleanTargetFailure(exit, "symbolic-link");
      expect(failure.message).toContain("Output preparation");
      expect(failure.message).toContain("orphan-tempdir cleanup");
      expect(fs.readFileSync(sentinel, "utf8")).toBe("must survive");
    }
  );
});

describe("Generator exact output-path safety", () => {
  test.skipIf(!canCreateDirectorySymlinks())(
    "preserves leading and trailing whitespace when guarding the production output path",
    async () => {
      const workspace = createTempWorkspace("spaced-output");
      const externalOutputDirectory = createIsolatedTempDirectory(
        "spaced-output-target"
      );
      writeTinySpec(workspace);

      // Win32 normalizes trailing ASCII spaces. NBSP is still trimmed by
      // JavaScript but remains a real Windows filename character, preserving
      // the same mismatch this regression guards on POSIX.
      const outputName = ` output${trailingPathWhitespace}`;
      const outputArgument = path.join("generated", outputName);
      const outputLink = path.join(workspace, outputArgument);
      fs.mkdirSync(path.dirname(outputLink), { recursive: true });
      fs.symlinkSync(externalOutputDirectory, outputLink, directorySymlinkType);
      const orphanDir = path.join(
        externalOutputDirectory,
        ".typeweaver-ABC123"
      );
      const sentinel = path.join(orphanDir, "keep.txt");
      fs.mkdirSync(orphanDir);
      fs.writeFileSync(sentinel, "must survive");

      const exit = await runGenerateExit(workspace, outputArgument, false);

      expectUnsafeCleanTargetFailure(exit, "symbolic-link");
      expect(fs.lstatSync(outputLink).isSymbolicLink()).toBe(true);
      expect(fs.readFileSync(sentinel, "utf8")).toBe("must survive");
    }
  );
});

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
