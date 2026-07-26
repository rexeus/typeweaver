import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, test } from "vitest";

const execFileAsync = promisify(execFile);
const packageDirectory = path.resolve(import.meta.dirname, "..");
const cliEntry = path.join(packageDirectory, "bin", "typeweaver.mjs");
const PROCESS_TEST_TIMEOUT_MS = 15_000;
const outputsDirectory = path.join(
  packageDirectory,
  "test",
  "outputs",
  "plugin-scaffold"
);
const workspaces: string[] = [];

const createWorkspace = (): string => {
  fs.mkdirSync(outputsDirectory, { recursive: true });
  const workspace = fs.mkdtempSync(path.join(outputsDirectory, "workspace-"));
  workspaces.push(workspace);
  return workspace;
};

const collectFileTree = (root: string): string => {
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
    .map(
      filePath =>
        `--- ${filePath}\n${fs.readFileSync(path.join(root, filePath), "utf8")}`
    )
    .join("\n");
};

afterEach(() => {
  for (const workspace of workspaces) {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
  workspaces.length = 0;
});

describe("built CLI plugin scaffold", () => {
  test(
    "creates the deterministic public starter without prompts",
    async () => {
      const workspace = createWorkspace();
      const target = path.join(workspace, "audit-log-plugin");

      const result = await execFileAsync(
        process.execPath,
        [cliEntry, "add", "plugin", "--name", "audit-log", "--target", target],
        { cwd: workspace }
      );

      expect(result.stderr).toBe("");
      expect(result.stdout).toContain(
        `Created TypeWeaver plugin 'audit-log' at ${target}`
      );
      expect(collectFileTree(target)).toMatchSnapshot();
    },
    PROCESS_TEST_TIMEOUT_MS
  );

  test("rejects an existing target without changing its contents", async () => {
    const workspace = createWorkspace();
    const target = path.join(workspace, "existing-plugin");
    fs.mkdirSync(target);
    fs.writeFileSync(path.join(target, "sentinel.txt"), "keep\n");

    await expect(
      execFileAsync(
        process.execPath,
        [cliEntry, "add", "plugin", "--name", "audit-log", "--target", target],
        { cwd: workspace }
      )
    ).rejects.toMatchObject({
      code: 1,
      stderr: `Plugin scaffold target '${target}' already exists; choose a new directory.\n`,
    });
    expect(collectFileTree(target)).toBe("--- sentinel.txt\nkeep\n");
  });

  test("rejects invalid plugin names without creating a target", async () => {
    const workspace = createWorkspace();
    const target = path.join(workspace, "invalid-plugin");

    await expect(
      execFileAsync(
        process.execPath,
        [cliEntry, "add", "plugin", "--name", "Audit_Log", "--target", target],
        { cwd: workspace }
      )
    ).rejects.toMatchObject({
      code: 1,
      stderr:
        "Invalid plugin name 'Audit_Log'. Use lowercase kebab-case, for example 'audit-log'.\n",
    });
    expect(fs.existsSync(target)).toBe(false);
  });
});
