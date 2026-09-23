import { afterEach, describe, expect, test } from "vitest";
import { runCli } from "../helpers/builtCli.js";
import {
  checksByCode,
  createWorkspace,
  expectCheck,
  parseReport,
  removeWorkspaces,
  writeExternalPlugin,
  writeSpec,
  writeWorkspaceManifest,
} from "./fixtures.js";

afterEach(removeWorkspaces);

describe("built CLI project-owned Effect resolution", () => {
  test("skips when the project does not declare Effect", async () => {
    const workspace = createWorkspace();
    writeSpec(workspace);
    writeWorkspaceManifest(workspace);

    const result = await runCli(workspace, [
      "doctor",
      "--input",
      "spec/index.ts",
      "--output",
      "generated",
      "--json",
    ]);

    expect(result.code).toBe(0);
    const check = await expectCheck(result, "TW-DOCTOR-011");
    expect(check.outcome).toBe("skip");
  });
  test("passes the exact native Effect RC with plain projections", async () => {
    const workspace = createWorkspace();
    writeSpec(workspace);
    writeWorkspaceManifest(workspace, "4.0.0-rc.116");

    const result = await runCli(workspace, [
      "doctor",
      "--input",
      "spec/index.ts",
      "--output",
      "generated",
      "--json",
    ]);

    expect(result.code).toBe(0);
    const report = parseReport(result.stdout);
    expect(report.healthy).toBe(true);
    expect(checksByCode(report).get("TW-DOCTOR-008")).toMatchObject({
      name: "CLI Effect runtime",
      outcome: "pass",
    });
    const check = checksByCode(report).get("TW-DOCTOR-011");
    expect(check).toMatchObject({
      name: "workspace Effect compatibility",
      outcome: "pass",
    });
    expect(check?.message).toContain("4.0.0-rc.116");
    expect(check?.message).toContain("exact native Effect");
  });
  test("warns for any other Effect version", async () => {
    const workspace = createWorkspace();
    writeSpec(workspace);
    writeWorkspaceManifest(workspace, "4.0.0-rc.90");

    const result = await runCli(workspace, [
      "doctor",
      "--input",
      "spec/index.ts",
      "--output",
      "generated",
      "--json",
    ]);

    expect(result.code).toBe(0);
    const check = await expectCheck(result, "TW-DOCTOR-011");
    expect(check.outcome).toBe("warn");
    expect(check.message).toContain("4.0.0-rc.116");
    expect(check.message).toContain("not the exact native");
  });
});

describe("built CLI undeclared native surfaces", () => {
  test("fails for an undeclared project that configures the Effect projection", async () => {
    const workspace = createWorkspace();
    writeSpec(workspace);
    writeWorkspaceManifest(workspace);

    const result = await runCli(workspace, [
      "doctor",
      "--input",
      "spec/index.ts",
      "--output",
      "generated",
      "--plugins",
      "server,effect",
      "--json",
    ]);

    expect(result.code).toBe(1);
    const check = await expectCheck(result, "TW-DOCTOR-011");
    expect(check.outcome).toBe("fail");
    expect(check.message).toContain("does not declare Effect");
    expect(check.message).toContain("project-owned Effect");
  });
  test("fails for an undeclared project that configures a custom plugin", async () => {
    const workspace = createWorkspace();
    writeSpec(workspace);
    writeWorkspaceManifest(workspace);
    const pluginPath = writeExternalPlugin(workspace);

    const result = await runCli(workspace, [
      "doctor",
      "--input",
      "spec/index.ts",
      "--output",
      "generated",
      "--plugins",
      pluginPath,
      "--json",
    ]);

    expect(result.code).toBe(1);
    const check = await expectCheck(result, "TW-DOCTOR-011");
    expect(check.outcome).toBe("fail");
    expect(check.message).toContain(pluginPath);
  });

  test("fails for an undeclared project that configures the scoped Effect projection", async () => {
    const workspace = createWorkspace();
    writeSpec(workspace);
    writeWorkspaceManifest(workspace);

    const result = await runCli(workspace, [
      "doctor",
      "--input",
      "spec/index.ts",
      "--output",
      "generated",
      "--plugins",
      "hono,@rexeus/typeweaver-effect",
      "--json",
    ]);

    expect(result.code).toBe(1);
    const check = await expectCheck(result, "TW-DOCTOR-011");
    expect(check.outcome).toBe("fail");
    expect(check.message).toContain("runtime: @rexeus/typeweaver-effect.");
  });
});

describe("built CLI undeclared CLI-hosted generators", () => {
  test.each([
    "hono",
    "@rexeus/typeweaver-hono",
    "command",
    "@rexeus/typeweaver-command",
    "openapi",
    "@rexeus/typeweaver-openapi",
  ])("skips an undeclared project that configures %s", async plugin => {
    const workspace = createWorkspace();
    writeSpec(workspace);
    writeWorkspaceManifest(workspace);

    const result = await runCli(workspace, [
      "doctor",
      "--input",
      "spec/index.ts",
      "--output",
      "generated",
      "--plugins",
      `types,${plugin}`,
      "--json",
    ]);

    expect(result.code).toBe(0);
    const check = await expectCheck(result, "TW-DOCTOR-011");
    expect(check.outcome).toBe("skip");
    expect(check.message).toContain(`CLI-hosted generators (${plugin})`);
    expect(check.message).not.toContain("no Effect-native");
  });
});
