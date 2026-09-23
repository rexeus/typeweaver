import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { runCli } from "../helpers/builtCli.js";
import { collectWorkspace } from "../helpers/treeSnapshots.js";
import {
  createWorkspace,
  parseReport,
  removeWorkspaces,
  writeSpec,
} from "./fixtures.js";

const writeStagingProbePlugin = (workspace: string): void => {
  const pluginPath = path.join(workspace, "plugins", "staging-probe.mjs");
  fs.mkdirSync(path.dirname(pluginPath), { recursive: true });
  fs.writeFileSync(
    pluginPath,
    [
      'import fs from "node:fs";',
      'import { Effect } from "effect";',
      "",
      "export default {",
      '  name: "staging-probe",',
      "  validate: () =>",
      "    Effect.sync(() => {",
      "      const stagingEntries = fs",
      "        .readdirSync(process.cwd())",
      '        .filter(entry => entry.startsWith(".typeweaver-validate-"));',
      "      return stagingEntries.length === 0",
      "        ? []",
      "        : [",
      "            {",
      '              code: "TW-PLUGIN-STAGING-PROBE-001",',
      '              severity: "warning",',
      '              message: "Validation staging is visible inside the project.",',
      '              path: "/",',
      '              hint: "Stage validation outside the project tree.",',
      "              fixable: false,",
      "            },",
      "          ];",
      "    }),",
      "};",
      "",
    ].join("\n")
  );
};

const writeUserTempProbePlugin = (workspace: string): void => {
  const pluginPath = path.join(workspace, "plugins", "user-temp-probe.mjs");
  fs.mkdirSync(path.dirname(pluginPath), { recursive: true });
  fs.writeFileSync(
    pluginPath,
    [
      'import fs from "node:fs";',
      'import os from "node:os";',
      'import { Effect } from "effect";',
      "",
      "export default {",
      '  name: "user-temp-probe",',
      "  validate: () =>",
      "    Effect.sync(() => {",
      "      const hasValidationStage = fs",
      "        .readdirSync(os.tmpdir())",
      '        .some(entry => entry.startsWith("typeweaver-validate-"));',
      "      return hasValidationStage",
      "        ? []",
      "        : [",
      "            {",
      '              code: "TW-PLUGIN-USER-TEMP-PROBE-001",',
      '              severity: "error",',
      '              message: "Validation did not stage under the user temp directory.",',
      '              path: "/",',
      '              hint: "Preserve the validation temp-directory contract.",',
      "              fixable: false,",
      "            },",
      "          ];",
      "    }),",
      "};",
      "",
    ].join("\n")
  );
};

afterEach(removeWorkspaces);

describe("built CLI validate workflow", () => {
  test("emits a successful JSON report without changing the project", async () => {
    const workspace = createWorkspace();
    writeSpec(workspace);
    const before = collectWorkspace(workspace);

    const result = await runCli(workspace, [
      "validate",
      "--input",
      "spec/index.ts",
      "--json",
    ]);

    expect(result.code).toBe(0);
    expect(result.stderr).toBe("");
    expect(parseReport(result.stdout)).toMatchObject({
      version: 1,
      command: "validate",
      valid: true,
      threshold: "error",
      summary: { error: 0, warning: 0, info: 0, total: 0 },
      issues: [],
    });
    expect(collectWorkspace(workspace)).toBe(before);
  });
  test("does not expose validation staging directories to project plugins", async () => {
    const workspace = createWorkspace();
    writeSpec(workspace);
    writeStagingProbePlugin(workspace);

    const result = await runCli(workspace, [
      "validate",
      "--input",
      "spec/index.ts",
      "--plugins",
      "./plugins/staging-probe.mjs",
      "--json",
    ]);

    expect(result.code).toBe(0);
    expect(parseReport(result.stdout)).toMatchObject({
      valid: true,
      issues: [],
    });
  });
});

describe("built CLI validate temp isolation", () => {
  test("stages validation under the configured user temp directory", async () => {
    const workspace = createWorkspace();
    const userTempDirectory = createWorkspace();
    writeSpec(workspace);
    writeUserTempProbePlugin(workspace);

    const result = await runCli(
      workspace,
      [
        "validate",
        "--input",
        "spec/index.ts",
        "--plugins",
        "./plugins/user-temp-probe.mjs",
        "--json",
      ],
      {
        environment: {
          TEMP: userTempDirectory,
          TMP: userTempDirectory,
          TMPDIR: userTempDirectory,
        },
      }
    );

    expect(result.code).toBe(0);
    expect(parseReport(result.stdout)).toMatchObject({
      valid: true,
      issues: [],
    });
    expect(fs.readdirSync(userTempDirectory)).toEqual([]);
  });
  test("does not resolve spec dependencies from the user temp parent", async () => {
    const workspace = createWorkspace();
    const userTempDirectory = createWorkspace();
    const packageName = `typeweaver-validate-temp-probe-${String(process.pid)}-${Date.now().toString(36)}`;
    const packageDirectory = path.join(
      userTempDirectory,
      "node_modules",
      packageName
    );
    const sentinel = path.join(workspace, "executed.txt");
    writeSpec(workspace);
    const specPath = path.join(workspace, "spec", "index.ts");
    fs.writeFileSync(
      specPath,
      [
        `import ${JSON.stringify(packageName)};`,
        fs.readFileSync(specPath, "utf8"),
      ].join("\n")
    );
    fs.mkdirSync(packageDirectory, { recursive: true });
    fs.writeFileSync(
      path.join(packageDirectory, "package.json"),
      JSON.stringify({
        name: packageName,
        type: "module",
        exports: "./index.js",
      })
    );
    fs.writeFileSync(
      path.join(packageDirectory, "index.js"),
      [
        'import fs from "node:fs";',
        `fs.writeFileSync(${JSON.stringify(sentinel)}, "executed\\n");`,
        "",
      ].join("\n")
    );

    const result = await runCli(
      workspace,
      ["validate", "--input", "spec/index.ts", "--json"],
      {
        environment: {
          TEMP: userTempDirectory,
          TMP: userTempDirectory,
          TMPDIR: userTempDirectory,
        },
      }
    );

    expect(result.code).toBe(1);
    expect(fs.existsSync(sentinel)).toBe(false);
  });
});
