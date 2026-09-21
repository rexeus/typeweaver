import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { DoctorReportSchema } from "../src/index.js";
import type { DoctorReport } from "../src/index.js";
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
  "doctor-process"
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

const writeSpec = (workspace: string): void => {
  const specPath = path.join(workspace, "spec", "index.ts");
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
      '  metadata: { title: "Doctor API", version: "1.0.0" },',
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
      "  },",
      "});",
      "",
    ].join("\n")
  );
};

const writeWorkspaceManifest = (
  workspace: string,
  effectVersion?: string
): void => {
  fs.writeFileSync(
    path.join(workspace, "package.json"),
    `${JSON.stringify(
      {
        name: "doctor-workspace",
        private: true,
        version: "1.0.0",
        dependencies:
          effectVersion === undefined ? {} : { effect: effectVersion },
      },
      null,
      2
    )}\n`
  );
  if (effectVersion === undefined) {
    return;
  }
  const effectDirectory = path.join(workspace, "node_modules", "effect");
  fs.mkdirSync(effectDirectory, { recursive: true });
  fs.writeFileSync(
    path.join(effectDirectory, "package.json"),
    `${JSON.stringify({ name: "effect", version: effectVersion }, null, 2)}\n`
  );
};

const writeWorkspaceManifestWithSpecifier = (
  workspace: string,
  specifier: string,
  resolvedVersion?: string
): void => {
  fs.writeFileSync(
    path.join(workspace, "package.json"),
    `${JSON.stringify(
      {
        name: "doctor-workspace",
        private: true,
        version: "1.0.0",
        dependencies: { effect: specifier },
      },
      null,
      2
    )}\n`
  );
  if (resolvedVersion === undefined) {
    return;
  }
  const effectDirectory = path.join(workspace, "node_modules", "effect");
  fs.mkdirSync(effectDirectory, { recursive: true });
  fs.writeFileSync(
    path.join(effectDirectory, "package.json"),
    `${JSON.stringify({ name: "effect", version: resolvedVersion }, null, 2)}\n`
  );
};

// Deep validation links the nearest `node_modules` into its OS-temp stage.
// A workspace that keeps a local `node_modules` (for example to hold the exact
// Effect RC) must also expose the contract runtime there, or the staged spec
// cannot import `@rexeus/typeweaver-core`.
const linkWorkspaceContractRuntime = (workspace: string): void => {
  const rexeusDirectory = path.join(workspace, "node_modules", "@rexeus");
  fs.mkdirSync(rexeusDirectory, { recursive: true });
  fs.symlinkSync(
    path.join(packageDirectory, "node_modules", "@rexeus", "typeweaver-core"),
    path.join(rexeusDirectory, "typeweaver-core"),
    "dir"
  );
};

const writeValidatingPlugin = (
  workspace: string
): { readonly pluginPath: string; readonly markerPath: string } => {
  const pluginPath = path.join(workspace, "plugins", "validating.mjs");
  const markerPath = path.join(workspace, "plugins", "validated.marker");
  fs.mkdirSync(path.dirname(pluginPath), { recursive: true });
  fs.writeFileSync(
    pluginPath,
    [
      'import { writeFileSync } from "node:fs";',
      'import { Effect } from "effect";',
      "",
      "export default {",
      '  name: "validating-custom",',
      "  validate: () => Effect.sync(() => {",
      '    writeFileSync(new URL("./validated.marker", import.meta.url), "ran\\n");',
      "    return [];",
      "  }),",
      "};",
      "",
    ].join("\n")
  );
  return { pluginPath, markerPath };
};

const parseReport = (stdout: string): DoctorReport => {
  const parsed: unknown = JSON.parse(stdout);
  return DoctorReportSchema.parse(parsed);
};

const checksByCode = (
  report: DoctorReport
): ReadonlyMap<string, DoctorReport["checks"][number]> =>
  new Map(report.checks.map(check => [check.code, check]));

afterEach(() => {
  for (const workspace of workspaces) {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
  workspaces.length = 0;
});

const expectCheck = async (
  result: ProcessResult,
  code: string
): Promise<DoctorReport["checks"][number]> => {
  expect(result.stderr).toBe("");
  const check = checksByCode(parseReport(result.stdout)).get(code);
  expect(check).toBeDefined();
  if (check === undefined) {
    throw new Error(`missing ${code}`);
  }
  return check;
};

describe("built CLI deep validation gating", () => {
  test("does not execute an undeclared custom plugin validate hook", async () => {
    const workspace = createWorkspace();
    writeSpec(workspace);
    writeWorkspaceManifest(workspace);
    const { pluginPath, markerPath } = writeValidatingPlugin(workspace);

    const result = await runCli(workspace, [
      "doctor",
      "--input",
      "spec/index.ts",
      "--output",
      "generated",
      "--plugins",
      pluginPath,
      "--deep",
      "--json",
    ]);

    expect(result.code).toBe(1);
    const checks = checksByCode(parseReport(result.stdout));
    expect(checks.get("TW-DOCTOR-011")).toMatchObject({ outcome: "fail" });
    expect(checks.get("TW-DOCTOR-010")).toMatchObject({ outcome: "skip" });
    expect(fs.existsSync(markerPath)).toBe(false);
  });
  test("does not execute a custom plugin validate hook in an exact native workspace", async () => {
    const workspace = createWorkspace();
    writeSpec(workspace);
    writeWorkspaceManifest(workspace, "4.0.0-rc.116");
    const { pluginPath, markerPath } = writeValidatingPlugin(workspace);

    const result = await runCli(workspace, [
      "doctor",
      "--input",
      "spec/index.ts",
      "--output",
      "generated",
      "--plugins",
      pluginPath,
      "--deep",
      "--json",
    ]);

    expect(result.code).toBe(1);
    const checks = checksByCode(parseReport(result.stdout));
    expect(checks.get("TW-DOCTOR-011")).toMatchObject({ outcome: "pass" });
    expect(checks.get("TW-DOCTOR-010")).toMatchObject({ outcome: "skip" });
    expect(fs.existsSync(markerPath)).toBe(false);
  });
});

describe("built CLI deep validation for plain projections", () => {
  test("still runs deep validation for plain projections at the exact RC", async () => {
    const workspace = createWorkspace();
    writeSpec(workspace);
    writeWorkspaceManifest(workspace, "4.0.0-rc.116");
    linkWorkspaceContractRuntime(workspace);

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
    const checks = checksByCode(parseReport(result.stdout));
    expect(checks.get("TW-DOCTOR-011")).toMatchObject({ outcome: "pass" });
    expect(checks.get("TW-DOCTOR-010")).toMatchObject({ outcome: "pass" });
  });
  test("still runs deep validation for the exact native workspace", async () => {
    const workspace = createWorkspace();
    writeSpec(workspace);
    writeWorkspaceManifestWithSpecifier(
      workspace,
      "4.0.0-rc.116",
      "4.0.0-rc.116"
    );

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
    const checks = checksByCode(parseReport(result.stdout));
    expect(checks.get("TW-DOCTOR-011")).toMatchObject({ outcome: "pass" });
    expect(checks.get("TW-DOCTOR-010")).toMatchObject({ outcome: "pass" });
  });
});

describe("built CLI declaration verification", () => {
  test("fails when the project declares the RC but only a parent Effect 3 resolves", async () => {
    const workspace = createWorkspace();
    writeSpec(workspace);
    writeWorkspaceManifestWithSpecifier(workspace, "4.0.0-rc.116", "3.22.5");

    const result = await runCli(workspace, [
      "doctor",
      "--input",
      "spec/index.ts",
      "--output",
      "generated",
      "--json",
    ]);

    expect(result.code).toBe(1);
    const check = await expectCheck(result, "TW-DOCTOR-011");
    expect(check.outcome).toBe("fail");
    expect(check.message).toContain("does not satisfy");
  });
});
