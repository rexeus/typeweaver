import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { packageDirectory, runCli } from "../helpers/builtCli.js";
import { createWorkspace, removeWorkspaces, writeSpec } from "./fixtures.js";

const packageManifest = JSON.parse(
  fs.readFileSync(path.join(packageDirectory, "package.json"), "utf8")
) as { readonly version: string };

const packageVersion = packageManifest.version;

const writeFormattingPlugin = (workspace: string): string => {
  const pluginPath = path.join(workspace, "plugins", "formatting-plugin.mjs");
  fs.mkdirSync(path.dirname(pluginPath), { recursive: true });
  fs.writeFileSync(
    pluginPath,
    [
      'import { Effect } from "effect";',
      "",
      "export default {",
      '  name: "process-formatting-plugin",',
      "  generate: context =>",
      "    Effect.sync(() => {",
      "      context.writeFile(",
      '        "plugin/Formatted.ts",',
      "        'export const formatted={name:\"plugin\",enabled:true};\\\\n'",
      "      );",
      "    }),",
      "};",
      "",
    ].join("\n")
  );
  return pluginPath;
};

const writeDefectPlugin = (workspace: string): string => {
  const pluginPath = path.join(workspace, "plugins", "defect-plugin.mjs");
  fs.mkdirSync(path.dirname(pluginPath), { recursive: true });
  fs.writeFileSync(
    pluginPath,
    [
      'import { Effect } from "effect";',
      "",
      "export default {",
      '  name: "process-defect-plugin",',
      "  generate: () => Effect.die(new Error('process plugin defect')),",
      "};",
      "",
    ].join("\n")
  );
  return pluginPath;
};

const writeFailingPlugin = (workspace: string): string => {
  const pluginPath = path.join(workspace, "plugins", "failing-plugin.mjs");
  fs.mkdirSync(path.dirname(pluginPath), { recursive: true });
  fs.writeFileSync(
    pluginPath,
    [
      'import { Effect } from "effect";',
      'import { PluginExecutionError } from "@rexeus/typeweaver-gen";',
      "",
      "export default {",
      '  name: "process-failing-plugin",',
      "  generate: () =>",
      "    Effect.fail(new PluginExecutionError({",
      '      pluginName: "process-failing-plugin",',
      '      phase: "generate",',
      '      cause: new Error("boom"),',
      "    })),",
      "};",
      "",
    ].join("\n")
  );
  return pluginPath;
};

afterEach(removeWorkspaces);

describe("built CLI plugin failure rendering", () => {
  test("renders a typed plugin failure once on stderr with exit code 1", async () => {
    const workspace = createWorkspace();
    writeSpec(workspace);
    const pluginPath = writeFailingPlugin(workspace);

    const result = await runCli(workspace, [
      "generate",
      "--input",
      "spec/index.ts",
      "--output",
      "generated",
      "--plugins",
      pluginPath,
      "--no-format",
    ]);

    expect(result).toMatchObject({ code: 1, signal: null });
    expect(result.stdout).toContain("Running on Node.js");
    expect(result.stdout).not.toContain("Generation complete!");
    expect(result.stderr).toBe(
      "Plugin 'process-failing-plugin' failed during generate: boom\n"
    );
    expect(result.stderr).not.toContain("FiberFailure");
    expect(result.stderr).not.toMatch(/\n\s+at /);
  });
  test("renders a plugin defect once on stderr with exit code 1", async () => {
    const workspace = createWorkspace();
    writeSpec(workspace);
    const pluginPath = writeDefectPlugin(workspace);

    const result = await runCli(workspace, [
      "generate",
      "--input",
      "spec/index.ts",
      "--output",
      "generated",
      "--plugins",
      pluginPath,
      "--no-format",
    ]);

    expect(result).toMatchObject({ code: 1, signal: null });
    expect(result.stdout).toContain("Running on Node.js");
    expect(result.stdout).not.toContain("Generation complete!");
    expect(result.stderr).toBe("process plugin defect\n");
    expect(result.stderr).not.toContain("FiberFailure");
  });
});

describe("built CLI flag and verbosity handling", () => {
  test("gives negative flags precedence when conflicting flags are present", async () => {
    const workspace = createWorkspace();
    await expect(import("oxfmt")).resolves.toEqual(
      expect.objectContaining({
        format: expect.any(Function) as unknown,
      }) as unknown
    );
    writeSpec(workspace);
    const pluginPath = writeFormattingPlugin(workspace);
    const outputPath = path.join(workspace, "generated");
    const sentinelPath = path.join(outputPath, "keep.txt");
    fs.mkdirSync(outputPath, { recursive: true });
    fs.writeFileSync(sentinelPath, "preserved\n");

    const result = await runCli(workspace, [
      "generate",
      "--input",
      "spec/index.ts",
      "--output",
      "generated",
      "--plugins",
      pluginPath,
      "--format",
      "--no-format",
      "--clean",
      "--no-clean",
    ]);

    expect(result).toMatchObject({ code: 0, signal: null, stderr: "" });
    expect(fs.readFileSync(sentinelPath, "utf8")).toBe("preserved\n");
    expect(
      fs.readFileSync(path.join(outputPath, "plugin", "Formatted.ts"), "utf8")
    ).toBe('export const formatted={name:"plugin",enabled:true};\\n');
  });
  test("enables debug records only for the verbose runtime", async () => {
    const workspace = createWorkspace();
    writeSpec(workspace);

    const result = await runCli(workspace, [
      "generate",
      "--input",
      "spec/index.ts",
      "--output",
      "generated",
      "--no-format",
      "--verbose",
    ]);

    expect(result).toMatchObject({ code: 0, signal: null, stderr: "" });
    expect(result.stdout).toContain("[DEBUG] Input file:");
    expect(result.stdout).toContain("[DEBUG] Acquired output lock");
    expect(result.stdout).toContain("[DEBUG] Released output lock");
  });
  test("reports the package version through Commander's historical -V alias", async () => {
    const workspace = createWorkspace();
    const result = await runCli(workspace, ["-V"]);

    expect(result).toMatchObject({ code: 0, signal: null, stderr: "" });
    expect(result.stdout).toBe(`Running on Node.js\n${packageVersion}\n\n`);
    expect(result.stdout).not.toContain("[DEBUG]");
  });
});

describe("built CLI parser diagnostics", () => {
  test("renders one native unknown-option diagnostic with command help", async () => {
    const workspace = createWorkspace();

    const result = await runCli(workspace, ["generate", "--unknown"]);

    expect(result).toMatchObject({ code: 1, signal: null });
    expect(result.stdout).toContain("USAGE\n  typeweaver generate [flags]");
    expect(result.stderr).toBe(
      "\nERROR\n  Unrecognized flag: --unknown in command typeweaver generate\n"
    );
    expect(result.stderr).not.toContain("FiberFailure");
    expect(result.stderr).not.toContain("Received unknown argument");
  });

  test.each([
    ["init", ["init"]],
    ["add plugin target", ["add", "plugin", "--name", "example"]],
    ["add plugin name", ["add", "plugin", "--target", "example"]],
  ])("renders native help for missing %s", async (_scenario, args) => {
    const workspace = createWorkspace();
    const result = await runCli(workspace, args);

    expect(result.code).toBe(1);
    expect(result.stdout).toContain("USAGE");
    expect(result.stderr).toMatch(
      /\nERROR\n  Missing required flag: --(?:target|name)\n/u
    );
    expect(result.stderr.match(/\nERROR\n/g)).toHaveLength(1);
    expect(result.stderr).not.toContain("FiberFailure");
  });
  test("accepts a string option value beginning with a dash", async () => {
    const workspace = createWorkspace();
    const result = await runCli(workspace, [
      "init",
      "--target=-leading-target",
      "--dry-run",
      "--json",
    ]);

    expect(result).toMatchObject({ code: 0, signal: null, stderr: "" });
    expect(result.stdout).toContain('"targetDir":');
    expect(result.stdout).toContain("-leading-target");
  });
});
