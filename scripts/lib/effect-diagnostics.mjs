import path from "node:path";
import { assertEffectDirectiveAllowlist } from "./effect-diagnostics-allowlist.mjs";
import {
  effectDiagnosticExemption,
  isBlockingEffectDiagnostic,
} from "./effect-diagnostics-policy.mjs";
import {
  discoverEffectProjects,
  authoredEffectSourceFiles,
  isExcludedEffectPath,
  recommendedSeverityMap,
  runEffectProject,
  toWorkspacePath,
} from "./effect-diagnostics-projects.mjs";

/** @typedef {{ file: string, line: number, column: number, code: number, name: string, message: string, severity: string }} EffectDiagnostic */
/** @typedef {EffectDiagnostic & { category: string }} ExemptedEffectDiagnostic */
/** @typedef {import("./effect-diagnostics-projects.mjs").EffectProjectResult} EffectProjectResult */

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

/** @param {EffectDiagnostic} diagnostic @returns {string} */
const diagnosticKey = diagnostic =>
  [
    toWorkspacePath(path.resolve(diagnostic.file)),
    diagnostic.line,
    diagnostic.column,
    diagnostic.code,
    diagnostic.name,
  ].join(":");

/**
 * Every diagnostic reported for an authored (non-generated) project file,
 * deduplicated across projects that share a file.
 * @param {readonly EffectProjectResult[]} results @returns {EffectDiagnostic[]}
 */
const authoredDiagnostics = results => {
  const projectFiles = new Set(
    results.flatMap(result =>
      result.output.files
        .filter(file => !isExcludedEffectPath(toWorkspacePath(file.file)))
        .map(file => path.resolve(file.file))
    )
  );
  /** @type {Map<string, EffectDiagnostic>} */
  const unique = new Map();
  for (const diagnostic of results.flatMap(
    result => result.output.diagnostics
  )) {
    if (projectFiles.has(path.resolve(diagnostic.file))) {
      unique.set(diagnosticKey(diagnostic), diagnostic);
    }
  }
  return [...unique.values()];
};

/** @param {readonly EffectProjectResult[]} results @returns {EffectDiagnostic[]} */
export const effectDiagnostics = results =>
  authoredDiagnostics(results).filter(isBlockingEffectDiagnostic);

/**
 * The non-blocking warnings the central policy exempts, with their category.
 * @param {readonly EffectProjectResult[]} results @returns {ExemptedEffectDiagnostic[]}
 */
export const exemptedEffectDiagnostics = results =>
  authoredDiagnostics(results).flatMap(diagnostic => {
    const category = effectDiagnosticExemption(diagnostic);
    return category === undefined ? [] : [{ ...diagnostic, category }];
  });

/**
 * One line per exemption category and rule, with the warning count, sorted.
 * @param {readonly ExemptedEffectDiagnostic[]} exempted @returns {string[]}
 */
export const summarizeExemptedEffectDiagnostics = exempted => {
  /** @type {Map<string, number>} */
  const counts = new Map();
  for (const diagnostic of exempted) {
    const key = `${diagnostic.category} ${diagnostic.name}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, count]) => `${key}: ${count}`);
};

/** @param {readonly ExemptedEffectDiagnostic[]} exempted @returns {string[]} */
export const listExemptedEffectDiagnostics = exempted =>
  exempted
    .map(
      diagnostic =>
        `${toWorkspacePath(path.resolve(diagnostic.file))}:${diagnostic.line}:${diagnostic.column} [${diagnostic.category}] ${diagnostic.name}: ${diagnostic.message}`
    )
    .sort((left, right) => left.localeCompare(right));

/** @param {readonly EffectProjectResult[]} results */
export const formatEffectDiagnostics = results =>
  effectDiagnostics(results)
    .map(
      diagnostic =>
        `${diagnostic.file}:${diagnostic.name}: ${diagnostic.message}`
    )
    .join("\n");
