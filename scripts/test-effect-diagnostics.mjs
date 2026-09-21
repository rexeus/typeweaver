import assert from "node:assert/strict";
import path from "node:path";
import {
  acceptedSource,
  cleanSource,
  createProbeRunner,
  knownErrorSource,
  staleSource,
  warningSource,
} from "./lib/effect-diagnostics-test-probes.mjs";
import {
  assertEffectSourceCoverage,
  discoverEffectProjects,
  isArchitecturalNodeBuiltinPath,
  isBlockingEffectDiagnostic,
  isBoundaryEffectPath,
  isExcludedEffectPath,
  recommendedSeverityMap,
  validateEffectDirective,
  workspaceRoot,
} from "./lib/effect-diagnostics.mjs";

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
  /outside the diagnostics scope/u
);

const runner = createProbeRunner(severityMap);
try {
  const clean = runner.runProbe(cleanSource).output;
  assert.deepEqual(clean.summary, {
    filesChecked: 1,
    totalFiles: 1,
    errors: 0,
    warnings: 0,
    messages: 0,
  });
  const scoped = runner.runScopeProbe(cleanSource).output;
  assert(
    scoped.diagnostics.some(
      diagnostic =>
        diagnostic.file.endsWith("boundary.ts") &&
        diagnostic.name === "asyncFunction"
    )
  );
  const knownError = runner.runProbe(knownErrorSource).output;
  assert(
    knownError.diagnostics.some(
      diagnostic =>
        diagnostic.name === "effectFnImplicitAny" &&
        diagnostic.severity === "error"
    )
  );
  const defaultWarning = runner.runWithSeverity(warningSource, {}).output;
  const recommendedWarning = runner.runProbe(warningSource).output;
  assert.equal(defaultWarning.summary.warnings, 0);
  assert(
    recommendedWarning.diagnostics.some(
      diagnostic =>
        diagnostic.name === "lazyEffect" && diagnostic.severity === "warning"
    )
  );
  assert.equal(runner.runProbe(acceptedSource).output.diagnostics.length, 0);
  assert.throws(
    () =>
      validateEffectDirective(
        "// @effect-diagnostics-next-line *:off",
        severityMap
      ),
    /exact @effect-diagnostics-next-line/u
  );
  assert.throws(
    () =>
      validateEffectDirective(
        "// @effect-diagnostics-next-line floatingEffect:off",
        severityMap
      ),
    /retained exception allowlist/u
  );
  const stale = runner.runProbe(staleSource).output;
  const unusedDirective = stale.diagnostics.find(
    diagnostic => diagnostic.code === 377000
  );
  assert(unusedDirective !== undefined);
  assert.equal(isBlockingEffectDiagnostic(unusedDirective), true);
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
  /** @param {string} file @param {string} name @param {string} severity @returns {import("./lib/effect-diagnostics.mjs").EffectDiagnostic} */
  const diagnostic = (file, name, severity) => ({
    file,
    line: 1,
    column: 1,
    code: 1,
    name,
    message: name,
    severity,
  });
  assert.equal(
    isBlockingEffectDiagnostic(
      diagnostic(
        path.join(workspaceRoot, "packages/cli/src/entry.ts"),
        "asyncFunction",
        "warning"
      )
    ),
    false
  );
  assert.equal(
    isBlockingEffectDiagnostic(
      diagnostic(
        path.join(workspaceRoot, "packages/core/src/fixture.ts"),
        "asyncFunction",
        "warning"
      )
    ),
    true
  );
  assert.equal(
    isBlockingEffectDiagnostic(
      diagnostic(
        path.join(workspaceRoot, "packages/cli/src/entry.ts"),
        "floatingEffect",
        "warning"
      )
    ),
    true
  );
  assert.equal(
    isBlockingEffectDiagnostic(
      diagnostic(
        path.join(workspaceRoot, "packages/cli/__test__/fixture.ts"),
        "missingStarInYieldEffectGen",
        "warning"
      )
    ),
    true
  );
  assert.equal(
    isBlockingEffectDiagnostic(
      diagnostic(
        path.join(workspaceRoot, "packages/cli/src/entry.ts"),
        "futureWarningRule",
        "warning"
      )
    ),
    true
  );
  assert.equal(
    isBlockingEffectDiagnostic(
      diagnostic(
        path.join(workspaceRoot, "packages/core/src/fixture.ts"),
        "nodeBuiltinImport",
        "warning"
      )
    ),
    true
  );
  assert.equal(
    isBlockingEffectDiagnostic(
      diagnostic(
        path.join(workspaceRoot, "packages/cli/src/nodeBoundary.ts"),
        "nodeBuiltinImport",
        "warning"
      )
    ),
    false
  );
  assert.equal(
    isBlockingEffectDiagnostic(
      diagnostic(
        path.join(workspaceRoot, "packages/cli/src/fixture.ts"),
        "missingEffectContext",
        "error"
      )
    ),
    true
  );
  assert(
    clean.files.every(
      file => file.detectedEffect === "v4" && file.supportedEffect === "v4"
    )
  );
} finally {
  runner.cleanup();
}

process.stdout.write(
  "Effect tsgo probes passed: clean, effectFnImplicitAny, Recommended warning promotion, narrow exception, broad exception, stale exception, and v4 detection\n"
);
