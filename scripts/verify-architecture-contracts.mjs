import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readlinkSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { readWorktreeStatus } from "./lib/git-worktree-status.mjs";
import { spawnPnpmSync } from "./lib/pnpm-command.mjs";

/** @typedef {{ label: string, args: readonly string[] }} ContractCommand */
/** @typedef {{ tracked: string, untracked: [string, string][] }} WorktreeSnapshot */

const workspaceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
/**
 * @param {string | Uint8Array} value
 * @returns {string}
 */
const hash = value => createHash("sha256").update(value).digest("hex");

/**
 * @param {readonly string[]} args
 * @returns {Buffer}
 */
const gitOutput = args =>
  execFileSync("git", args, {
    cwd: workspaceRoot,
    maxBuffer: 50 * 1024 * 1024,
  });

/**
 * @returns {string[]}
 */
const untrackedPaths = () =>
  readWorktreeStatus(workspaceRoot)
    .filter(entry => entry.status === "??")
    .map(entry => entry.path);

/**
 * @param {string} relativePath
 * @returns {string}
 */
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

/**
 * @returns {WorktreeSnapshot}
 */
const snapshotAuthoredWorktree = () => ({
  tracked: hash(gitOutput(["diff", "--binary", "HEAD", "--"])),
  untracked: untrackedPaths().map(relativePath => [
    relativePath,
    fingerprintPath(relativePath),
  ]),
});

/** @type {ContractCommand[]} */
const commands = [
  {
    label: "Package-manager launcher contract",
    args: ["run", "test:pnpm-launcher"],
  },
  {
    label: "Pinned Effect source contract",
    args: ["run", "verify:effect-reference"],
  },
  {
    label: "Effect dependency and version contracts",
    args: ["run", "verify:effect-version"],
  },
  {
    label: "Pre-1.0 release version contract",
    args: ["run", "verify:release-version"],
  },
  {
    label: "Documentation link integrity",
    args: ["run", "docs:check"],
  },
  {
    label: "Oxlint maintainability contracts",
    args: ["run", "test:maintainability-lint"],
  },
  {
    label: "Oxlint type-aware policy contracts",
    args: ["run", "test:lint-policy"],
  },
  {
    label: "TypeScript compiler profile contracts",
    args: ["run", "test:typescript-toolchain"],
  },
  {
    label: "Repository tooling typecheck",
    args: ["run", "typecheck:scripts"],
  },
  {
    label: "Repository tooling tests",
    args: ["run", "test:tooling"],
  },
  {
    label: "Quality task contract guards",
    args: ["run", "test:quality-contracts"],
  },
  {
    label: "Vitest gate filter contracts",
    args: ["run", "verify:test-gates"],
  },
  {
    label: "Standalone Effect tsgo diagnostics",
    args: ["run", "effect:diagnostics"],
  },
  {
    label: "Public CLI type contracts",
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

/**
 * @param {ContractCommand} command
 * @returns {void}
 */
const runPnpm = ({ label, args }) => {
  process.stdout.write(`\n==> ${label}\n`);
  const result = spawnPnpmSync({
    args,
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
    "verify:architecture-contracts changed the authored Git worktree",
    commandFailure === undefined ? undefined : { cause: commandFailure }
  );
}
if (commandFailure !== undefined) {
  throw commandFailure;
}

process.stdout.write(
  "\nArchitecture contracts passed without changing the authored worktree\n"
);
