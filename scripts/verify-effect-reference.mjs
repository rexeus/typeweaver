import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

/** @typedef {import("./lib/tooling-types.mjs").EffectBaselineContract} EffectBaselineContract */
/** @typedef {import("./lib/tooling-types.mjs").PackageManifest} PackageManifest */

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(scriptDir, "..");

/**
 * @param {string} repoDir
 * @param {readonly string[]} args
 * @returns {string}
 */
const runGit = (repoDir, args) =>
  execFileSync("git", ["-C", repoDir, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();

/**
 * @param {{ contract: EffectBaselineContract, repoDir: string }} options
 * @returns {void}
 */
export const verifyEffectReference = ({ contract, repoDir }) => {
  /** @type {PackageManifest} */
  let packageJson;
  try {
    packageJson = JSON.parse(
      readFileSync(
        path.join(repoDir, "packages", "effect", "package.json"),
        "utf8"
      )
    );
  } catch {
    throw new Error(
      `Effect reference verification failed: cannot read packages/effect/package.json in ${repoDir}`
    );
  }

  if (packageJson.version !== contract.runtimeVersion) {
    throw new Error(
      `Effect reference verification failed: expected Effect ${contract.runtimeVersion}, found ${String(packageJson.version)}`
    );
  }

  let repository;
  let commit;
  try {
    repository = runGit(repoDir, ["remote", "get-url", "origin"]);
    commit = runGit(repoDir, ["rev-parse", "HEAD"]);
  } catch {
    throw new Error(
      `Effect reference verification failed: cannot inspect Git metadata in ${repoDir}`
    );
  }

  if (repository !== contract.referenceRepository) {
    throw new Error(
      `Effect reference verification failed: expected origin ${contract.referenceRepository}, found ${repository}`
    );
  }

  if (commit !== contract.referenceCommit) {
    throw new Error(
      `Effect reference verification failed: expected commit ${contract.referenceCommit}, found ${commit}`
    );
  }

  process.stdout.write(
    `Effect reference verified: ${contract.runtimeVersion} (${contract.referenceCommit})\n`
  );
};

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  /**
   * @param {string} name
   * @param {string} fallback
   * @returns {string}
   */
  const option = (name, fallback) => {
    const index = process.argv.indexOf(name);
    return index === -1
      ? fallback
      : path.resolve(process.argv[index + 1] ?? "");
  };
  const contractPath = option(
    "--contract",
    path.join(workspaceRoot, "config", "effect-baseline.json")
  );
  const repoDir = option(
    "--repo-dir",
    path.join(workspaceRoot, ".repos", "effect")
  );
  /** @type {EffectBaselineContract} */
  const contract = JSON.parse(readFileSync(contractPath, "utf8"));

  verifyEffectReference({ contract, repoDir });
}
