import assert from "node:assert/strict";
import { readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import {
  hasDirectEffectImport,
  installedPackageJsonPath,
} from "./graph-discovery.mjs";
import { archiveName, contract, readJson, workspaceRoot } from "./runtime.mjs";

/** @typedef {import("../tooling-types.mjs").PublicPackage} PublicPackage */

/** @param {{ fixtureRoot: string, packages: readonly PublicPackage[] }} options @returns {void} */
export const assertPackedPackages = ({ fixtureRoot, packages }) => {
  const lockfile = readFileSync(
    path.join(fixtureRoot, "pnpm-lock.yaml"),
    "utf8"
  );
  for (const packageRecord of packages) {
    const installedPath = realpathSync(
      installedPackageJsonPath(fixtureRoot, packageRecord.name)
    );
    assert(
      !installedPath.startsWith(`${workspaceRoot}${path.sep}`),
      `${packageRecord.name} resolved to the workspace instead of its tarball`
    );
    const installedManifest = readJson(installedPath);
    assert.equal(installedManifest.version, packageRecord.version);
    assert(
      !/workspace:|catalog:/.test(JSON.stringify(installedManifest)),
      `${packageRecord.name} retained a workspace-only dependency specifier`
    );
    assert(
      lockfile.includes(archiveName(packageRecord)),
      `${packageRecord.name} is not locked to its packed tarball`
    );
    if (!hasDirectEffectImport(packageRecord.directory)) continue;
    if (packageRecord.name === "@rexeus/typeweaver") {
      assert.equal(
        installedManifest.dependencies?.["effect"],
        contract.runtimeVersion,
        "the CLI must own its exact Effect runtime dependency"
      );
      continue;
    }
    assert.equal(
      installedManifest.peerDependencies?.["effect"],
      contract.peerRange,
      `${packageRecord.name} directly imports Effect without its exact peer`
    );
    assert.equal(
      installedManifest.dependencies?.["effect"],
      undefined,
      `${packageRecord.name} must not hide its Effect peer as a dependency`
    );
  }
};

/** @param {string} fixtureRoot @returns {void} */
export const assertGeneratorEffectPeerContract = fixtureRoot => {
  const generatorManifest = readJson(
    installedPackageJsonPath(fixtureRoot, "@rexeus/typeweaver-gen")
  );
  assert.equal(
    generatorManifest.peerDependencies?.["effect"],
    contract.peerRange
  );
  assert.equal(generatorManifest.dependencies?.["effect"], undefined);
};

/** @param {{ fixtureRoot: string }} options @returns {void} */
export const assertPlatformNodeSharedIdentity = ({ fixtureRoot }) => {
  const cliManifest = readJson(
    installedPackageJsonPath(fixtureRoot, "@rexeus/typeweaver")
  );
  const expectedVersion =
    cliManifest.dependencies?.["@effect/platform-node-shared"];
  assert(
    typeof expectedVersion === "string",
    "packed CLI must declare @effect/platform-node-shared"
  );
  assert.equal(
    expectedVersion,
    contract.runtimeVersion,
    "packed CLI must pin @effect/platform-node-shared to the native Effect runtime"
  );
  const installedSharedPath = installedPackageJsonPath(
    fixtureRoot,
    "@effect/platform-node-shared"
  );
  const platformNodeRequire = createRequire(
    realpathSync(installedPackageJsonPath(fixtureRoot, "@effect/platform-node"))
  );
  const loadedSharedPath = realpathSync(
    platformNodeRequire.resolve("@effect/platform-node-shared/package.json")
  );
  assert.equal(
    loadedSharedPath,
    installedSharedPath,
    "@effect/platform-node loads a different @effect/platform-node-shared copy than the pinned identity"
  );
  assert.equal(readJson(loadedSharedPath).version, expectedVersion);
};
