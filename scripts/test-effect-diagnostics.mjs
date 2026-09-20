import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  assertEffectSourceCoverage,
  discoverEffectProjects,
  isBlockingEffectDiagnostic,
  isArchitecturalNodeBuiltinPath,
  isBoundaryEffectPath,
  isExcludedEffectPath,
  recommendedSeverityMap,
  runEffectProject,
  validateEffectDirective,
} from "./lib/effect-diagnostics.mjs";

const workspaceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const severityMap = recommendedSeverityMap();
const discoveredProjects = discoverEffectProjects();
assert(
  discoveredProjects.some(project =>
    project.endsWith("packages/cli/examples/documentation/tsconfig.json")
  ),
  "nested Effect-bearing projects must be discovered"
);
assert(
  discoveredProjects.every(project => !project.includes("test-fixtures")),
  "diagnostic probes must remain outside the authored project set"
);
assert.throws(
  () =>
    assertEffectSourceCoverage(
      [path.join(workspaceRoot, "packages/escaped/effect-source.ts")],
      []
    ),
  /outside the diagnostics scope/u,
  "an Effect file outside every project must fail the scope guard"
);

/**
 * @param {string} directory
 * @param {string} source
 * @param {string | undefined} boundarySource
 * @returns {string}
 */
const writeProbeProject = (directory, source, boundarySource) => {
  writeFileSync(
    path.join(directory, "tsconfig.json"),
    JSON.stringify(
      {
        extends: path.join(workspaceRoot, "packages/tsconfig/node.json"),
        compilerOptions: { noEmit: true, rootDir: "." },
        include:
          boundarySource === undefined
            ? ["probe.ts"]
            : ["probe.ts", "boundary.ts"],
      },
      null,
      2
    )
  );
  const sourcePath = path.join(directory, "probe.ts");
  writeFileSync(sourcePath, source);
  if (boundarySource !== undefined) {
    writeFileSync(path.join(directory, "boundary.ts"), boundarySource);
  }
  return path.join(directory, "tsconfig.json");
};

/**
 * @param {string} directory
 * @param {string} source
 * @returns {import("./lib/effect-diagnostics.mjs").EffectProjectResult}
 */
const runProbe = (directory, source) =>
  runEffectProject(
    writeProbeProject(directory, source, undefined),
    severityMap
  );

/** @param {string} directory @param {string} source */
const runScopeProbe = (directory, source) =>
  runEffectProject(
    writeProbeProject(
      directory,
      source,
      `export async function boundary() {
  return 1;
}
`
    ),
    severityMap
  );

const cleanSource = `import { Effect } from "effect";

export const clean = Effect.succeed(1);
`;
const knownErrorSource = `import { Effect } from "effect";

export const implicitAny = Effect.fn("probe.implicitAny")(value =>
  Effect.succeed(value)
);
`;
const warningSource = `import { Effect } from "effect";

export const lazy = () => Effect.succeed(1);
`;
const acceptedSource = `import { Effect } from "effect";

export const accepted = Effect.fn("probe.accepted")(
  // @effect-diagnostics-next-line effectFnImplicitAny:off
  value => Effect.succeed(value)
);
`;
const staleSource = `import { Effect } from "effect";

// @effect-diagnostics-next-line asyncFunction:off
export const clean = Effect.succeed(1);
`;

const fixtureRoot = mkdtempSync(
  path.join(workspaceRoot, "packages/cli", ".effect-tsgo-")
);
try {
  const clean = runProbe(fixtureRoot, cleanSource).output;
  assert.deepEqual(
    clean.summary,
    { filesChecked: 1, totalFiles: 1, errors: 0, warnings: 0, messages: 0 },
    "clean Effect source must pass the Recommended strict probe"
  );
  const scoped = runScopeProbe(fixtureRoot, cleanSource).output;
  assert(
    scoped.diagnostics.some(
      diagnostic =>
        diagnostic.file.endsWith("boundary.ts") &&
        diagnostic.name === "asyncFunction"
    ),
    "a non-Effect file in an Effect-bearing project must remain in diagnostics"
  );

  const knownError = runProbe(fixtureRoot, knownErrorSource).output;
  assert(
    knownError.diagnostics.some(
      diagnostic =>
        diagnostic.name === "effectFnImplicitAny" &&
        diagnostic.severity === "error"
    ),
    "effectFnImplicitAny must be an error in the Recommended probe"
  );

  const defaultWarning = runEffectProject(
    writeProbeProject(fixtureRoot, warningSource, undefined),
    {}
  ).output;
  const recommendedWarning = runProbe(fixtureRoot, warningSource).output;
  assert.equal(defaultWarning.summary.warnings, 0);
  assert(
    recommendedWarning.diagnostics.some(
      diagnostic =>
        diagnostic.name === "lazyEffect" && diagnostic.severity === "warning"
    ),
    "Recommended must promote the lazyEffect message to a strict warning"
  );

  assert.equal(
    runProbe(fixtureRoot, acceptedSource).output.diagnostics.length,
    0,
    "an exact next-line exception must suppress only its named diagnostic"
  );

  assert.throws(
    () =>
      validateEffectDirective(
        "// @effect-diagnostics-next-line *:off",
        severityMap
      ),
    /exact @effect-diagnostics-next-line/u,
    "wildcard and broad exceptions must be rejected"
  );
  assert.throws(
    () =>
      validateEffectDirective(
        "// @effect-diagnostics-next-line floatingEffect:off",
        severityMap
      ),
    /retained exception allowlist/u,
    "a Recommended rule still needs a file-scoped retained exception"
  );

  const stale = runProbe(fixtureRoot, staleSource).output;
  assert(
    stale.diagnostics.some(
      diagnostic =>
        diagnostic.code === 377000 &&
        /directive has no effect/u.test(diagnostic.message)
    ),
    "stale exceptions must fail with an unused directive diagnostic"
  );
  const unusedDirective = stale.diagnostics.find(
    diagnostic => diagnostic.code === 377000
  );
  assert(unusedDirective !== undefined);
  assert.equal(
    isBlockingEffectDiagnostic(unusedDirective),
    true,
    "unused diagnostic directives remain blocking"
  );

  assert.equal(
    isExcludedEffectPath("packages/cli/test/outputs/generated.ts"),
    true
  );
  assert.equal(
    isExcludedEffectPath(
      "packages/test-utils/src/test-project/output/generated.ts"
    ),
    true
  );
  assert.equal(
    isExcludedEffectPath("packages/cli/__test__/authored.test.ts"),
    false
  );
  assert.equal(
    isBoundaryEffectPath("packages/cli/__test__/authored.test.ts"),
    true
  );
  assert.equal(
    isArchitecturalNodeBuiltinPath("packages/cli/src/nodeBoundary.ts"),
    true
  );
  assert.equal(
    isBlockingEffectDiagnostic({
      file: path.join(workspaceRoot, "packages/cli/src/entry.ts"),
      line: 1,
      column: 1,
      code: 1,
      name: "asyncFunction",
      message: "boundary",
      severity: "warning",
    }),
    false
  );
  assert.equal(
    isBlockingEffectDiagnostic({
      file: path.join(workspaceRoot, "packages/core/src/fixture.ts"),
      line: 1,
      column: 1,
      code: 1,
      name: "asyncFunction",
      message: "production",
      severity: "warning",
    }),
    true
  );
  assert.equal(
    isBlockingEffectDiagnostic({
      file: path.join(workspaceRoot, "packages/cli/src/entry.ts"),
      line: 1,
      column: 1,
      code: 1,
      name: "floatingEffect",
      message: "correctness",
      severity: "warning",
    }),
    true
  );
  assert.equal(
    isBlockingEffectDiagnostic({
      file: path.join(workspaceRoot, "packages/cli/__test__/fixture.ts"),
      line: 1,
      column: 1,
      code: 1,
      name: "missingStarInYieldEffectGen",
      message: "correctness",
      severity: "warning",
    }),
    true
  );
  assert.equal(
    isBlockingEffectDiagnostic({
      file: path.join(workspaceRoot, "packages/cli/src/entry.ts"),
      line: 1,
      column: 1,
      code: 1,
      name: "futureWarningRule",
      message: "unknown",
      severity: "warning",
    }),
    true
  );
  assert.equal(
    isBlockingEffectDiagnostic({
      file: path.join(workspaceRoot, "packages/core/src/fixture.ts"),
      line: 1,
      column: 1,
      code: 1,
      name: "nodeBuiltinImport",
      message: "architecture",
      severity: "warning",
    }),
    true
  );
  assert.equal(
    isBlockingEffectDiagnostic({
      file: path.join(workspaceRoot, "packages/cli/src/nodeBoundary.ts"),
      line: 1,
      column: 1,
      code: 1,
      name: "nodeBuiltinImport",
      message: "architecture",
      severity: "warning",
    }),
    false
  );
  assert.equal(
    isBlockingEffectDiagnostic({
      file: path.join(workspaceRoot, "packages/cli/src/fixture.ts"),
      line: 1,
      column: 1,
      code: 1,
      name: "missingEffectContext",
      message: "error",
      severity: "error",
    }),
    true
  );

  assert(
    runProbe(fixtureRoot, cleanSource).output.files.every(
      file => file.detectedEffect === "v4" && file.supportedEffect === "v4"
    ),
    "the probe must report supported Effect v4"
  );
} finally {
  rmSync(fixtureRoot, { recursive: true, force: true });
}

process.stdout.write(
  "Effect tsgo probes passed: clean, effectFnImplicitAny, Recommended warning promotion, narrow exception, broad exception, stale exception, and v4 detection\n"
);
