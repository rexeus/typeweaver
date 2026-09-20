import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { spawnPnpmSync } from "../pnpm-command.mjs";

/** @typedef {import("../tooling-types.mjs").EffectBaselineContract} EffectBaselineContract */
/** @typedef {import("../tooling-types.mjs").PackageManifest} PackageManifest */
/** @typedef {import("../tooling-types.mjs").PublicPackage} PublicPackage */

export const workspaceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  ".."
);
export const packageRoot = path.join(workspaceRoot, "packages");
/** @type {EffectBaselineContract} */
export const contract = JSON.parse(
  readFileSync(path.join(workspaceRoot, "config/effect-baseline.json"), "utf8")
);
/** @type {PackageManifest} */
export const rootPackage = JSON.parse(
  readFileSync(path.join(workspaceRoot, "package.json"), "utf8")
);

/**
 * @param {{ name: string, version: string }} packageRecord
 * @returns {string}
 */
export const archiveName = ({ name, version }) =>
  `${name.replace(/^@/, "").replaceAll("/", "-")}-${version}.tgz`;

/**
 * @param {string} filePath
 * @returns {PackageManifest}
 */
export const readJson = filePath => JSON.parse(readFileSync(filePath, "utf8"));

/**
 * @param {string} filePath
 * @param {unknown} value
 * @returns {void}
 */
export const writeJson = (filePath, value) => {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
};

/**
 * @param {{ args: readonly string[], cwd: string }} options
 * @returns {string}
 */
export const run = ({ args, cwd }) => {
  const result = spawnPnpmSync({
    args,
    cwd,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(
      [
        `pnpm ${args.join(" ")} failed with exit code ${String(result.status)}`,
        result.stdout.trim(),
        result.stderr.trim(),
      ]
        .filter(Boolean)
        .join("\n")
    );
  }
  return result.stdout;
};

/**
 * @param {{ args: readonly string[], cwd: string }} options
 * @returns {string}
 */
export const runNode = ({ args, cwd }) => {
  const result = spawnSync(process.execPath, args, {
    cwd,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 20 * 1024 * 1024,
  });
  assert.equal(
    result.status,
    0,
    [
      `node ${args.join(" ")} failed with exit code ${String(result.status)}`,
      result.stdout.trim(),
      result.stderr.trim(),
    ]
      .filter(Boolean)
      .join("\n")
  );
  assert.equal(result.stderr, "");
  return result.stdout;
};

/**
 * @param {{ args: readonly string[], cwd: string }} options
 * @returns {string}
 */
export const runNodeExpectFailure = ({ args, cwd }) => {
  const result = spawnSync(process.execPath, args, {
    cwd,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 20 * 1024 * 1024,
  });
  assert.notEqual(
    result.status,
    0,
    `node ${args.join(" ")} unexpectedly succeeded`
  );
  return `${result.stdout}\n${result.stderr}`;
};

/**
 * @param {{ args: readonly string[], cwd: string }} options
 * @returns {string}
 */
export const runExpectFailure = ({ args, cwd }) => {
  const result = spawnPnpmSync({
    args,
    cwd,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 20 * 1024 * 1024,
  });
  assert.notEqual(
    result.status,
    0,
    `pnpm ${args.join(" ")} unexpectedly succeeded`
  );
  return `${result.stdout}\n${result.stderr}`;
};

/**
 * @returns {PublicPackage[]}
 */
export const collectPublishablePackages = () =>
  readdirSync(packageRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .flatMap(entry => {
      const packageJsonPath = path.join(
        packageRoot,
        entry.name,
        "package.json"
      );
      if (!existsSync(packageJsonPath)) {
        return [];
      }
      const packageJson = readJson(packageJsonPath);
      if (
        packageJson.private === true ||
        typeof packageJson.name !== "string" ||
        typeof packageJson.version !== "string"
      ) {
        return [];
      }
      return [
        {
          directory: path.dirname(packageJsonPath),
          manifest: packageJson,
          name: packageJson.name,
          version: packageJson.version,
        },
      ];
    });

/**
 * @param {{ archiveRoot: string, packages: readonly PublicPackage[] }} options
 * @returns {Map<string, string>}
 */
export const packWorkspace = ({ archiveRoot, packages }) => {
  run({
    args: [
      "-r",
      "--filter",
      "./packages/**",
      "pack",
      "--config.ignore-scripts=true",
      "--pack-destination",
      archiveRoot,
    ],
    cwd: workspaceRoot,
  });

  return new Map(
    packages.map(packageRecord => {
      const archivePath = path.join(archiveRoot, archiveName(packageRecord));
      assert(existsSync(archivePath), `missing packed archive ${archivePath}`);
      return [packageRecord.name, archivePath];
    })
  );
};

/**
 * @param {string} fixtureRoot
 * @returns {void}
 */
export const installFixture = fixtureRoot => {
  run({
    args: ["install", "--ignore-scripts"],
    cwd: fixtureRoot,
  });
};
