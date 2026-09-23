import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { writeEmptySpec, writeTinySpec } from "../helpers/specFiles.js";
import { snapshotTree } from "../helpers/treeSnapshots.js";
import {
  createWorkspace,
  generate,
  removeWorkspaces,
  writeConfig,
} from "./fixtures.js";

afterEach(removeWorkspaces);

describe("built CLI generate --check matches", () => {
  test("matches committed output and leaves it untouched with explicit flags", async () => {
    const workspace = createWorkspace();
    writeTinySpec(workspace);

    const generation = await generate(workspace, [
      "--input",
      "spec/index.ts",
      "--output",
      "generated",
      "--no-format",
    ]);
    expect(generation.code).toBe(0);
    const before = snapshotTree(path.join(workspace, "generated"));

    const result = await generate(workspace, [
      "--check",
      "--input",
      "spec/index.ts",
      "--output",
      "generated",
      "--no-format",
    ]);

    expect(result).toMatchObject({ code: 0, signal: null, stderr: "" });
    expect(result.stdout).toContain("is current");
    expect(snapshotTree(path.join(workspace, "generated"))).toEqual(before);
    expect(
      fs.existsSync(path.join(workspace, "generated", ".typeweaver-lock"))
    ).toBe(false);
  });
  test("matches committed output through the config workflow", async () => {
    const workspace = createWorkspace();
    writeTinySpec(workspace);
    const configPath = writeConfig(workspace);

    const generation = await generate(workspace, ["--config", configPath]);
    expect(generation.code).toBe(0);

    const result = await generate(workspace, [
      "--check",
      "--config",
      configPath,
    ]);

    expect(result).toMatchObject({ code: 0, signal: null, stderr: "" });
    expect(result.stdout).toContain("is current");
  });
});

describe("built CLI generate --check drift", () => {
  test("reports Added, Removed, and Changed groups and leaves output untouched", async () => {
    const workspace = createWorkspace();
    writeTinySpec(workspace);
    const configPath = writeConfig(workspace);

    const generation = await generate(workspace, ["--config", configPath]);
    expect(generation.code).toBe(0);

    const outputDir = path.join(workspace, "generated");
    fs.writeFileSync(
      path.join(outputDir, "item", "GetItemRequest.ts"),
      "// mutated committed output\n"
    );
    fs.rmSync(path.join(outputDir, "index.ts"), { force: true });
    fs.writeFileSync(path.join(outputDir, "planted.ts"), "// planted\n");
    const before = snapshotTree(outputDir);

    const result = await generate(workspace, [
      "--check",
      "--config",
      configPath,
    ]);

    expect(result).toMatchObject({ code: 1, signal: null });
    expect(result.stderr).toContain("Added");
    expect(result.stderr).toContain("index.ts");
    expect(result.stderr).toContain("Removed");
    expect(result.stderr).toContain("planted.ts");
    expect(result.stderr).toContain("Changed");
    expect(result.stderr).toContain("item/GetItemRequest.ts");
    expect(snapshotTree(outputDir)).toEqual(before);
  });
  test("reports a missing configured output as added drift without creating it", async () => {
    const workspace = createWorkspace();
    writeTinySpec(workspace);
    const configPath = writeConfig(workspace);

    const result = await generate(workspace, [
      "--check",
      "--config",
      configPath,
    ]);

    expect(result).toMatchObject({ code: 1, signal: null });
    expect(result.stderr).toContain("Added");
    expect(fs.existsSync(path.join(workspace, "generated"))).toBe(false);
  });
});

describe("built CLI generate --check clean:false", () => {
  test("snapshots the committed output before comparison", async () => {
    const workspace = createWorkspace();
    writeTinySpec(workspace);
    const configPath = writeConfig(workspace, ["  clean: false,"]);

    const generation = await generate(workspace, ["--config", configPath]);
    expect(generation.code).toBe(0);
    const sentinelPath = path.join(workspace, "generated", "keep.txt");
    fs.writeFileSync(sentinelPath, "preserved by no-clean\n");

    const result = await generate(workspace, [
      "--check",
      "--config",
      configPath,
    ]);

    expect(result).toMatchObject({ code: 0, signal: null, stderr: "" });
    expect(fs.readFileSync(sentinelPath, "utf8")).toBe(
      "preserved by no-clean\n"
    );
  });
});

describe("built CLI generate --check generation failure", () => {
  test("fails without mutating configured output", async () => {
    const workspace = createWorkspace();
    writeTinySpec(workspace);
    const configPath = writeConfig(workspace);

    const generation = await generate(workspace, ["--config", configPath]);
    expect(generation.code).toBe(0);
    const before = snapshotTree(path.join(workspace, "generated"));
    writeEmptySpec(workspace);

    const result = await generate(workspace, [
      "--check",
      "--config",
      configPath,
    ]);

    expect(result).toMatchObject({ code: 1, signal: null });
    expect(result.stderr).toContain("at least one resource");
    expect(snapshotTree(path.join(workspace, "generated"))).toEqual(before);
  });
});

describe("built CLI generate --check verbose", () => {
  test("keeps debug lock lifecycle output while matching", async () => {
    const workspace = createWorkspace();
    writeTinySpec(workspace);
    const configPath = writeConfig(workspace);

    const generation = await generate(workspace, ["--config", configPath]);
    expect(generation.code).toBe(0);

    const result = await generate(workspace, [
      "--check",
      "--config",
      configPath,
      "--verbose",
    ]);

    expect(result).toMatchObject({ code: 0, signal: null, stderr: "" });
    expect(result.stdout).toContain("[DEBUG] Acquired output lock");
    expect(result.stdout).toContain("[DEBUG] Released output lock");
    expect(result.stdout).toContain("is current");
  });
});
