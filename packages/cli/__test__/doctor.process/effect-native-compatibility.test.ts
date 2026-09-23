import { afterEach, describe, expect, test } from "vitest";
import { runCli } from "../helpers/builtCli.js";
import {
  createWorkspace,
  expectCheck,
  removeWorkspaces,
  writeExternalPlugin,
  writeSpec,
  writeWorkspaceManifest,
} from "./fixtures.js";

afterEach(removeWorkspaces);

describe("built CLI Effect-native incompatibility", () => {
  test("passes for an exact native workspace that configures the Effect projection", async () => {
    const workspace = createWorkspace();
    writeSpec(workspace);
    writeWorkspaceManifest(workspace, "4.0.0-rc.116");

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

    expect(result.code).toBe(0);
    const check = await expectCheck(result, "TW-DOCTOR-011");
    expect(check.outcome).toBe("pass");
    expect(check.message).toContain("exact native Effect");
  });
  test("passes for an exact native workspace with a custom plugin", async () => {
    const workspace = createWorkspace();
    writeSpec(workspace);
    writeWorkspaceManifest(workspace, "4.0.0-rc.116");
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

    expect(result.code).toBe(0);
    const check = await expectCheck(result, "TW-DOCTOR-011");
    expect(check.outcome).toBe("pass");
    expect(check.message).toContain("exact native Effect");
  });

  test.each([
    "command",
    "@rexeus/typeweaver-command",
    "openapi",
    "@rexeus/typeweaver-openapi",
  ])(
    "fails for %s when the workspace resolves the wrong Effect version",
    async plugin => {
      const workspace = createWorkspace();
      writeSpec(workspace);
      writeWorkspaceManifest(workspace, "4.0.0-rc.115");

      const result = await runCli(workspace, [
        "doctor",
        "--input",
        "spec/index.ts",
        "--output",
        "generated",
        "--plugins",
        plugin,
        "--json",
      ]);

      expect(result.code).toBe(1);
      const check = await expectCheck(result, "TW-DOCTOR-011");
      expect(check.outcome).toBe("fail");
      expect(check.message).toContain(plugin);
      expect(check.message).toContain("4.0.0-rc.116");
    }
  );

  test("renders the workspace compatibility pass in human output", async () => {
    const workspace = createWorkspace();
    writeSpec(workspace);
    writeWorkspaceManifest(workspace, "4.0.0-rc.116");

    const result = await runCli(workspace, [
      "doctor",
      "--input",
      "spec/index.ts",
      "--output",
      "generated",
    ]);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain(
      "[PASS] TW-DOCTOR-011 workspace Effect compatibility:"
    );
  });
});
