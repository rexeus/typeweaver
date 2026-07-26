import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { ValidationReportSchema } from "../src/index.js";
import type { ValidationReport } from "../src/index.js";
import type { ChildProcess } from "node:child_process";

type ProcessResult = {
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;
};

const packageDirectory = path.resolve(import.meta.dirname, "..");
const cliEntry = path.join(packageDirectory, "bin", "typeweaver.mjs");
const outputsDirectory = path.join(
  packageDirectory,
  "test",
  "outputs",
  "validate-process"
);
const workspaces: string[] = [];

const runCli = (
  workspace: string,
  args: readonly string[]
): Promise<ProcessResult> =>
  new Promise((resolve, reject) => {
    const child: ChildProcess = spawn(process.execPath, [cliEntry, ...args], {
      cwd: workspace,
      env: {
        ...process.env,
        FORCE_COLOR: "0",
        NO_COLOR: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", chunk => {
      stdout += String(chunk);
    });
    child.stderr?.on("data", chunk => {
      stderr += String(chunk);
    });
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`Built CLI process timed out: ${args.join(" ")}`));
    }, 15_000);
    child.once("error", error => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("close", code => {
      clearTimeout(timeout);
      resolve({
        code,
        stdout: stdout.replace(/\r\n/g, "\n"),
        stderr: stderr.replace(/\r\n/g, "\n"),
      });
    });
  });

const createWorkspace = (): string => {
  fs.mkdirSync(outputsDirectory, { recursive: true });
  const workspace = fs.mkdtempSync(path.join(outputsDirectory, "workspace-"));
  workspaces.push(workspace);
  return workspace;
};

const writeSpec = (
  workspace: string,
  options: { readonly duplicateOperationId?: boolean } = {}
): void => {
  const specPath = path.join(workspace, "spec", "index.ts");
  const duplicateResource = options.duplicateOperationId
    ? [
        "    duplicate: {",
        "      operations: [",
        "        defineOperation({",
        '          operationId: "ping",',
        '          path: "/duplicate",',
        "          method: HttpMethod.GET,",
        '          summary: "Duplicate ping",',
        "          request: {},",
        "          responses: [ok],",
        "        }),",
        "      ],",
        "    },",
      ]
    : [];

  fs.mkdirSync(path.dirname(specPath), { recursive: true });
  fs.writeFileSync(
    specPath,
    [
      'import { defineOperation, defineResponse, defineSpec, HttpMethod, HttpStatusCode } from "@rexeus/typeweaver-core";',
      "",
      "const ok = defineResponse({",
      '  name: "Ok",',
      "  statusCode: HttpStatusCode.OK,",
      '  description: "OK",',
      "});",
      "",
      "export const spec = defineSpec({",
      '  metadata: { title: "Validation API", version: "1.0.0" },',
      "  resources: {",
      "    health: {",
      "      operations: [",
      "        defineOperation({",
      '          operationId: "ping",',
      '          path: "/ping",',
      "          method: HttpMethod.GET,",
      '          summary: "Ping",',
      "          request: {},",
      "          responses: [ok],",
      "        }),",
      "      ],",
      "    },",
      ...duplicateResource,
      "  },",
      "});",
      "",
    ].join("\n")
  );
};

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

const collectWorkspace = (workspace: string): string => {
  const files: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of fs
      .readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name))) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(entryPath);
      } else {
        files.push(path.relative(workspace, entryPath));
      }
    }
  };
  visit(workspace);
  return files
    .map(
      file =>
        `${file.replaceAll(path.sep, "/")}\0${fs.readFileSync(path.join(workspace, file), "utf8")}`
    )
    .join("\0");
};

const parseReport = (stdout: string): ValidationReport => {
  const parsed: unknown = JSON.parse(stdout);
  return ValidationReportSchema.parse(parsed);
};

afterEach(() => {
  for (const workspace of workspaces) {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
  workspaces.length = 0;
});

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
