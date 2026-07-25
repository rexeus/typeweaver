import { spawnSync, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readlinkSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const workspaceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const pnpmCli = process.env.npm_execpath;
if (pnpmCli === undefined) {
  throw new Error("Run this gate through `pnpm verify:effect-migration`.");
}

const hash = value => createHash("sha256").update(value).digest("hex");

const gitOutput = args =>
  execFileSync("git", args, {
    cwd: workspaceRoot,
    maxBuffer: 50 * 1024 * 1024,
  });

const untrackedPaths = () =>
  gitOutput(["status", "--porcelain=v1", "-z", "--untracked-files=all"])
    .toString("utf8")
    .split("\0")
    .filter(entry => entry.startsWith("?? "))
    .map(entry => entry.slice(3));

const fingerprintPath = relativePath => {
  const absolutePath = path.join(workspaceRoot, relativePath);
  const stat = lstatSync(absolutePath);
  if (stat.isSymbolicLink()) {
    return hash(`symlink:${readlinkSync(absolutePath)}`);
  }
  if (stat.isFile()) {
    return hash(readFileSync(absolutePath));
  }
  return hash(`other:${stat.mode}:${stat.size}`);
};

const snapshotAuthoredWorktree = () => ({
  tracked: hash(gitOutput(["diff", "--binary", "HEAD", "--"])),
  untracked: untrackedPaths().map(relativePath => [
    relativePath,
    fingerprintPath(relativePath),
  ]),
});

const commands = [
  {
    label: "Effect source reference",
    args: ["run", "verify:effect-reference"],
  },
  {
    label: "Effect version and documentation contracts",
    args: ["run", "docs:check"],
  },
  {
    label: "Effect language-service diagnostics",
    args: ["run", "effect:diagnostics"],
  },
  {
    label: "Migration type contracts",
    args: ["--filter", "@rexeus/typeweaver", "run", "typecheck:contracts"],
  },
  {
    label: "Generator Effect typecheck",
    args: ["--filter", "@rexeus/typeweaver-gen", "run", "typecheck"],
  },
  {
    label: "Public plugin example typecheck",
    args: [
      "--filter",
      "@rexeus/typeweaver",
      "exec",
      "tsc",
      "--noEmit",
      "-p",
      "examples/tsconfig.json",
    ],
  },
  {
    label: "Generated fixture freshness",
    args: ["run", "verify:generated"],
  },
  {
    label: "Workspace unit, integration, and process tests",
    args: ["-r", "--workspace-concurrency=1", "--if-present", "test"],
  },
  {
    label: "Packed consumer compatibility",
    args: ["run", "verify:packed-consumers"],
  },
];

const runPnpm = ({ label, args }) => {
  process.stdout.write(`\n==> ${label}\n`);
  const result = spawnSync(process.execPath, [pnpmCli, ...args], {
    cwd: workspaceRoot,
    env: process.env,
    stdio: "inherit",
  });
  if (result.error !== undefined) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${String(result.status)}`);
  }
};

const before = snapshotAuthoredWorktree();
let commandFailure;
try {
  for (const command of commands) {
    runPnpm(command);
  }
} catch (error) {
  commandFailure = error;
}

const after = snapshotAuthoredWorktree();
if (JSON.stringify(after) !== JSON.stringify(before)) {
  throw new Error(
    "verify:effect-migration changed the authored Git worktree",
    commandFailure === undefined ? undefined : { cause: commandFailure }
  );
}
if (commandFailure !== undefined) {
  throw commandFailure;
}

process.stdout.write(
  "\nEffect migration verification passed without changing the authored worktree\n"
);
