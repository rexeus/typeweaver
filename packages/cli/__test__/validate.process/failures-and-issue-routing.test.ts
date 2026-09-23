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

const writeWarningPlugin = (workspace: string): void => {
  const pluginPath = path.join(workspace, "plugins", "warning-plugin.mjs");
  fs.mkdirSync(path.dirname(pluginPath), { recursive: true });
  fs.writeFileSync(
    pluginPath,
    [
      'import { Effect } from "effect";',
      "",
      "export default {",
      '  name: "warning-probe",',
      "  validate: () =>",
      "    Effect.succeed([",
      "      {",
      '        code: "TW-PLUGIN-WARNING-PROBE-001",',
      '        severity: "warning",',
      '        message: "Probe warning",',
      '        path: "/resources",',
      '        hint: "Resolve the probe warning.",',
      "        fixable: false,",
      "      },",
      "    ]),",
      "};",
      "",
    ].join("\n")
  );
};

afterEach(removeWorkspaces);

describe("built CLI validate failures", () => {
  test("reports a stable spec code and exits one without writing", async () => {
    const workspace = createWorkspace();
    writeSpec(workspace, { duplicateOperationId: true });
    const before = collectWorkspace(workspace);

    const result = await runCli(workspace, [
      "validate",
      "--input",
      "spec/index.ts",
      "--json",
    ]);

    expect(result.code).toBe(1);
    expect(result.stderr).toBe("");
    expect(parseReport(result.stdout)).toMatchObject({
      valid: false,
      summary: { error: 1, warning: 0, info: 0, total: 1 },
      issues: [
        {
          code: "TW-SPEC-003",
          severity: "error",
          path: "/resources",
        },
      ],
    });
    expect(collectWorkspace(workspace)).toBe(before);
  });
});

describe("built CLI validate issue routing", () => {
  test("applies warning thresholds to plugin validation issues", async () => {
    const workspace = createWorkspace();
    writeSpec(workspace);
    writeWarningPlugin(workspace);
    const before = collectWorkspace(workspace);
    const baseArgs = [
      "validate",
      "--input",
      "spec/index.ts",
      "--plugins",
      "./plugins/warning-plugin.mjs",
      "--json",
    ] as const;

    const normal = await runCli(workspace, baseArgs);
    const strict = await runCli(workspace, [...baseArgs, "--strict"]);
    const failOnWarning = await runCli(workspace, [
      ...baseArgs,
      "--fail-on",
      "warning",
    ]);

    expect(normal.code).toBe(0);
    expect(strict.code).toBe(1);
    expect(failOnWarning.code).toBe(1);
    expect(normal.stderr).toBe("");
    expect(strict.stderr).toBe("");
    expect(failOnWarning.stderr).toBe("");
    expect(parseReport(normal.stdout)).toMatchObject({
      valid: true,
      threshold: "error",
      summary: { error: 0, warning: 1, info: 0, total: 1 },
      issues: [{ code: "TW-PLUGIN-WARNING-PROBE-001" }],
    });
    expect(parseReport(strict.stdout)).toMatchObject({
      valid: false,
      threshold: "warning",
      issues: [{ code: "TW-PLUGIN-WARNING-PROBE-001" }],
    });
    expect(parseReport(failOnWarning.stdout)).toMatchObject({
      valid: false,
      threshold: "warning",
      issues: [{ code: "TW-PLUGIN-WARNING-PROBE-001" }],
    });
    expect(collectWorkspace(workspace)).toBe(before);
  }, 15_000);
  test("routes a failed human report to stderr", async () => {
    const workspace = createWorkspace();
    writeSpec(workspace, { duplicateOperationId: true });

    const result = await runCli(workspace, [
      "validate",
      "--input",
      "spec/index.ts",
    ]);

    expect(result.code).toBe(1);
    expect(result.stdout).toBe("Running on Node.js\n");
    expect(result.stderr).toContain(
      "[ERROR] TW-SPEC-003 /resources: Operation ID 'ping' must be globally unique within a spec."
    );
    expect(result.stderr).toContain(
      "Validation failed: 1 error(s), 0 warning(s), 0 info issue(s)."
    );
  });
});
