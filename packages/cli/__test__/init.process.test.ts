import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { InitReportSchema } from "../src/index.js";
import type { InitReport } from "../src/index.js";
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
  "init-process"
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
    }, 20_000);
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

const parseReport = (stdout: string): InitReport => {
  const parsed: unknown = JSON.parse(stdout);
  return InitReportSchema.parse(parsed);
};

const collectTree = (root: string): string => {
  if (!fs.existsSync(root)) return "";
  const files: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of fs
      .readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name))) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(entryPath);
      } else {
        files.push(path.relative(root, entryPath).replaceAll(path.sep, "/"));
      }
    }
  };
  visit(root);
  return files
    .map(file => `${file}\0${fs.readFileSync(path.join(root, file), "utf8")}`)
    .join("\0");
};

afterEach(() => {
  for (const workspace of workspaces) {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
  workspaces.length = 0;
});

describe("built CLI init planning and safety", () => {
  test("plans the complete project without writing under --dry-run", async () => {
    const workspace = createWorkspace();
    const target = path.join(workspace, "todo-api");

    const result = await runCli(workspace, [
      "init",
      "--target",
      target,
      "--dry-run",
      "--json",
    ]);

    expect(result.code).toBe(0);
    expect(result.stderr).toBe("");
    expect(parseReport(result.stdout)).toMatchObject({
      success: true,
      status: "planned",
      dryRun: true,
      targetDir: target,
      configFile: "typeweaver.config.mjs",
      overwrittenFiles: [],
      preservedFiles: [],
      diagnostics: [],
    });
    expect(fs.existsSync(target)).toBe(false);
  });

  test("rejects a non-empty target without changing it", async () => {
    const workspace = createWorkspace();
    const target = path.join(workspace, "existing");
    fs.mkdirSync(target);
    fs.writeFileSync(path.join(target, "sentinel.txt"), "keep\n");
    const before = collectTree(target);

    const result = await runCli(workspace, [
      "init",
      "--target",
      target,
      "--json",
    ]);

    expect(result.code).toBe(1);
    expect(result.stderr).toBe("");
    expect(parseReport(result.stdout)).toMatchObject({
      success: false,
      status: "failed",
      diagnostics: [{ code: "TW-INIT-001" }],
    });
    expect(collectTree(target)).toBe(before);
  });
});

describe("built CLI init publication", () => {
  test("creates a starter that validates and generates", async () => {
    const workspace = createWorkspace();
    const target = path.join(workspace, "todo-api");

    const initialized = await runCli(workspace, [
      "init",
      "--target",
      target,
      "--json",
    ]);
    expect(initialized.code).toBe(0);
    const report = parseReport(initialized.stdout);
    expect(report).toMatchObject({
      success: true,
      status: "created",
      configFile: "typeweaver.config.mjs",
    });
    expect(report.files).toContain("api/spec/index.ts");
    expect(report.files).toContain("api/spec/todo/errors/TodoNotFoundError.ts");

    const specSource = fs.readFileSync(
      path.join(target, "api", "spec", "index.ts"),
      "utf8"
    );
    expect(specSource).toContain("CreateTodoOperation");
    expect(specSource).toContain("UpdateTodoOperation");
    expect(specSource).toContain("GetTodoOperation");
    expect(specSource).toContain("ListTodoOperation");
    expect(specSource).toContain("QueryTodoOperation");

    fs.symlinkSync(
      path.join(packageDirectory, "node_modules"),
      path.join(target, "node_modules"),
      "dir"
    );
    const validation = await runCli(target, [
      "validate",
      "--config",
      "typeweaver.config.mjs",
      "--json",
    ]);
    expect(validation.code, validation.stdout + validation.stderr).toBe(0);

    const generation = await runCli(target, [
      "generate",
      "--config",
      "typeweaver.config.mjs",
      "--no-format",
    ]);
    expect(generation.code, generation.stdout + generation.stderr).toBe(0);
    expect(
      fs.existsSync(path.join(target, "api", "generated", "index.ts"))
    ).toBe(true);
  });

  test("force-overwrites conflicts but preserves an existing package manifest", async () => {
    const workspace = createWorkspace();
    const target = path.join(workspace, "existing");
    const packageSource = '{\n  "name": "existing",\n  "type": "module"\n}\n';
    fs.mkdirSync(path.join(target, "api", "spec"), { recursive: true });
    fs.writeFileSync(path.join(target, "package.json"), packageSource);
    fs.writeFileSync(path.join(target, "api", "spec", "index.ts"), "old\n");

    const result = await runCli(workspace, [
      "init",
      "--target",
      target,
      "--force",
      "--json",
    ]);

    expect(result.code).toBe(0);
    const report = parseReport(result.stdout);
    expect(report.configFile).toBe("typeweaver.config.js");
    expect(report.overwrittenFiles).toContain("api/spec/index.ts");
    expect(report.preservedFiles).toEqual(["package.json"]);
    expect(fs.readFileSync(path.join(target, "package.json"), "utf8")).toBe(
      packageSource
    );
    expect(
      fs.readFileSync(path.join(target, "api/spec/index.ts"), "utf8")
    ).not.toBe("old\n");
  });

  test("selects the requested CommonJS config format", async () => {
    const workspace = createWorkspace();
    const target = path.join(workspace, "todo-api");

    const result = await runCli(workspace, [
      "init",
      "--target",
      target,
      "--config-format",
      "cjs",
      "--json",
    ]);

    expect(result.code).toBe(0);
    const report = parseReport(result.stdout);
    expect(report.configFile).toBe("typeweaver.config.cjs");
    expect(
      fs.readFileSync(path.join(target, report.configFile), "utf8")
    ).toContain("module.exports =");
  });
});
