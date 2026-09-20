import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  discoverEffectProjects,
  isExcludedEffectPath,
  recommendedSeverityMap,
  runEffectProject,
  toWorkspacePath,
  workspaceRoot,
} from "./effect-diagnostics-projects.mjs";

/** @typedef {{ file: string, line: number, column: number, code: number, name: string, message: string, severity: string }} EffectDiagnostic */
/** @typedef {import("./effect-diagnostics-projects.mjs").EffectProjectResult} EffectProjectResult */
/** @typedef {{ file: string, rules: Record<string, number> }} EffectDirectiveAllowlistEntry */
/** @typedef {{ version: number, total: number, rationales: Record<string, string>, exceptions: EffectDirectiveAllowlistEntry[] }} EffectDirectiveAllowlist */

const sourceExtensions = new Set([".ts", ".tsx"]);
const allowlistPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../config/effect-diagnostics-allowlist.json"
);
/** @type {EffectDirectiveAllowlist} */
const directiveAllowlist = JSON.parse(readFileSync(allowlistPath, "utf8"));
/** @param {string} filePath @returns {string} */
const read = filePath => readFileSync(filePath, "utf8");

export {
  discoverEffectProjects,
  isExcludedEffectPath,
  recommendedSeverityMap,
  runEffectProject,
  workspaceRoot,
};

/** @param {string} comment @returns {string} */
const parseDirectiveRule = comment => {
  const matches = [
    ...comment.matchAll(
      /@effect-diagnostics-next-line ([a-z][a-zA-Z0-9]*):off/gu
    ),
  ];
  const normalized = comment.trim();
  const valid =
    /^\/\/\s*@effect-diagnostics-next-line [a-z][a-zA-Z0-9]*:off$/u.test(
      normalized
    ) ||
    /^\?\s+\/\/\s*@effect-diagnostics-next-line [a-z][a-zA-Z0-9]*:off$/u.test(
      normalized
    ) ||
    /^\/\*\s*@effect-diagnostics-next-line [a-z][a-zA-Z0-9]*:off\s*\*\/$/u.test(
      normalized
    );
  if (matches.length === 0 || !valid) {
    throw new Error(
      "Effect diagnostic exceptions must be exact @effect-diagnostics-next-line <rule>:off comments"
    );
  }
  const rule = matches[0]?.[1];
  if (matches.length !== 1 || rule === undefined) {
    throw new Error("Effect diagnostic exceptions must name exactly one rule");
  }
  return rule;
};

/** @param {string} rule @param {Record<string, "error" | "warning">} severityMap */
const assertAllowedDirectiveRule = (rule, severityMap) => {
  if (
    severityMap[rule] === undefined ||
    directiveAllowlist.rationales[rule] === undefined
  ) {
    throw new Error(
      `Effect diagnostic exception is not in the retained exception allowlist: ${rule}`
    );
  }
};

/** @param {string} comment @param {Record<string, "error" | "warning">} severityMap @returns {string} */
export const validateEffectDirective = (comment, severityMap) => {
  const rule = parseDirectiveRule(comment);
  assertAllowedDirectiveRule(rule, severityMap);
  return rule;
};

/** @param {Record<string, number>} counts @param {string} file @param {string} rule */
const addDirective = (counts, file, rule) => {
  const key = `${file}|${rule}`;
  counts[key] = (counts[key] ?? 0) + 1;
};

const authoredTypeScriptFiles = () => {
  /** @param {string} directory @returns {string[]} */
  const collect = directory => {
    if (!existsSync(directory)) return [];
    return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
      if (
        entry.isDirectory() &&
        ["dist", "node_modules", "output", "outputs"].includes(entry.name)
      )
        return [];
      const target = path.join(directory, entry.name);
      return entry.isDirectory() ? collect(target) : [target];
    });
  };
  return collect(path.join(workspaceRoot, "packages")).filter(
    filePath =>
      sourceExtensions.has(path.extname(filePath)) &&
      !isExcludedEffectPath(toWorkspacePath(filePath))
  );
};

/** @param {Record<string, "error" | "warning">} severityMap @returns {Record<string, number>} */
const collectDirectiveCounts = severityMap => {
  /** @type {Record<string, number>} */
  const counts = {};
  for (const filePath of authoredTypeScriptFiles()) {
    for (const line of read(filePath).split("\n")) {
      if (line.includes("@effect-diagnostics"))
        addDirective(
          counts,
          toWorkspacePath(filePath),
          validateEffectDirective(line, severityMap)
        );
    }
  }
  return counts;
};

/** @param {EffectDirectiveAllowlistEntry} entry @param {Record<string, "error" | "warning">} severityMap @returns {Record<string, number>} */
const expectedEntryCounts = (entry, severityMap) => {
  if (entry.file.endsWith("/") || isExcludedEffectPath(entry.file))
    throw new Error(
      `Effect diagnostic allowlist contains an excluded file: ${entry.file}`
    );
  return Object.fromEntries(
    Object.entries(entry.rules).map(([rule, count]) => {
      if (
        !Number.isInteger(count) ||
        count < 1 ||
        severityMap[rule] === undefined ||
        directiveAllowlist.rationales[rule]?.trim() === ""
      ) {
        throw new Error(
          `Effect diagnostic allowlist rule is invalid: ${entry.file} ${rule}`
        );
      }
      return [`${entry.file}|${rule}`, count];
    })
  );
};

/** @param {Record<string, "error" | "warning">} severityMap @returns {Record<string, number>} */
const expectedDirectiveCounts = severityMap => {
  /** @type {Record<string, number>} */
  const expected = Object.assign(
    {},
    ...directiveAllowlist.exceptions.map(entry =>
      expectedEntryCounts(entry, severityMap)
    )
  );
  if (
    directiveAllowlist.total !==
    Object.values(expected).reduce((sum, count) => sum + count, 0)
  ) {
    throw new Error(
      "Effect diagnostic allowlist total does not match its entries"
    );
  }
  return expected;
};

/** @param {Record<string, number>} values */
const normalizeCounts = values =>
  Object.fromEntries(
    Object.entries(values).sort(([left], [right]) => left.localeCompare(right))
  );

export const assertEffectDirectiveAllowlist = () => {
  const severityMap = recommendedSeverityMap();
  const actual = collectDirectiveCounts(severityMap);
  const expected = expectedDirectiveCounts(severityMap);
  if (
    JSON.stringify(normalizeCounts(actual)) !==
    JSON.stringify(normalizeCounts(expected))
  ) {
    throw new Error(
      `Effect diagnostic allowlist mismatch:\nexpected ${JSON.stringify(expected)}\nactual ${JSON.stringify(actual)}`
    );
  }
};

/** @param {readonly string[]} sourceFiles @param {ReadonlySet<string> | readonly string[]} checkedFiles */
export const assertEffectSourceCoverage = (sourceFiles, checkedFiles) => {
  const checked = new Set(
    [...checkedFiles].map(filePath => path.resolve(filePath))
  );
  const uncovered = sourceFiles.filter(
    filePath => !checked.has(path.resolve(filePath))
  );
  if (uncovered.length > 0)
    throw new Error(
      `Effect source files are outside the diagnostics scope:\n${uncovered.map(toWorkspacePath).join("\n")}`
    );
};

/** @param {readonly EffectProjectResult[]} results */
export const assertEffectProjectScope = results => {
  const checkedFiles = new Set(
    results.flatMap(result =>
      result.output.files.map(file => path.resolve(file.file))
    )
  );
  const sourceFiles = authoredTypeScriptFiles().filter(filePath =>
    /\bfrom\s+["'](?:effect|@effect\/)|\bimport\s*["'](?:effect|@effect\/)/u.test(
      read(filePath)
    )
  );
  if (sourceFiles.length === 0 || results.length === 0)
    throw new Error(
      "Effect diagnostics scope must contain Effect source files and projects"
    );
  assertEffectSourceCoverage(sourceFiles, checkedFiles);
  const detected = results
    .flatMap(result => result.output.files)
    .filter(file => file.detectedEffect !== undefined);
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
  assertEffectDirectiveAllowlist();
};

/** @returns {readonly EffectProjectResult[]} */
export const collectEffectDiagnostics = () => {
  const results = discoverEffectProjects().map(project =>
    runEffectProject(project, recommendedSeverityMap())
  );
  assertEffectProjectScope(results);
  return results;
};

export const EFFECT_DIAGNOSTIC_POLICY = Object.freeze({
  warningExemptions: Object.freeze([
    Object.freeze({
      category: "test-example-boundary",
      paths: Object.freeze(["/__test__/", "/examples/"]),
      rules: Object.freeze([
        "asyncFunction",
        "allOfMapToForEach",
        "extendsNativeError",
        "globalConsole",
        "globalFetch",
        "globalDate",
        "globalTimers",
        "globalConsoleInEffect",
        "newPromise",
        "nodeBuiltinImport",
        "processEnv",
        "runOfExitToRunExit",
      ]),
    }),
    Object.freeze({
      category: "production-boundary",
      paths: Object.freeze([
        "packages/cli/src/cli.ts",
        "packages/cli/src/cliLogger.ts",
        "packages/cli/src/entry.ts",
        "packages/cli/src/runDoctor.ts",
        "packages/cli/src/runInit.ts",
        "packages/cli/src/runValidate.ts",
        "packages/cli/src/services/",
        "packages/clients/src/lib/",
        "packages/command/src/lib/",
        "packages/effect/src/runtime.ts",
        "packages/gen/src/services/",
        "packages/hono/src/lib/",
        "packages/openapi/src/openApiPlugin.ts",
        "packages/server/src/lib/",
        "packages/test-utils/src/",
        "packages/types/src/lib/errors/",
      ]),
      rules: Object.freeze([
        "asyncFunction",
        "extendsNativeError",
        "globalConsole",
        "globalConsoleInEffect",
        "globalFetch",
        "globalDate",
        "globalTimers",
        "lazyEffect",
        "newPromise",
        "preferSchemaOverJson",
        "preferTypedSchemaDecoder",
        "processEnv",
        "runOfExitToRunExit",
      ]),
    }),
    Object.freeze({
      category: "architectural-node-builtin-boundary",
      paths: Object.freeze([
        "packages/aws-cdk/src/",
        "packages/clients/src/",
        "packages/cli/src/",
        "packages/command/src/",
        "packages/effect/src/",
        "packages/gen/src/",
        "packages/hono/src/",
        "packages/openapi/src/",
        "packages/server/src/",
        "packages/test-utils/src/",
        "packages/types/src/",
      ]),
      rules: Object.freeze(["nodeBuiltinImport"]),
    }),
  ]),
});

/** @param {string} file */
export const isBoundaryEffectPath = file =>
  EFFECT_DIAGNOSTIC_POLICY.warningExemptions
    .find(policy => policy.category === "test-example-boundary")
    ?.paths.some(part => file.split(path.sep).join("/").includes(part)) ??
  false;
/** @param {string} file */
export const isArchitecturalNodeBuiltinPath = file =>
  EFFECT_DIAGNOSTIC_POLICY.warningExemptions
    .find(policy => policy.category === "architectural-node-builtin-boundary")
    ?.paths.some(part => file.split(path.sep).join("/").startsWith(part)) ??
  false;

/** @param {string} file @param {string} pathPart */
const matchesPolicyPath = (file, pathPart) =>
  pathPart.startsWith("/")
    ? file.includes(pathPart)
    : pathPart.endsWith("/")
      ? file.startsWith(pathPart)
      : file === pathPart;

/** @param {string} file @param {string} rule */
const isAllowedWarning = (file, rule) =>
  EFFECT_DIAGNOSTIC_POLICY.warningExemptions.some(
    policy =>
      policy.rules.includes(rule) &&
      policy.paths.some(pathPart => matchesPolicyPath(file, pathPart))
  );

/** @param {EffectDiagnostic} diagnostic */
export const isBlockingEffectDiagnostic = diagnostic => {
  if (diagnostic.severity === "error") return true;
  const relativeFile = toWorkspacePath(path.resolve(diagnostic.file));
  return !isAllowedWarning(relativeFile, diagnostic.name);
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

export { toWorkspacePath };
