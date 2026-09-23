import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, test } from "vitest";
import { z } from "zod";
import { cliPackageVersion } from "../src/cliMetadata.js";
import {
  CLI_PROCESS_TIMEOUT_MS,
  PROCESS_TEST_TIMEOUT_MS,
} from "./helpers/builtCli.js";

const execFileAsync = promisify(execFile);
const packageDirectory = path.resolve(import.meta.dirname, "..");
const cliEntry = path.join(packageDirectory, "bin", "typeweaver.mjs");
const typeweaverVersionRange = `^${cliPackageVersion}`;
const PluginPackageSchema = z.object({
  peerDependencies: z.object({
    "@rexeus/typeweaver-gen": z.string(),
  }),
  devDependencies: z.object({
    "@rexeus/typeweaver": z.string(),
    "@rexeus/typeweaver-core": z.string(),
    "@rexeus/typeweaver-gen": z.string(),
  }),
});
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

const normalizeReleaseVersion = (fileTree: string): string =>
  fileTree.replaceAll(typeweaverVersionRange, "^<TYPEWEAVER_VERSION>");

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
        { cwd: workspace, timeout: CLI_PROCESS_TIMEOUT_MS }
      );

      expect(result.stderr).toBe("");
      expect(result.stdout).toContain(
        `Created TypeWeaver plugin 'audit-log' at ${target}`
      );
      const packageManifest = PluginPackageSchema.parse(
        JSON.parse(fs.readFileSync(path.join(target, "package.json"), "utf8"))
      );
      expect(packageManifest).toStrictEqual({
        peerDependencies: {
          "@rexeus/typeweaver-gen": typeweaverVersionRange,
        },
        devDependencies: {
          "@rexeus/typeweaver": typeweaverVersionRange,
          "@rexeus/typeweaver-core": typeweaverVersionRange,
          "@rexeus/typeweaver-gen": typeweaverVersionRange,
        },
      });
      expect(
        normalizeReleaseVersion(collectFileTree(target))
      ).toMatchSnapshot();
    },
    PROCESS_TEST_TIMEOUT_MS
  );

  test(
    "rejects an existing target without changing its contents",
    async () => {
      const workspace = createWorkspace();
      const target = path.join(workspace, "existing-plugin");
      fs.mkdirSync(target);
      fs.writeFileSync(path.join(target, "sentinel.txt"), "keep\n");

      await expect(
        execFileAsync(
          process.execPath,
          [
            cliEntry,
            "add",
            "plugin",
            "--name",
            "audit-log",
            "--target",
            target,
          ],
          { cwd: workspace, timeout: CLI_PROCESS_TIMEOUT_MS }
        )
      ).rejects.toMatchObject({
        code: 1,
        stderr: `Plugin scaffold target '${target}' already exists; choose a new directory.\n`,
      });
      expect(collectFileTree(target)).toBe("--- sentinel.txt\nkeep\n");
    },
    PROCESS_TEST_TIMEOUT_MS
  );

  test(
    "rejects invalid plugin names without creating a target",
    async () => {
      const workspace = createWorkspace();
      const target = path.join(workspace, "invalid-plugin");

      await expect(
        execFileAsync(
          process.execPath,
          [
            cliEntry,
            "add",
            "plugin",
            "--name",
            "Audit_Log",
            "--target",
            target,
          ],
          { cwd: workspace, timeout: CLI_PROCESS_TIMEOUT_MS }
        )
      ).rejects.toMatchObject({
        code: 1,
        stderr:
          "Invalid plugin name 'Audit_Log'. Use lowercase kebab-case, for example 'audit-log'.\n",
      });
      expect(fs.existsSync(target)).toBe(false);
    },
    PROCESS_TEST_TIMEOUT_MS
  );
});
