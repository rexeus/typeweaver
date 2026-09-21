import path from "node:path";
import { toWorkspacePath } from "./effect-diagnostics-projects.mjs";

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

/** @param {string} file @returns {boolean} */
export const isBoundaryEffectPath = file =>
  EFFECT_DIAGNOSTIC_POLICY.warningExemptions
    .find(policy => policy.category === "test-example-boundary")
    ?.paths.some(part => file.split(path.sep).join("/").includes(part)) ??
  false;

/** @param {string} file @returns {boolean} */
export const isArchitecturalNodeBuiltinPath = file =>
  EFFECT_DIAGNOSTIC_POLICY.warningExemptions
    .find(policy => policy.category === "architectural-node-builtin-boundary")
    ?.paths.some(part => file.split(path.sep).join("/").startsWith(part)) ??
  false;

/** @param {string} file @param {string} pathPart @returns {boolean} */
const matchesPolicyPath = (file, pathPart) =>
  pathPart.startsWith("/")
    ? file.includes(pathPart)
    : pathPart.endsWith("/")
      ? file.startsWith(pathPart)
      : file === pathPart;

/** @param {string} file @param {string} rule @returns {boolean} */
const isAllowedWarning = (file, rule) =>
  EFFECT_DIAGNOSTIC_POLICY.warningExemptions.some(
    policy =>
      policy.rules.includes(rule) &&
      policy.paths.some(pathPart => matchesPolicyPath(file, pathPart))
  );

/** @param {import("./effect-diagnostics.mjs").EffectDiagnostic} diagnostic @returns {boolean} */
export const isBlockingEffectDiagnostic = diagnostic => {
  if (diagnostic.severity === "error") return true;
  const relativeFile = toWorkspacePath(path.resolve(diagnostic.file));
  return !isAllowedWarning(relativeFile, diagnostic.name);
};
