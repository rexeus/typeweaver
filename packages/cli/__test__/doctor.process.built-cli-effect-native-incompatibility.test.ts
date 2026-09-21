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

const writeExternalPlugin = (workspace: string): string => {
  const pluginPath = path.join(workspace, "plugins", "custom.mjs");
  fs.mkdirSync(path.dirname(pluginPath), { recursive: true });
  fs.writeFileSync(
    pluginPath,
    'export default { name: "custom", generate: () => ({}) };\n'
  );
  return pluginPath;
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
