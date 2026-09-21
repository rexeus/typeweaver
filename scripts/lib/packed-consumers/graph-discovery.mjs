import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { readJson } from "./runtime.mjs";

/** @param {string} directory @returns {string[]} */
const sourceFiles = directory =>
  readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory() && entry.name !== "node_modules")
      return sourceFiles(target);
    return entry.isFile() && /\.(?:ts|tsx)$/u.test(entry.name) ? [target] : [];
  });

/** @param {string} directory @returns {boolean} */
const hasDirectEffectImport = directory =>
  sourceFiles(path.join(directory, "src")).some(filePath =>
    /^\s*(?:import|export)\b[^;]*?(?:from\s*)?["'](?:effect|@effect\/)/mu.test(
      readFileSync(filePath, "utf8")
    )
  );

/** @param {string} fixtureRoot @param {string} packageName @returns {string} */
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
  assert(resolvedCandidate, `${packageName} has no installed package identity`);
  return resolvedCandidate;
};

/** @param {string} packageJsonPath @returns {{ packageJsonPath: string, version: string }} */
export const readEffectIdentity = packageJsonPath => {
  const realPackageJsonPath = realpathSync(packageJsonPath);
  const manifest = readJson(realPackageJsonPath);
  assert(
    typeof manifest.version === "string",
    `${realPackageJsonPath} declares no version`
  );
  return { packageJsonPath: realPackageJsonPath, version: manifest.version };
};

/** @param {string} anchorPath @returns {{ packageJsonPath: string, version: string }} */
export const effectIdentityFrom = anchorPath => {
  const packageJsonPath = realpathSync(
    createRequire(realpathSync(anchorPath)).resolve("effect/package.json")
  );
  return readEffectIdentity(packageJsonPath);
};

/** @param {string} fixtureRoot @returns {{ packageJsonPath: string, version: string }[]} */
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
    .map(readEffectIdentity);
};

export { hasDirectEffectImport };
