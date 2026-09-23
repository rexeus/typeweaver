import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { runCli } from "../helpers/builtCli.js";
import { collectWorkspace } from "../helpers/treeSnapshots.js";
import {
  checksByCode,
  createWorkspace,
  parseReport,
  removeWorkspaces,
  writeSpec,
} from "./fixtures.js";

afterEach(removeWorkspaces);

describe("built CLI doctor workflow", () => {
  test("runs standard and deep checks without changing the project", async () => {
    const workspace = createWorkspace();
    writeSpec(workspace);
    const before = collectWorkspace(workspace);

    const result = await runCli(workspace, [
      "doctor",
      "--input",
      "spec/index.ts",
      "--output",
      "generated",
      "--deep",
      "--json",
    ]);

    expect(result.code).toBe(0);
    expect(result.stderr).toBe("");
    const report = parseReport(result.stdout);
    expect(report.healthy).toBe(true);
    expect(report.summary.fail).toBe(0);
    expect(checksByCode(report).get("TW-DOCTOR-010")).toMatchObject({
      name: "deep spec validation",
      outcome: "pass",
    });
    expect(collectWorkspace(workspace)).toBe(before);
  }, 15_000);
  test("fails input resolution and skips dependent deep validation", async () => {
    const workspace = createWorkspace();
    const before = collectWorkspace(workspace);

    const result = await runCli(workspace, [
      "doctor",
      "--output",
      "generated",
      "--deep",
      "--json",
    ]);

    expect(result.code).toBe(1);
    expect(result.stderr).toBe("");
    const report = parseReport(result.stdout);
    const checks = checksByCode(report);
    expect(report.healthy).toBe(false);
    expect(checks.get("TW-DOCTOR-005")?.outcome).toBe("fail");
    expect(checks.get("TW-DOCTOR-010")?.outcome).toBe("skip");
    expect(collectWorkspace(workspace)).toBe(before);
  }, 15_000);
  test("reports an unavailable configured plugin", async () => {
    const workspace = createWorkspace();
    writeSpec(workspace);

    const result = await runCli(workspace, [
      "doctor",
      "--input",
      "spec/index.ts",
      "--output",
      "generated",
      "--plugins",
      "./plugins/missing.mjs",
      "--json",
    ]);

    expect(result.code).toBe(1);
    expect(result.stderr).toBe("");
    const report = parseReport(result.stdout);
    expect(checksByCode(report).get("TW-DOCTOR-006")).toMatchObject({
      name: "plugin availability",
      outcome: "fail",
    });
  });
});

describe("built CLI doctor report and output safety", () => {
  test("renders a stable human report", async () => {
    const workspace = createWorkspace();
    writeSpec(workspace);

    const result = await runCli(workspace, [
      "doctor",
      "--input",
      "spec/index.ts",
      "--output",
      "generated",
    ]);

    expect(result.code).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Running on Node.js\n");
    expect(result.stdout).toContain(
      "[PASS] TW-DOCTOR-001 runtime detection: Detected Node.js."
    );
    expect(result.stdout).toContain(
      "[SKIP] TW-DOCTOR-010 deep spec validation: Deep validation was not requested."
    );
    expect(result.stdout).toContain("Doctor passed:");
  });
  test("rejects an output target that is an existing file", async () => {
    const workspace = createWorkspace();
    writeSpec(workspace);
    fs.writeFileSync(path.join(workspace, "generated"), "not a directory\n");

    const result = await runCli(workspace, [
      "doctor",
      "--input",
      "spec/index.ts",
      "--output",
      "generated",
      "--json",
    ]);

    expect(result.code).toBe(1);
    expect(result.stderr).toBe("");
    expect(
      checksByCode(parseReport(result.stdout)).get("TW-DOCTOR-007")
    ).toMatchObject({
      name: "output target",
      outcome: "fail",
    });
  });
});
