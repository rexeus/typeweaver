import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

/** @typedef {import("./tooling-types.mjs").PackageManifest} PackageManifest */
/** @typedef {{ file: string, detectedEffect?: string, supportedEffect?: string }} EffectFile */
/** @typedef {{ file: string, line: number, column: number, code: number, name: string, message: string, severity: string }} EffectDiagnostic */
/** @typedef {{ diagnostics: EffectDiagnostic[], files: EffectFile[], summary: { filesChecked: number, totalFiles: number, errors: number, warnings: number, messages: number } }} EffectOutput */
/** @typedef {{ project: string, output: EffectOutput }} EffectProjectResult */

const sourceExtensions = new Set([".ts", ".tsx"]);
const generatedDirectoryNames = new Set([
  "dist",
  "node_modules",
  "output",
  "outputs",
]);
const fixtureDirectory = "packages/cli/test-fixtures/effect-diagnostics/";
export const workspaceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
);
const require = createRequire(import.meta.url);

/** @param {string} absolutePath @returns {string} */
export const toWorkspacePath = absolutePath =>
  path.relative(workspaceRoot, absolutePath).split(path.sep).join("/");

/** @param {string} filePath @returns {string} */
const read = filePath => readFileSync(filePath, "utf8");

/** @param {string} relativePath @returns {boolean} */
export const isExcludedEffectPath = relativePath => {
  const normalized = relativePath.endsWith("/")
    ? relativePath
    : `${relativePath}/`;
  return (
    normalized.startsWith(fixtureDirectory) ||
    normalized.includes("/dist/") ||
    normalized.includes("/node_modules/") ||
    normalized.includes("/output/") ||
    normalized.includes("/outputs/")
  );
};

/** @param {string} directory @returns {string[]} */
const collectFiles = directory => {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.isDirectory() && generatedDirectoryNames.has(entry.name))
      return [];
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? collectFiles(target) : [target];
  });
};

/** @param {string} filePath @returns {boolean} */
const isEffectSource = filePath => {
  if (!sourceExtensions.has(path.extname(filePath))) return false;
  if (isExcludedEffectPath(toWorkspacePath(filePath))) return false;
  return /\bfrom\s+["'](?:effect|@effect\/)|\bimport\s*["'](?:effect|@effect\/)/u.test(
    read(filePath)
  );
};

/** @returns {string[]} */
export const authoredEffectSourceFiles = () =>
  collectFiles(path.join(workspaceRoot, "packages")).filter(isEffectSource);

/** @param {string} directory @returns {PackageManifest} */
const readManifest = directory =>
  JSON.parse(read(path.join(directory, "package.json")));

/** @param {PackageManifest} manifest @returns {boolean} */
const declaresEffect = manifest =>
  manifest.dependencies?.["effect"] !== undefined ||
  manifest.devDependencies?.["effect"] !== undefined ||
  manifest.peerDependencies?.["effect"] !== undefined;

/** @param {string} directory @returns {string | undefined} */
const packageProject = directory => {
  const typecheck = path.join(directory, "tsconfig.typecheck.json");
  const standard = path.join(directory, "tsconfig.json");
  return existsSync(typecheck)
    ? typecheck
    : existsSync(standard)
      ? standard
      : undefined;
};

/** @param {string} directory @returns {string[]} */
const projectCandidates = directory =>
  collectFiles(directory).filter(
    filePath =>
      path.basename(filePath).startsWith("tsconfig") &&
      filePath.endsWith(".json")
  );

/** @param {string} directory @returns {boolean} */
const hasDirectEffectSource = directory =>
  readdirSync(directory, { withFileTypes: true }).some(
    entry => entry.isFile() && isEffectSource(path.join(directory, entry.name))
  );

/** @param {string} directory @returns {string[]} */
const discoverPackageProjects = directory => {
  const manifestPath = path.join(directory, "package.json");
  if (!existsSync(manifestPath) || !declaresEffect(readManifest(directory)))
    return [];
  const packageDefault = packageProject(directory);
  const nestedProjects = projectCandidates(directory).filter(candidate => {
    const candidateDirectory = path.dirname(candidate);
    return (
      candidate !== packageDefault &&
      candidateDirectory !== directory &&
      !toWorkspacePath(candidate).startsWith(fixtureDirectory) &&
      hasDirectEffectSource(candidateDirectory)
    );
  });
  return packageDefault === undefined
    ? nestedProjects
    : [packageDefault, ...nestedProjects];
};

/** @returns {string[]} */
export const discoverEffectProjects = () =>
  readdirSync(path.join(workspaceRoot, "packages"), { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .flatMap(entry =>
      discoverPackageProjects(path.join(workspaceRoot, "packages", entry.name))
    )
    .sort();

/** @returns {Record<string, "error" | "warning">} */
export const recommendedSeverityMap = () => {
  /** @type {{ rules?: Record<string, string> }} */
  const preset = require("@effect/tsgo/oxlint-presets/recommended.json");
  const rules = preset.rules ?? {};
  return Object.fromEntries(
    Object.entries(rules).map(([rule, severity]) => {
      if (!rule.startsWith("effecttsgo/"))
        throw new Error(`Unexpected @effect/tsgo Recommended rule: ${rule}`);
      if (severity !== "error" && severity !== "warn") {
        throw new Error(
          `Unexpected @effect/tsgo Recommended severity for ${rule}: ${severity}`
        );
      }
      const name = rule
        .slice("effecttsgo/".length)
        .replace(/-([a-z])/gu, (_, letter) => letter.toUpperCase());
      return [name, severity === "error" ? "error" : "warning"];
    })
  );
};

/** @returns {string} */
const tsgoExecutable = () =>
  path.join(
    path.dirname(require.resolve("@effect/tsgo/package.json")),
    "dist",
    "effect-tsgo.cjs"
  );

/** @param {string} project @param {Record<string, "error" | "warning">} severityMap @returns {EffectProjectResult} */
export const runEffectProject = (project, severityMap) => {
  const result = spawnSync(
    process.execPath,
    [
      tsgoExecutable(),
      "diagnostics",
      "--project",
      project,
      "--format",
      "json",
      "--list-files",
      "--strict",
      "--lspconfig",
      JSON.stringify({ diagnosticSeverity: severityMap }),
    ],
    {
      cwd: workspaceRoot,
      encoding: "utf8",
      maxBuffer: 50 * 1024 * 1024,
      shell: false,
    }
  );
  if (result.error !== undefined) throw result.error;
  if (result.stdout.trim() === "") {
    throw new Error(
      `effect-tsgo produced no JSON for ${toWorkspacePath(project)}\n${result.stderr}`
    );
  }
  return { project, output: JSON.parse(result.stdout) };
};
