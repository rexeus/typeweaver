import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const dependencySections = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
];

const readJson = filePath => JSON.parse(readFileSync(filePath, "utf8"));

export const validateEffectPackageVersions = ({
  workspaceRoot,
  runtimeVersion,
}) => {
  const failures = [];
  const packagesRoot = path.join(workspaceRoot, "packages");
  const runtimeRange = `^${runtimeVersion}`;

  for (const entry of readdirSync(packagesRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }

    const packagePath = path.join(packagesRoot, entry.name, "package.json");
    let packageJson;
    try {
      packageJson = readJson(packagePath);
    } catch {
      continue;
    }

    const effectSections = dependencySections.filter(
      section => packageJson[section]?.effect !== undefined
    );
    if (effectSections.length === 0) {
      continue;
    }

    const relativePackagePath = path
      .relative(workspaceRoot, packagePath)
      .split(path.sep)
      .join("/");

    for (const section of effectSections) {
      const actual = packageJson[section].effect;
      const expected =
        section === "peerDependencies" ? "catalog:peers" : runtimeRange;
      if (actual !== expected) {
        failures.push(
          `${relativePackagePath} ${section}.effect must be ${expected}; found ${actual}`
        );
      }
    }

    try {
      const packageRequire = createRequire(packagePath);
      const resolvedPackagePath = packageRequire.resolve("effect/package.json");
      const resolvedVersion = readJson(resolvedPackagePath).version;
      if (resolvedVersion !== runtimeVersion) {
        failures.push(
          `${relativePackagePath} resolves Effect ${resolvedVersion}; expected ${runtimeVersion}`
        );
      }
    } catch (error) {
      failures.push(
        `${relativePackagePath} cannot resolve Effect ${runtimeVersion}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  return failures;
};
