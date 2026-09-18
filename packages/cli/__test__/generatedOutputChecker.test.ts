import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Cause, Exit } from "effect";
import { afterEach, describe, expect, test } from "vitest";
import { effectRuntime } from "../src/effectRuntime.js";
import { ConcurrentGenerationError } from "../src/errors/ConcurrentGenerationError.js";
import {
  acquireOutputLock,
  releaseOutputLock,
} from "../src/services/generatorIO.js";
import { GeneratedOutputChecker, Generator } from "../src/services/index.js";
import {
  canonicalHostTempDirectory,
  outputLockDirectory,
} from "../src/services/internal/outputCoordinationArtifact.js";

const tempDirs: string[] = [];

const createTempWorkspace = (suffix: string): string => {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), `typeweaver-check-${suffix}-`)
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

const listRelative = (root: string): string[] => {
  const result: string[] = [];
  if (!fs.existsSync(root)) {
    return result;
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
        result.push(relativePath);
      }
    }
  }
  return result.sort();
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
  const failure = Cause.failureOption(exit.cause);
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

describe("GeneratedOutputChecker match", () => {
  test("succeeds against a fresh generation without touching configured output", async () => {
    const workspace = createTempWorkspace("match");
    writeTinySpec(workspace);
    await runGenerate(workspace);
    const outputDir = path.join(workspace, "generated", "output");
    const before = snapshotTree(outputDir);

    await expect(
      effectRuntime.runPromise(
        GeneratedOutputChecker.check(checkParams(workspace))
      )
    ).resolves.toBeUndefined();

    expect(snapshotTree(outputDir)).toEqual(before);
    expect(fs.existsSync(path.join(outputDir, ".typeweaver-lock"))).toBe(false);
  });
});

describe("GeneratedOutputChecker drift categories", () => {
  test("reports added files only", async () => {
    const workspace = createTempWorkspace("added");
    writeTinySpec(workspace);
    await runGenerate(workspace);
    fs.rmSync(path.join(workspace, "generated", "output", "index.ts"), {
      force: true,
    });

    const exit = await effectRuntime.runPromiseExit(
      GeneratedOutputChecker.check(checkParams(workspace))
    );

    expect(extractFailure(exit)).toEqual(
      expect.objectContaining({
        _tag: "GeneratedOutputDriftError",
        added: ["index.ts"],
        removed: [],
        changed: [],
      })
    );
  });

  test("reports removed files only", async () => {
    const workspace = createTempWorkspace("removed");
    writeTinySpec(workspace);
    await runGenerate(workspace);
    fs.writeFileSync(
      path.join(workspace, "generated", "output", "planted.ts"),
      "// planted\n"
    );

    const exit = await effectRuntime.runPromiseExit(
      GeneratedOutputChecker.check(checkParams(workspace))
    );

    expect(extractFailure(exit)).toEqual(
      expect.objectContaining({
        _tag: "GeneratedOutputDriftError",
        added: [],
        removed: ["planted.ts"],
        changed: [],
      })
    );
  });

  test("reports changed files with the Changed label", async () => {
    const workspace = createTempWorkspace("changed");
    writeTinySpec(workspace);
    await runGenerate(workspace);
    fs.writeFileSync(
      path.join(workspace, "generated", "output", "item", "GetItemRequest.ts"),
      "// mutated\n"
    );

    const exit = await effectRuntime.runPromiseExit(
      GeneratedOutputChecker.check(checkParams(workspace))
    );
    const failure = extractFailure(exit);

    expect(failure).toEqual(
      expect.objectContaining({
        _tag: "GeneratedOutputDriftError",
        added: [],
        removed: [],
        changed: ["item/GetItemRequest.ts"],
      })
    );
    const message = failure instanceof Error ? failure.message : "";
    expect(message).toContain("Changed");
  });
});

describe("GeneratedOutputChecker missing output", () => {
  test("reports the exact full generated tree as added without creating it", async () => {
    const workspace = createTempWorkspace("missing");
    writeTinySpec(workspace);
    const scratchOutput = path.join(workspace, "scratch-output");
    await effectRuntime.runPromise(
      Generator.generate({
        inputFile: "spec/index.ts",
        outputDir: "scratch-output",
        config: {
          input: "spec/index.ts",
          output: "scratch-output",
          format: false,
        },
        currentWorkingDirectory: workspace,
      })
    );
    const expectedFiles = listRelative(scratchOutput);
    fs.rmSync(scratchOutput, { recursive: true, force: true });

    const exit = await effectRuntime.runPromiseExit(
      GeneratedOutputChecker.check(checkParams(workspace))
    );
    const failure = extractFailure(exit);

    expect(failure).toEqual(
      expect.objectContaining({
        _tag: "GeneratedOutputDriftError",
        added: expectedFiles,
        removed: [],
        changed: [],
      })
    );
    expect(expectedFiles.length).toBeGreaterThan(0);
    expect(fs.existsSync(path.join(workspace, "generated", "output"))).toBe(
      false
    );
  });
});

describe("GeneratedOutputChecker clean:false semantics", () => {
  test("snapshots committed output so preserved files are not drift", async () => {
    const workspace = createTempWorkspace("no-clean");
    writeTinySpec(workspace);
    await runGenerate(workspace, { clean: false });
    const outputDir = path.join(workspace, "generated", "output");
    fs.writeFileSync(path.join(outputDir, "keep.txt"), "preserved\n");
    const before = snapshotTree(outputDir);

    const exit = await effectRuntime.runPromiseExit(
      GeneratedOutputChecker.check(checkParams(workspace, false))
    );

    expect(Exit.isSuccess(exit)).toBe(true);
    expect(snapshotTree(outputDir)).toEqual(before);
    expect(fs.readFileSync(path.join(outputDir, "keep.txt"), "utf8")).toBe(
      "preserved\n"
    );
  });

  test("reports exact drift when a generated file differs under clean:false", async () => {
    const workspace = createTempWorkspace("no-clean-drift");
    writeTinySpec(workspace);
    await runGenerate(workspace, { clean: false });
    const outputDir = path.join(workspace, "generated", "output");
    fs.writeFileSync(
      path.join(outputDir, "item", "GetItemRequest.ts"),
      "// mutated\n"
    );
    const before = snapshotTree(outputDir);

    const exit = await effectRuntime.runPromiseExit(
      GeneratedOutputChecker.check(checkParams(workspace, false))
    );
    const failure = extractFailure(exit);

    expect(failure).toEqual(
      expect.objectContaining({
        _tag: "GeneratedOutputDriftError",
        added: [],
        removed: [],
        changed: ["item/GetItemRequest.ts"],
      })
    );
    expect(snapshotTree(outputDir)).toEqual(before);
  });
});

describe("GeneratedOutputChecker dependency parity", () => {
  test("mirrors ancestor lookup past a partial nearest node_modules", async () => {
    const workspace = createTempWorkspace("parity");
    const specTree = path.join(workspace, "packages", "spec-tree");
    const outputTree = path.join(workspace, "packages", "out-tree");
    // The output tree's nearest node_modules is empty; the required packages
    // only exist in the workspace-root node_modules one level higher. Normal
    // generation falls through, and the staged check must mirror that order.
    fs.mkdirSync(path.join(outputTree, "node_modules"), { recursive: true });
    fs.symlinkSync(
      path.join(process.cwd(), "node_modules"),
      path.join(workspace, "node_modules"),
      process.platform === "win32" ? "junction" : "dir"
    );
    writeTinySpecAt(specTree);

    const inputFile = "packages/spec-tree/spec/index.ts";
    const outputDir = "packages/out-tree/generated/output";
    const config = {
      input: inputFile,
      output: outputDir,
      format: false,
    } as const;

    await effectRuntime.runPromise(
      Generator.generate({
        inputFile,
        outputDir,
        config,
        currentWorkingDirectory: workspace,
      })
    );

    // The runtime import of `<output>/spec/spec.js` resolves the output
    // tree's node_modules. The staged check must mirror that and match.
    await expect(
      effectRuntime.runPromise(
        GeneratedOutputChecker.check({
          inputFile,
          outputDir,
          config,
          currentWorkingDirectory: workspace,
        })
      )
    ).resolves.toBeUndefined();
  });
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
