import fs from "node:fs";
import path from "node:path";
import { Exit } from "effect";
import { afterEach, describe, expect, test } from "vitest";
import { effectRuntime } from "../../src/effectRuntime.js";
import { GeneratedOutputChecker, Generator } from "../../src/services/index.js";
import { writeTinySpec } from "../helpers/specFiles.js";
import { snapshotTree } from "../helpers/treeSnapshots.js";
import {
  checkParams,
  createTempWorkspace,
  extractFailure,
  GENERATION_TEST_TIMEOUT_MS,
  removeTempPaths,
  runGenerate,
} from "./fixtures.js";

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

afterEach(removeTempPaths);

describe("GeneratedOutputChecker match", () => {
  test(
    "succeeds against a fresh generation without touching configured output",
    async () => {
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
      expect(fs.existsSync(path.join(outputDir, ".typeweaver-lock"))).toBe(
        false
      );
    },
    GENERATION_TEST_TIMEOUT_MS
  );
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
