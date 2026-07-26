import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const dependencySections = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
];

const readJson = filePath => JSON.parse(readFileSync(filePath, "utf8"));

const findEffectSections = packageJson =>
  dependencySections.filter(
    section => packageJson[section]?.effect !== undefined
  );

const formatPackagePath = (workspaceRoot, packagePath) =>
  path.relative(workspaceRoot, packagePath).split(path.sep).join("/");

const validateDeclaredVersions = ({
  packageJson,
  packagePath,
  effectSections,
  runtimeRange,
}) => {
  const failures = [];
  for (const section of effectSections) {
    const actual = packageJson[section].effect;
    const expected =
      section === "peerDependencies" ? "catalog:peers" : runtimeRange;
    if (actual !== expected) {
      failures.push(
        `${packagePath} ${section}.effect must be ${expected}; found ${actual}`
      );
    }
  }
  return failures;
};

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
          `${packagePath} resolves Effect ${resolvedVersion}; expected ${runtimeVersion}`,
        ];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return [
      `${packagePath} cannot resolve Effect ${runtimeVersion}: ${message}`,
    ];
  }
};

const validatePackage = ({
  workspaceRoot,
  manifestPath,
  runtimeVersion,
  runtimeRange,
}) => {
  let packageJson;
  try {
    packageJson = readJson(manifestPath);
  } catch {
    return [];
  }

  const effectSections = findEffectSections(packageJson);
  if (effectSections.length === 0) {
    return [];
  }

  const packagePath = formatPackagePath(workspaceRoot, manifestPath);
  return [
    ...validateDeclaredVersions({
      packageJson,
      packagePath,
      effectSections,
      runtimeRange,
    }),
    ...validateResolvedVersion({
      manifestPath,
      packagePath,
      runtimeVersion,
    }),
  ];
};

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

    const manifestPath = path.join(packagesRoot, entry.name, "package.json");
    failures.push(
      ...validatePackage({
        workspaceRoot,
        manifestPath,
        runtimeVersion,
        runtimeRange,
      })
    );
  }

  return failures;
};
