import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

/** @typedef {import("./tooling-types.mjs").EffectBaselineContract} EffectBaselineContract */
/** @typedef {import("./tooling-types.mjs").PackageManifest} PackageManifest */
/** @typedef {Record<string, PackageManifest | undefined>} PackageManifestMap */

const dependencySections = /** @type {const} */ ([
  "dependencies",
  "devDependencies",
  "peerDependencies",
]);
const publishedDependencySections = /** @type {const} */ ([
  "dependencies",
  "devDependencies",
]);

/** @typedef {typeof dependencySections[number]} EffectDependencySection */

/** @param {string} filePath @returns {PackageManifest} */
const readJson = filePath => JSON.parse(readFileSync(filePath, "utf8"));

/** @param {PackageManifest} packageJson @returns {EffectDependencySection[]} */
const findEffectSections = packageJson =>
  dependencySections.filter(
    section => packageJson[section]?.["effect"] !== undefined
  );

/** @param {string} workspaceRoot @param {string} packagePath @returns {string} */
const formatPackagePath = (workspaceRoot, packagePath) =>
  path.relative(workspaceRoot, packagePath).split(path.sep).join("/");

/**
 * @param {{ packageJson: PackageManifest, packagePath: string, effectSections: readonly EffectDependencySection[], runtimeVersion: string }} options
 * @returns {string[]}
 */
const validateDeclaredVersions = ({
  packageJson,
  packagePath,
  effectSections,
  runtimeVersion,
}) => {
  const failures = [];
  for (const section of effectSections) {
    const actual = packageJson[section]?.["effect"];
    const expected =
      section === "peerDependencies" ? "catalog:peers" : runtimeVersion;
    if (actual !== expected) {
      failures.push(
        `${packagePath} ${section}.effect must be ${expected}; found ${String(actual)}`
      );
    }
  }
  return failures;
};

/**
 * @param {{ packageJson: PackageManifest, packagePath: string, acceptedEffectDependencies: Record<string, string> }} options
 * @returns {string[]}
 */
const validatePublishedEffectDependencies = ({
  packageJson,
  packagePath,
  acceptedEffectDependencies,
}) => {
  const failures = [];
  for (const section of publishedDependencySections) {
    for (const [name, specifier] of Object.entries(
      packageJson[section] ?? {}
    )) {
      if (!name.startsWith("@effect/")) {
        continue;
      }
      const accepted = acceptedEffectDependencies[name];
      if (accepted === undefined) {
        failures.push(
          `${packagePath} declares unaccepted Effect dependency ${name}@${specifier}`
        );
      } else if (specifier !== accepted) {
        failures.push(
          `${packagePath} ${name} must be pinned to ${accepted}; found ${specifier}`
        );
      }
    }
  }
  return failures;
};

/**
 * @param {{ manifestPath: string, packagePath: string, runtimeVersion: string }} options
 * @returns {string[]}
 */
const validateResolvedVersion = ({
  manifestPath,
  packagePath,
  runtimeVersion,
}) => {
  try {
    const packageRequire = createRequire(manifestPath);
    const resolvedPackagePath = packageRequire.resolve("effect/package.json");
    const resolvedVersion = readJson(resolvedPackagePath).version;
    return resolvedVersion === runtimeVersion
      ? []
      : [
          `${packagePath} resolves Effect ${String(resolvedVersion)}; expected ${runtimeVersion}`,
        ];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return [
      `${packagePath} cannot resolve Effect ${runtimeVersion}: ${message}`,
    ];
  }
};

/**
 * @param {{ workspaceRoot: string, manifestPath: string, runtimeVersion: string, acceptedEffectDependencies: Record<string, string> }} options
 * @returns {string[]}
 */
const validatePackage = ({
  workspaceRoot,
  manifestPath,
  runtimeVersion,
  acceptedEffectDependencies,
}) => {
  let packageJson;
  try {
    packageJson = readJson(manifestPath);
  } catch {
    return [];
  }

  const packagePath = formatPackagePath(workspaceRoot, manifestPath);
  const failures = validatePublishedEffectDependencies({
    packageJson,
    packagePath,
    acceptedEffectDependencies,
  });
  const effectSections = findEffectSections(packageJson);
  if (effectSections.length === 0) {
    return failures;
  }
  return [
    ...failures,
    ...validateDeclaredVersions({
      packageJson,
      packagePath,
      effectSections,
      runtimeVersion,
    }),
    ...validateResolvedVersion({
      manifestPath,
      packagePath,
      runtimeVersion,
    }),
  ];
};

/**
 * Validates every workspace package that declares Effect. A declaration is an
 * exact runtime pin in development and an exact catalog peer when published;
 * packages without an Effect declaration remain Effect-optional.
 *
 * @param {{ workspaceRoot: string, runtimeVersion: string, acceptedEffectDependencies?: Record<string, string> }} options
 * @returns {string[]}
 */
export const validateEffectPackageVersions = ({
  workspaceRoot,
  runtimeVersion,
  acceptedEffectDependencies = {},
}) => {
  const failures = [];
  const packagesRoot = path.join(workspaceRoot, "packages");
  for (const entry of readdirSync(packagesRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    failures.push(
      ...validatePackage({
        workspaceRoot,
        manifestPath: path.join(packagesRoot, entry.name, "package.json"),
        runtimeVersion,
        acceptedEffectDependencies,
      })
    );
  }
  return failures;
};

/**
 * Public documents must describe the native RC.116 contract. The generated
 * projections remain usable without importing Effect; the authoring, plugin,
 * CLI programmatic, and adapter boundaries require the exact peer.
 */
export const NATIVE_EFFECT_DOCUMENT_TOKENS = {
  "docs/adr/0008-effect-4-baseline.md": [
    "4.0.0-rc.116",
    "d62dd0d65252e5d3635538f0e41adc7c08aa9beb",
    "Context.Service",
    "Result",
    "Cause",
    "Schema",
    "pnpm effect:diagnostics",
    "optional",
  ],
  "docs/adr/0010-effect-4-workspace-compatibility.md": [
    "0008-effect-4-baseline",
    "Superseded",
    "4.0.0-rc.116",
    "native",
  ],
  "README.md": ["4.0.0-rc.116", "native", "optional"],
  "docs/README.md": ["0008-effect-4-baseline", "4.0.0-rc.116", "optional"],
  "docs/getting-started.md": ["4.0.0-rc.116", "native", "optional"],
  "packages/cli/README.md": ["4.0.0-rc.116", "programmatic", "optional"],
  "packages/gen/README.md": ["4.0.0-rc.116", "Context.Service", "Result"],
  "packages/effect/README.md": ["4.0.0-rc.116", "Context.Service", "Cause"],
  "docs/plugin-authoring.md": ["4.0.0-rc.116", "Context.Service", "Result"],
  "MIGRATION.md": ["4.0.0-rc.116", "Context.Service", "Result", "Cause"],
};

export const NATIVE_EFFECT_FORBIDDEN_PHRASES = [
  "Effect 3-only",
  "Effect 3 only",
  ">=3.22.0 <4",
  "process-isolated Effect 4",
  "binary CLI evidence only",
];

const OPTIONAL_SENSITIVE_PEERS = ["effect", "@rexeus/typeweaver-gen"];

/** @param {PackageManifest | undefined} manifest @param {string} packageName @param {string} runtimeVersion @returns {string[]} */
const validateNativePeer = (manifest, packageName, runtimeVersion) => {
  const failures = [];
  if (manifest?.peerDependencies?.["effect"] !== "catalog:peers") {
    failures.push(
      `packages/${packageName}/package.json peerDependencies.effect must be catalog:peers; found ${String(manifest?.peerDependencies?.["effect"])} `
    );
  }
  if (manifest?.dependencies?.["effect"] !== undefined) {
    failures.push(
      `packages/${packageName}/package.json must keep effect as a peer, not a dependency (native peer ${runtimeVersion})`
    );
  }
  return failures;
};

/** @param {PackageManifest | undefined} manifest @returns {string[]} */
const validateNativeCliManifest = manifest => {
  const failures = [];
  if (manifest?.dependencies?.["effect"] !== "4.0.0-rc.116") {
    failures.push(
      "packages/cli/package.json dependencies.effect must be 4.0.0-rc.116; found " +
        String(manifest?.dependencies?.["effect"])
    );
  }
  if (manifest?.peerDependencies?.["effect"] !== undefined) {
    failures.push(
      "packages/cli/package.json must not declare an Effect peer; the CLI owns its exact runtime dependency"
    );
  }
  return failures;
};

/** @param {PackageManifestMap} manifests @returns {string[]} */
const validateNativeRequiredPeers = manifests => {
  const failures = [];
  for (const packageName of ["gen", "effect", "command", "openapi", "hono"]) {
    failures.push(
      ...validateNativePeer(manifests[packageName], packageName, "4.0.0-rc.116")
    );
  }
  return failures;
};

/** @param {PackageManifestMap} manifests @returns {string[]} */
const validateNativeOptionalPeers = manifests => {
  const failures = [];
  const core = manifests["core"];
  if (core?.peerDependencies?.["effect"] !== undefined) {
    failures.push(
      "packages/core/package.json must remain Effect-optional; core has no Effect peer"
    );
  }
  for (const packageName of ["clients", "types", "server", "aws-cdk"]) {
    if (manifests[packageName]?.peerDependencies?.["effect"] !== undefined) {
      failures.push(
        `packages/${packageName}/package.json must keep Effect optional; it has no runtime Effect peer`
      );
    }
  }
  return failures;
};

/** @param {PackageManifestMap} manifests @returns {string[]} */
const validateOptionalSensitivePeers = manifests => {
  const failures = [];
  for (const [packageName, manifest] of Object.entries(manifests)) {
    for (const peer of OPTIONAL_SENSITIVE_PEERS) {
      if (manifest?.peerDependenciesMeta?.[peer]?.optional === true) {
        failures.push(
          `packages/${packageName}/package.json must not mark ${peer} optional`
        );
      }
    }
  }
  return failures;
};

/** @param {PackageManifestMap} manifests @returns {string[]} */
const validateNativePeerMetadata = manifests => {
  const failures = validateOptionalSensitivePeers(manifests);
  if (manifests["hono"]?.peerDependenciesMeta?.["hono"]?.optional !== true) {
    failures.push(
      "packages/hono/package.json must mark its Hono peer optional"
    );
  }
  return failures;
};

/** @param {PackageManifestMap} manifests @returns {string[]} */
const validateNativeManifests = manifests => [
  ...validateNativeCliManifest(manifests["cli"]),
  ...validateNativeRequiredPeers(manifests),
  ...validateNativeOptionalPeers(manifests),
  ...validateNativePeerMetadata(manifests),
];

/** @param {EffectBaselineContract} contract @returns {string[]} */
const validateNativeVersions = contract => {
  const failures = [];
  if (contract.runtimeVersion !== "4.0.0-rc.116") {
    failures.push(
      `config/effect-baseline.json runtimeVersion must be 4.0.0-rc.116; found ${contract.runtimeVersion}`
    );
  }
  if (contract.peerRange !== "4.0.0-rc.116") {
    failures.push(
      `config/effect-baseline.json peerRange must be the exact native pin 4.0.0-rc.116; found ${contract.peerRange}`
    );
  }
  if ("effect4Evidence" in contract) {
    failures.push(
      "config/effect-baseline.json must not contain the obsolete effect4Evidence contract"
    );
  }
  return failures;
};

/** @param {Record<string, string | undefined>} documents @returns {string[]} */
const validateNativeDocuments = documents => {
  const failures = [];
  for (const [document, tokens] of Object.entries(
    NATIVE_EFFECT_DOCUMENT_TOKENS
  )) {
    const content = documents[document];
    if (typeof content !== "string") {
      failures.push(`${document} is required by the native Effect contract`);
      continue;
    }
    for (const token of tokens) {
      if (!content.includes(token)) {
        failures.push(
          `${document} is missing native Effect statement: ${token}`
        );
      }
    }
    for (const phrase of NATIVE_EFFECT_FORBIDDEN_PHRASES) {
      if (content.toLowerCase().includes(phrase.toLowerCase())) {
        failures.push(
          `${document} contains obsolete Effect guidance: "${phrase}"`
        );
      }
    }
  }
  return failures;
};

/**
 * @param {{ contract: EffectBaselineContract, manifests: PackageManifestMap, documents: Record<string, string | undefined> }} options
 * @returns {string[]}
 */
export const validateNativeEffectWorkspaceContract = ({
  contract,
  manifests,
  documents,
}) => [
  ...validateNativeVersions(contract),
  ...validateNativeManifests(manifests),
  ...validateNativeDocuments(documents),
];
