import path from "node:path";
import {
  assertEffectDirectiveAllowlist,
  validateEffectDirective,
} from "./effect-diagnostics-allowlist.mjs";
import {
  EFFECT_DIAGNOSTIC_POLICY,
  isArchitecturalNodeBuiltinPath,
  isBoundaryEffectPath,
  isBlockingEffectDiagnostic,
} from "./effect-diagnostics-policy.mjs";
import {
  discoverEffectProjects,
  authoredEffectSourceFiles,
  isExcludedEffectPath,
  recommendedSeverityMap,
  runEffectProject,
  toWorkspacePath,
  workspaceRoot,
} from "./effect-diagnostics-projects.mjs";

/** @typedef {{ file: string, line: number, column: number, code: number, name: string, message: string, severity: string }} EffectDiagnostic */
/** @typedef {import("./effect-diagnostics-projects.mjs").EffectProjectResult} EffectProjectResult */

export {
  EFFECT_DIAGNOSTIC_POLICY,
  assertEffectDirectiveAllowlist,
  discoverEffectProjects,
  isArchitecturalNodeBuiltinPath,
  isBoundaryEffectPath,
  isBlockingEffectDiagnostic,
  isExcludedEffectPath,
  recommendedSeverityMap,
  runEffectProject,
  toWorkspacePath,
  validateEffectDirective,
  workspaceRoot,
};

/** @param {readonly string[]} sourceFiles @param {ReadonlySet<string> | readonly string[]} checkedFiles */
export const assertEffectSourceCoverage = (sourceFiles, checkedFiles) => {
  const checked = new Set(
    [...checkedFiles].map(filePath => path.resolve(filePath))
  );
  const uncovered = sourceFiles.filter(
    filePath => !checked.has(path.resolve(filePath))
  );
  if (uncovered.length > 0) {
    throw new Error(
      `Effect source files are outside the diagnostics scope:\n${uncovered.map(toWorkspacePath).join("\n")}`
    );
  }
};

/** @param {readonly EffectProjectResult[]} results */
export const assertEffectProjectScope = results => {
  const checkedFiles = new Set(
    results.flatMap(result =>
      result.output.files.map(file => path.resolve(file.file))
    )
  );
  const sourceFiles = authoredEffectSourceFiles();
  const detected = results
    .flatMap(result => result.output.files)
    .filter(file => file.detectedEffect !== undefined);
  if (sourceFiles.length === 0 || results.length === 0) {
    throw new Error(
      "Effect diagnostics scope must contain Effect source files and projects"
    );
  }
  assertEffectSourceCoverage(sourceFiles, checkedFiles);
  if (
    detected.length === 0 ||
    detected.some(
      file => file.detectedEffect !== "v4" || file.supportedEffect !== "v4"
    )
  ) {
    throw new Error(
      "effect-tsgo did not report supported Effect v4 for every detected project file"
    );
  }
  assertEffectDirectiveAllowlist(recommendedSeverityMap());
};

/** @returns {readonly EffectProjectResult[]} */
export const collectEffectDiagnostics = () => {
  const results = discoverEffectProjects().map(project =>
    runEffectProject(project, recommendedSeverityMap())
  );
  assertEffectProjectScope(results);
  return results;
};

/** @param {readonly EffectProjectResult[]} results */
export const effectDiagnostics = results => {
  const projectFiles = new Set(
    results.flatMap(result =>
      result.output.files
        .filter(file => !isExcludedEffectPath(toWorkspacePath(file.file)))
        .map(file => path.resolve(file.file))
    )
  );
  return results.flatMap(result =>
    result.output.diagnostics.filter(
      diagnostic =>
        projectFiles.has(path.resolve(diagnostic.file)) &&
        isBlockingEffectDiagnostic(diagnostic)
    )
  );
};

/** @param {readonly EffectProjectResult[]} results */
export const formatEffectDiagnostics = results =>
  effectDiagnostics(results)
    .map(
      diagnostic =>
        `${diagnostic.file}:${diagnostic.name}: ${diagnostic.message}`
    )
    .join("\n");
