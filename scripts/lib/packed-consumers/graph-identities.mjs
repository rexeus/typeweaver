import assert from "node:assert/strict";
import path from "node:path";
import {
  effectIdentityFrom,
  installedPackageJsonPath,
  physicalEffectIdentities,
} from "./graph-discovery.mjs";
import { readJson } from "./runtime.mjs";

const effectSections = /** @type {const} */ ([
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
]);
const effectAnchorSections = /** @type {const} */ ([
  "dependencies",
  "devDependencies",
  "peerDependencies",
]);

/** @param {{ effectVersion: string, fixtureRoot: string, includeCompatPlugin?: boolean, packages: readonly import("../tooling-types.mjs").PublicPackage[] }} options @returns {void} */
export const assertSingleEffectIdentity = ({
  effectVersion,
  fixtureRoot,
  includeCompatPlugin = true,
  packages,
}) => {
  const anchors = [
    path.join(fixtureRoot, "package.json"),
    ...(includeCompatPlugin
      ? [
          installedPackageJsonPath(
            fixtureRoot,
            "typeweaver-plugin-packed-compat"
          ),
        ]
      : []),
    ...packages
      .filter(packageRecord =>
        effectAnchorSections.some(
          section => packageRecord.manifest[section]?.["effect"] !== undefined
        )
      )
      .map(packageRecord =>
        installedPackageJsonPath(fixtureRoot, packageRecord.name)
      ),
  ];
  const identities = [
    ...anchors.map(effectIdentityFrom),
    ...physicalEffectIdentities(fixtureRoot),
  ];
  const resolvedPaths = new Set(
    identities.map(identity => identity.packageJsonPath)
  );
  assert.equal(
    resolvedPaths.size,
    1,
    `multiple Effect identities detected:\n${Array.from(resolvedPaths).join("\n")}`
  );
  assert.deepEqual(
    new Set(identities.map(identity => identity.version)),
    new Set([effectVersion])
  );
};

/** @param {import("../tooling-types.mjs").PackageManifest} manifest @returns {boolean} */
const declaresEffectDependency = manifest =>
  effectSections.some(section => manifest[section]?.["effect"] !== undefined);

/** @param {{ effectVersion: string, fixtureRoot: string, packages: readonly import("../tooling-types.mjs").PublicPackage[] }} options @returns {void} */
export const assertNativeEffectIdentities = ({
  effectVersion,
  fixtureRoot,
  packages,
}) => {
  const appIdentity = effectIdentityFrom(
    path.join(fixtureRoot, "package.json")
  );
  assert.equal(appIdentity.version, effectVersion);
  const cliIdentity = effectIdentityFrom(
    installedPackageJsonPath(fixtureRoot, "@rexeus/typeweaver")
  );
  assert.equal(
    cliIdentity.packageJsonPath,
    appIdentity.packageJsonPath,
    "the CLI must resolve the application's native Effect identity"
  );
  const checkedAnchors = [];
  for (const packageRecord of packages) {
    const installedManifest = readJson(
      installedPackageJsonPath(fixtureRoot, packageRecord.name)
    );
    if (!declaresEffectDependency(installedManifest)) continue;
    const identity = effectIdentityFrom(
      installedPackageJsonPath(fixtureRoot, packageRecord.name)
    );
    assert.equal(
      identity.packageJsonPath,
      cliIdentity.packageJsonPath,
      `${packageRecord.name} resolved a different Effect identity`
    );
    assert.equal(identity.version, cliIdentity.version);
    checkedAnchors.push(packageRecord.name);
  }
  assert(
    checkedAnchors.length >= 2,
    `expected multiple Effect-declaring CLI subtree anchors; found ${checkedAnchors.join(", ")}`
  );
  const physical = physicalEffectIdentities(fixtureRoot);
  assert.equal(
    physical.length,
    1,
    `expected exactly one native Effect physical identity; found:\n${physical.map(identity => `${identity.version} ${identity.packageJsonPath}`).join("\n")}`
  );
  assert.deepEqual(
    new Set(physical.map(identity => identity.version)),
    new Set([effectVersion])
  );
};
