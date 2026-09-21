import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { workspaceRoot } from "./lint-policy-contract.mjs";
import { writeClassifiedProbeFixtures } from "./maintainability-classification-probes.mjs";
import { cognitiveComplexity } from "./maintainability-fixtures.mjs";
import {
  dependencySource,
  fileLines,
  writeDependencySources,
} from "./maintainability-probe-fixtures.mjs";
import { spawnPnpmSync } from "./pnpm-command.mjs";

/** @typedef {{ code: string, filename: string }} LintDiagnostic */

/** @param {import("node:child_process").SpawnSyncReturns<string>} result @returns {{ diagnostics: LintDiagnostic[] }} */
const parseLintOutput = result => {
  if (result.error !== undefined) throw result.error;
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(
      `pnpm lint did not return JSON for maintainability probes\n${result.stdout}\n${result.stderr}`,
      { cause: error }
    );
  }
};

/** @param {string} fixtureRoot @returns {void} */
const writeCoreProbeFixtures = fixtureRoot => {
  const testRoot = path.join(fixtureRoot, "__test__");
  mkdirSync(testRoot, { recursive: true });
  writeFileSync(
    path.join(fixtureRoot, "source-max-lines.valid.ts"),
    `${fileLines(249)}\n`
  );
  writeFileSync(
    path.join(fixtureRoot, "source-max-lines.invalid.ts"),
    `${fileLines(250)}\n`
  );
  writeFileSync(
    path.join(testRoot, "test-max-lines.valid.ts"),
    `${fileLines(349)}\n`
  );
  writeFileSync(
    path.join(testRoot, "test-max-lines.invalid.ts"),
    `${fileLines(350)}\n`
  );
  writeFileSync(
    path.join(fixtureRoot, "cognitive-complexity.valid.ts"),
    `${cognitiveComplexity(false)}\n`
  );
  writeFileSync(
    path.join(fixtureRoot, "cognitive-complexity.invalid.ts"),
    `${cognitiveComplexity(true)}\n`
  );
  writeDependencySources(fixtureRoot);
  writeFileSync(
    path.join(fixtureRoot, "max-dependencies.valid.ts"),
    `${dependencySource(9)}\n`
  );
  writeFileSync(
    path.join(fixtureRoot, "max-dependencies.invalid.ts"),
    `${dependencySource(10)}\n`
  );
  writeFileSync(
    path.join(fixtureRoot, "not-a-barrel.ts"),
    'export { namedTarget } from "./importTarget.js";\n'
  );
  writeFileSync(
    path.join(fixtureRoot, "mixed-not-a-barrel.ts"),
    [
      'export { namedTarget } from "./importTarget.js";',
      "export const implementation = 1;",
      "",
    ].join("\n")
  );
  writeFileSync(
    path.join(fixtureRoot, "importTarget.ts"),
    "export const namedTarget = 1;\n"
  );
};

/** @param {{ fixtureRoot: string, configRoot: string, scriptsRoot: string, scriptsValidName: string, scriptsInvalidName: string }} roots @returns {void} */
const writeProbeFixtures = roots => {
  writeCoreProbeFixtures(roots.fixtureRoot);
  writeClassifiedProbeFixtures(roots);
};

/** @param {readonly LintDiagnostic[]} diagnostics @param {string} filePath @returns {LintDiagnostic[]} */
const diagnosticsFor = (diagnostics, filePath) =>
  diagnostics.filter(
    diagnostic => path.resolve(workspaceRoot, diagnostic.filename) === filePath
  );

/** @param {readonly LintDiagnostic[]} diagnostics @param {string} filePath @param {string} label @returns {void} */
const assertClean = (diagnostics, filePath, label) => {
  const found = diagnosticsFor(diagnostics, filePath);
  if (found.length > 0)
    throw new Error(
      `${label}: valid fixture produced ${JSON.stringify(found.map(item => item.code))}`
    );
};

/** @param {readonly LintDiagnostic[]} diagnostics @param {string} filePath @param {string} rule @param {string} label @returns {void} */
const assertRule = (diagnostics, filePath, rule, label) => {
  const found = diagnosticsFor(diagnostics, filePath);
  if (!found.some(item => item.code === rule))
    throw new Error(
      `${label}: invalid fixture did not produce ${rule} (got ${JSON.stringify(found.map(item => item.code))})`
    );
};

/** @param {readonly LintDiagnostic[]} diagnostics @param {{ path: string, rule?: string, label: string }} probe @returns {void} */
const assertProbe = (diagnostics, probe) => {
  if (probe.rule === undefined)
    assertClean(diagnostics, probe.path, probe.label);
  else assertRule(diagnostics, probe.path, probe.rule, probe.label);
};

/** @type {readonly { relativePath: string, rule: string | undefined, label: string }[]} */
const probeDefinitions = [
  {
    relativePath: "source-max-lines.valid.ts",
    rule: undefined,
    label: "source max-lines 250",
  },
  {
    relativePath: "source-max-lines.invalid.ts",
    rule: "eslint(max-lines)",
    label: "source max-lines 251 including a comment",
  },
  {
    relativePath: "__test__/test-max-lines.valid.ts",
    rule: undefined,
    label: "test max-lines 350",
  },
  {
    relativePath: "__test__/test-max-lines.invalid.ts",
    rule: "eslint(max-lines)",
    label: "test max-lines 351 including a comment",
  },
  {
    relativePath: "cognitive-complexity.valid.ts",
    rule: undefined,
    label: "cognitive complexity 12",
  },
  {
    relativePath: "cognitive-complexity.invalid.ts",
    rule: "sonarjs(cognitive-complexity)",
    label: "cognitive complexity 13",
  },
  {
    relativePath: "max-dependencies.valid.ts",
    rule: undefined,
    label: "nine runtime plus one type-only dependency (ten total)",
  },
  {
    relativePath: "max-dependencies.invalid.ts",
    rule: "import(max-dependencies)",
    label: "eleven dependencies including a type-only import",
  },
  {
    relativePath: "not-a-barrel.ts",
    rule: undefined,
    label: "pure barrel independent of filename",
  },
  {
    relativePath: "mixed-not-a-barrel.ts",
    rule: "typeweaver(pure-barrel)",
    label: "mixed barrel independent of filename",
  },
];

/** @param {readonly LintDiagnostic[]} diagnostics @param {{ configRoot: string, scriptsRoot: string, scriptsValidName: string, scriptsInvalidName: string, fixtureRoot: string }} roots @returns {void} */
const assertClassifiedProbes = (diagnostics, roots) => {
  const classifiedRoots = [
    {
      directory: roots.configRoot,
      validName: "boundary-valid.test.ts",
      invalidName: "boundary-invalid.test.ts",
      label: "config test",
    },
    {
      directory: roots.scriptsRoot,
      validName: roots.scriptsValidName,
      invalidName: roots.scriptsInvalidName,
      label: "checked-JS test",
    },
    {
      directory: roots.fixtureRoot,
      validName: "boundary-valid.tst.ts",
      invalidName: "boundary-invalid.tst.ts",
      label: "package tst test",
    },
  ];
  for (const { directory, validName, invalidName, label } of classifiedRoots) {
    assertProbe(diagnostics, {
      path: path.join(directory, validName),
      label: `${label} max-lines 350`,
    });
    assertProbe(diagnostics, {
      path: path.join(directory, invalidName),
      rule: "eslint(max-lines)",
      label: `${label} max-lines 351`,
    });
  }
};

/** @param {string} fixtureRoot @returns {void} */
export const assertStricterMaintainabilityProbes = fixtureRoot => {
  /** @type {string | undefined} */
  let configRoot;
  const scriptsRoot = path.join(workspaceRoot, "scripts");
  const scriptsValidName = `test-lint-policy-${path.basename(fixtureRoot)}-valid.mjs`;
  const scriptsInvalidName = `test-lint-policy-${path.basename(fixtureRoot)}-invalid.mjs`;
  try {
    configRoot = mkdtempSync(
      path.join(workspaceRoot, "config", ".lint-policy-probe-")
    );
    writeProbeFixtures({
      fixtureRoot,
      configRoot,
      scriptsRoot,
      scriptsValidName,
      scriptsInvalidName,
    });
    const result = spawnPnpmSync({
      args: ["--silent", "run", "lint", "--format=json"],
      cwd: workspaceRoot,
      encoding: "utf8",
      maxBuffer: 50 * 1024 * 1024,
    });
    const diagnostics = parseLintOutput(result).diagnostics;
    for (const { relativePath, rule, label } of probeDefinitions)
      assertProbe(diagnostics, {
        path: path.join(fixtureRoot, relativePath),
        ...(rule === undefined ? {} : { rule }),
        label,
      });
    assertClassifiedProbes(diagnostics, {
      configRoot,
      scriptsRoot,
      scriptsValidName,
      scriptsInvalidName,
      fixtureRoot,
    });
  } finally {
    if (configRoot !== undefined)
      rmSync(configRoot, { recursive: true, force: true });
    rmSync(path.join(scriptsRoot, scriptsValidName), { force: true });
    rmSync(path.join(scriptsRoot, scriptsInvalidName), { force: true });
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
};
