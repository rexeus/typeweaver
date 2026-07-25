import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { verifyEffectReference } from "./verify-effect-reference.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(scriptDir, "..");

const option = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : path.resolve(process.argv[index + 1] ?? "");
};

const contractPath = option(
  "--contract",
  path.join(workspaceRoot, "config", "effect-baseline.json")
);
const repoDir = option(
  "--repo-dir",
  process.env.EFFECT_REFERENCE_DIR ??
    path.join(workspaceRoot, ".repos", "effect")
);
const contract = JSON.parse(readFileSync(contractPath, "utf8"));

const git = (directory, args, options = {}) =>
  execFileSync("git", ["-C", directory, ...args], {
    encoding: "utf8",
    stdio: options.quiet
      ? ["ignore", "pipe", "pipe"]
      : ["ignore", "inherit", "inherit"],
  })?.trim();

const isGitWorktree = directory => {
  try {
    git(directory, ["rev-parse", "--git-dir"], { quiet: true });
    return true;
  } catch {
    return false;
  }
};

if (existsSync(repoDir) && !isGitWorktree(repoDir)) {
  throw new Error(
    `Effect reference path exists but is not a Git worktree: ${repoDir}`
  );
}

if (existsSync(repoDir)) {
  const status = git(repoDir, ["status", "--porcelain"], { quiet: true });
  if (status !== "") {
    throw new Error(
      `Effect reference has local changes; refusing to replace them: ${repoDir}`
    );
  }

  let currentOrigin = "";
  try {
    currentOrigin = git(repoDir, ["remote", "get-url", "origin"], {
      quiet: true,
    });
  } catch {
    // The remote is added below.
  }

  if (currentOrigin === "") {
    git(repoDir, ["remote", "add", "origin", contract.referenceRepository]);
  } else if (currentOrigin !== contract.referenceRepository) {
    git(repoDir, ["remote", "set-url", "origin", contract.referenceRepository]);
  }
} else {
  execFileSync(
    "git",
    [
      "clone",
      "--filter=blob:none",
      "--no-checkout",
      contract.referenceRepository,
      repoDir,
    ],
    { stdio: "inherit" }
  );
}

git(repoDir, [
  "fetch",
  "--force",
  "--depth",
  "1",
  "origin",
  `refs/tags/${contract.referenceTag}:refs/tags/${contract.referenceTag}`,
]);

const resolvedCommit = git(
  repoDir,
  ["rev-parse", `${contract.referenceTag}^{commit}`],
  { quiet: true }
);
if (resolvedCommit !== contract.referenceCommit) {
  throw new Error(
    `Effect tag ${contract.referenceTag} resolved to unexpected commit ${resolvedCommit}`
  );
}

git(repoDir, ["checkout", "--detach", contract.referenceCommit]);
verifyEffectReference({ contract, repoDir });
