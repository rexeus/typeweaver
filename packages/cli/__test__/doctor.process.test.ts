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
  specifier: string
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
  });

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
  });

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

describe("built CLI project-owned Effect resolution", () => {
  test("skips when the project does not declare Effect even if a parent tree has Effect 3", async () => {
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

  test("warns conditionally for the exact Effect 4 RC with plain projections", async () => {
    const workspace = createWorkspace();
    writeSpec(workspace);
    writeWorkspaceManifest(workspace, "4.0.0-rc.115");

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
      outcome: "warn",
    });
    expect(check?.message).toContain("4.0.0-rc.115");
    expect(check?.message).toContain("isolated child process");
    expect(check?.message).toContain("Effect-independent");
    expect(check?.message).toContain("cannot verify");
    expect(check?.message).toContain("Effect-neutral");
  });

  test("warns UNVERIFIED for any other Effect 4 version", async () => {
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
    expect(check.message).toContain("UNVERIFIED");
    expect(check.message).toContain("4.0.0-rc.115");
    expect(check.message).toContain("does not claim");
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
});

describe("built CLI declaration verification", () => {
  test("fails when the project declares the RC but only a parent Effect 3 resolves", async () => {
    const workspace = createWorkspace();
    writeSpec(workspace);
    writeWorkspaceManifestWithSpecifier(workspace, "4.0.0-rc.115");

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

describe("built CLI Effect-native incompatibility", () => {
  test("fails for an Effect 4 workspace that configures the Effect projection", async () => {
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
      "server,effect",
      "--json",
    ]);

    expect(result.code).toBe(1);
    const check = await expectCheck(result, "TW-DOCTOR-011");
    expect(check.outcome).toBe("fail");
    expect(check.message).toContain("Effect-native");
  });

  test("fails for an Effect 4 workspace with a custom plugin", async () => {
    const workspace = createWorkspace();
    writeSpec(workspace);
    writeWorkspaceManifest(workspace, "4.0.0-rc.115");
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

  test("renders the workspace compatibility warning in human output", async () => {
    const workspace = createWorkspace();
    writeSpec(workspace);
    writeWorkspaceManifest(workspace, "4.0.0-rc.115");

    const result = await runCli(workspace, [
      "doctor",
      "--input",
      "spec/index.ts",
      "--output",
      "generated",
    ]);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain(
      "[WARN] TW-DOCTOR-011 workspace Effect compatibility:"
    );
  });
});
