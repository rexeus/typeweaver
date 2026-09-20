import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { archiveName, contract, readJson, workspaceRoot } from "./runtime.mjs";

/** @typedef {import("../tooling-types.mjs").PackageManifest} PackageManifest */
/** @typedef {import("../tooling-types.mjs").PublicPackage} PublicPackage */

/** @typedef {{ packageJsonPath: string, version: string }} EffectIdentity */

const EFFECT_DEPENDENCY_SECTIONS = /** @type {const} */ ([
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
]);
const EFFECT_ANCHOR_SECTIONS = /** @type {const} */ ([
  "dependencies",
  "devDependencies",
  "peerDependencies",
]);

/**
 * @param {string} directory
 * @returns {string[]}
 */
const sourceFiles = directory =>
  readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory() && entry.name !== "node_modules") {
      return sourceFiles(target);
    }
    return entry.isFile() && /\.(?:ts|tsx)$/u.test(entry.name) ? [target] : [];
  });

/**
 * @param {string} directory
 * @returns {boolean}
 */
const hasDirectEffectImport = directory =>
  sourceFiles(path.join(directory, "src")).some(filePath =>
    /^\s*(?:import|export)\b[^;]*?(?:from\s*)?["'](?:effect|@effect\/)/mu.test(
      readFileSync(filePath, "utf8")
    )
  );

/**
 * @param {string} fixtureRoot
 * @param {string} packageName
 * @returns {string}
 */
export const installedPackageJsonPath = (fixtureRoot, packageName) => {
  const relativePackagePath = path.join(
    "node_modules",
    ...packageName.split("/"),
    "package.json"
  );
  const directPath = path.join(fixtureRoot, relativePackagePath);
  const virtualStoreRoot = path.join(fixtureRoot, "node_modules", ".pnpm");
  const candidates = [
    ...(existsSync(directPath) ? [directPath] : []),
    ...readdirSync(virtualStoreRoot, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry =>
        path.join(virtualStoreRoot, entry.name, relativePackagePath)
      )
      .filter(existsSync),
  ];
  const realCandidates = Array.from(
    new Set(candidates.map(candidate => realpathSync(candidate)))
  );
  assert.equal(
    realCandidates.length,
    1,
    `${packageName} has ${realCandidates.length} installed package identities`
  );
  const [resolvedCandidate] = realCandidates;
  assert(
    resolvedCandidate !== undefined,
    `${packageName} has no installed package identity`
  );
  return resolvedCandidate;
};

/**
 * @param {string} packageJsonPath
 * @returns {EffectIdentity}
 */
const readEffectIdentity = packageJsonPath => {
  const realPackageJsonPath = realpathSync(packageJsonPath);
  const manifest = readJson(realPackageJsonPath);
  assert(
    typeof manifest.version === "string",
    `${realPackageJsonPath} declares no version`
  );
  return { packageJsonPath: realPackageJsonPath, version: manifest.version };
};

/**
 * @param {string} anchorPath
 * @returns {EffectIdentity}
 */
export const effectIdentityFrom = anchorPath => {
  const anchorRequire = createRequire(realpathSync(anchorPath));
  const packageJsonPath = realpathSync(
    anchorRequire.resolve("effect/package.json")
  );
  const manifest = readJson(packageJsonPath);
  assert(
    typeof manifest.version === "string",
    `${packageJsonPath} declares no version`
  );
  return { packageJsonPath, version: manifest.version };
};

/**
 * @param {string} fixtureRoot
 * @returns {EffectIdentity[]}
 */
export const physicalEffectIdentities = fixtureRoot => {
  const virtualStoreRoot = path.join(fixtureRoot, "node_modules", ".pnpm");
  return readdirSync(virtualStoreRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && entry.name.startsWith("effect@"))
    .map(entry =>
      path.join(
        virtualStoreRoot,
        entry.name,
        "node_modules",
        "effect",
        "package.json"
      )
    )
    .filter(existsSync)
    .map(packageJsonPath => readEffectIdentity(packageJsonPath));
};

/**
 * @param {{ fixtureRoot: string, packages: readonly PublicPackage[] }} options
 * @returns {void}
 */
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
    if (!hasDirectEffectImport(packageRecord.directory)) {
      continue;
    }
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

/**
 * @param {string} fixtureRoot
 * @returns {void}
 */
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

// A real consumer never receives the workspace's pnpm overrides, so the pinned
// transitive `@effect/platform-node-shared` version must survive into the packed
// graph and be the single copy that `@effect/platform-node` actually loads.
/**
 * @param {{ fixtureRoot: string }} options
 * @returns {void}
 */
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
  const loadedVersion = readJson(loadedSharedPath).version;
  assert.equal(
    loadedVersion,
    expectedVersion,
    `@effect/platform-node-shared resolved to ${String(loadedVersion)}; expected ${expectedVersion}`
  );
};

/**
 * @param {{
 *   effectVersion: string,
 *   fixtureRoot: string,
 *   includeCompatPlugin?: boolean,
 *   packages: readonly PublicPackage[],
 * }} options
 * @returns {void}
 */
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
        EFFECT_ANCHOR_SECTIONS.some(
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

/**
 * @param {PackageManifest} manifest
 * @returns {boolean}
 */
const declaresEffectDependency = manifest =>
  EFFECT_DEPENDENCY_SECTIONS.some(
    section => manifest[section]?.["effect"] !== undefined
  );

/**
 * @param {string} version
 * @returns {void}
 */
// The application and every installed TypeWeaver package that declares an
// Effect dependency or peer must resolve the same single native Effect realpath.
/**
 * @param {{
 *   effectVersion: string,
 *   fixtureRoot: string,
 *   packages: readonly PublicPackage[],
 * }} options
 * @returns {void}
 */
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
    if (!declaresEffectDependency(installedManifest)) {
      continue;
    }
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
    `expected exactly one native Effect physical identity; found:\n${physical
      .map(identity => `${identity.version} ${identity.packageJsonPath}`)
      .join("\n")}`
  );
  assert.deepEqual(
    new Set(physical.map(identity => identity.version)),
    new Set([effectVersion])
  );
};
