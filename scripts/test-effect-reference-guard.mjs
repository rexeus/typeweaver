import { execFileSync, spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(scriptDir, "..");
const baseline = JSON.parse(
  readFileSync(
    path.join(workspaceRoot, "config", "effect-baseline.json"),
    "utf8"
  )
);
const fixtureRoot = mkdtempSync(
  path.join(os.tmpdir(), "typeweaver-effect-reference-")
);

const run = (command, args, options = {}) =>
  execFileSync(command, args, {
    cwd: options.cwd,
    encoding: "utf8",
    stdio: options.quiet
      ? ["ignore", "pipe", "pipe"]
      : ["ignore", "inherit", "inherit"],
  })?.trim();

const writeJson = (target, value) => {
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
};

try {
  const v4Fixture = path.join(fixtureRoot, "effect-v4");
  writeJson(path.join(v4Fixture, "packages", "effect", "package.json"), {
    name: "effect",
    version: "4.0.0-beta.98",
  });
  const v4Result = spawnSync(
    process.execPath,
    [
      path.join(scriptDir, "verify-effect-reference.mjs"),
      "--repo-dir",
      v4Fixture,
    ],
    { encoding: "utf8" }
  );
  if (
    v4Result.status === 0 ||
    !v4Result.stderr.includes("expected Effect 3.22.0, found 4.0.0-beta.98")
  ) {
    throw new Error("Effect 4 reference mutation was not rejected");
  }

  const upstream = path.join(fixtureRoot, "upstream");
  mkdirSync(upstream);
  run("git", ["init"], { cwd: upstream });
  run("git", ["config", "user.email", "effect-fixture@typeweaver.test"], {
    cwd: upstream,
  });
  run("git", ["config", "user.name", "Effect Fixture"], { cwd: upstream });
  const hooksDirectory = path.join(fixtureRoot, "empty-hooks");
  mkdirSync(hooksDirectory);
  run("git", ["config", "core.hooksPath", hooksDirectory], {
    cwd: upstream,
  });
  writeJson(path.join(upstream, "packages", "effect", "package.json"), {
    name: "effect",
    version: baseline.runtimeVersion,
  });
  run("git", ["add", "."], { cwd: upstream });
  run("git", ["commit", "-m", "fixture"], { cwd: upstream });
  const fixtureCommit = run("git", ["rev-parse", "HEAD"], {
    cwd: upstream,
    quiet: true,
  });
  const fixtureTag = `effect@${baseline.runtimeVersion}`;
  run("git", ["tag", fixtureTag], { cwd: upstream });

  const contractPath = path.join(fixtureRoot, "effect-baseline.json");
  writeJson(contractPath, {
    ...baseline,
    referenceRepository: upstream,
    referenceTag: fixtureTag,
    referenceCommit: fixtureCommit,
  });
  const checkout = path.join(fixtureRoot, "checkout");
  const prepareArgs = [
    path.join(scriptDir, "prepare-effect-reference.mjs"),
    "--contract",
    contractPath,
    "--repo-dir",
    checkout,
  ];

  run(process.execPath, prepareArgs);
  run(process.execPath, prepareArgs);

  const preparedCommit = run("git", ["rev-parse", "HEAD"], {
    cwd: checkout,
    quiet: true,
  });
  if (preparedCommit !== fixtureCommit) {
    throw new Error("Prepare did not leave the reference at the pinned commit");
  }
  const symbolicHead = spawnSync("git", ["symbolic-ref", "-q", "HEAD"], {
    cwd: checkout,
  });
  if (symbolicHead.status === 0) {
    throw new Error("Prepared reference is not on a detached HEAD");
  }

  writeFileSync(path.join(checkout, "local-change.txt"), "preserve me\n");
  const dirtyResult = spawnSync(process.execPath, prepareArgs, {
    encoding: "utf8",
  });
  if (
    dirtyResult.status === 0 ||
    !dirtyResult.stderr.includes("has local changes; refusing to replace them")
  ) {
    throw new Error("Dirty Effect reference was not rejected");
  }

  process.stdout.write(
    "Effect reference guard rejected v4, prepared the pin idempotently, and preserved dirty work\n"
  );
} finally {
  rmSync(fixtureRoot, { recursive: true, force: true });
}
