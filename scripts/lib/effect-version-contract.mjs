import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import {
  NATIVE_EFFECT_DOCUMENT_TOKENS,
  NATIVE_EFFECT_FORBIDDEN_PHRASES,
  validateNativeEffectWorkspaceContract,
} from "./effect-native-contract.mjs";

/** @typedef {import("./tooling-types.mjs").PackageManifest} PackageManifest */
/** @typedef {Record<string, PackageManifest | undefined>} PackageManifestMap */
/** @typedef {typeof dependencySections[number]} EffectDependencySection */
/** @typedef {{ packageJson: PackageManifest, packagePath: string, effectSections: readonly EffectDependencySection[], runtimeVersion: string }} DeclaredVersionOptions */
/** @typedef {{ packageJson: PackageManifest, packagePath: string, acceptedEffectDependencies: Record<string, string> }} PublishedDependencyOptions */
/** @typedef {{ manifestPath: string, packagePath: string, runtimeVersion: string }} ResolvedVersionOptions */
/** @typedef {{ workspaceRoot: string, manifestPath: string, runtimeVersion: string, acceptedEffectDependencies: Record<string, string> }} PackageOptions */

const dependencySections = /** @type {const} */ ([
  "dependencies",
  "devDependencies",
  "peerDependencies",
]);
const publishedDependencySections = /** @type {const} */ ([
  "dependencies",
  "devDependencies",
]);

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

/** @param {DeclaredVersionOptions} options @returns {string[]} */
const validateDeclaredVersions = ({
  packageJson,
  packagePath,
  effectSections,
  runtimeVersion,
}) =>
  effectSections.flatMap(section => {
    const actual = packageJson[section]?.["effect"];
    const expected =
      section === "peerDependencies" ? "catalog:peers" : runtimeVersion;
    return actual === expected
      ? []
      : [
          `${packagePath} ${section}.effect must be ${expected}; found ${String(actual)}`,
        ];
  });

/** @param {PublishedDependencyOptions} options @returns {string[]} */
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
      if (!name.startsWith("@effect/")) continue;
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

/** @param {ResolvedVersionOptions} options @returns {string[]} */
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

/** @param {PackageOptions} options @returns {string[]} */
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
  const effectSections = findEffectSections(packageJson);
  return [
    ...validatePublishedEffectDependencies({
      packageJson,
      packagePath,
      acceptedEffectDependencies,
    }),
    ...(effectSections.length === 0
      ? []
      : [
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
        ]),
  ];
};

/** @param {{ workspaceRoot: string, runtimeVersion: string, acceptedEffectDependencies?: Record<string, string> }} options @returns {string[]} */
export const validateEffectPackageVersions = ({
  workspaceRoot,
  runtimeVersion,
  acceptedEffectDependencies = {},
}) => {
  const packagesRoot = path.join(workspaceRoot, "packages");
  return readdirSync(packagesRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .flatMap(entry =>
      validatePackage({
        workspaceRoot,
        manifestPath: path.join(packagesRoot, entry.name, "package.json"),
        runtimeVersion,
        acceptedEffectDependencies,
      })
    );
};

export {
  NATIVE_EFFECT_DOCUMENT_TOKENS,
  NATIVE_EFFECT_FORBIDDEN_PHRASES,
  validateNativeEffectWorkspaceContract,
};
