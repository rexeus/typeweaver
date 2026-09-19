import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import process from "node:process";
import ts from "typescript";
import {
  assertLintPolicyConfiguration,
  readLintConfig,
  workspaceRoot,
} from "./lib/lint-policy-contract.mjs";
import { ruleCases } from "./lib/maintainability-fixtures.mjs";
import { spawnPnpmSync } from "./lib/pnpm-command.mjs";

/** @typedef {import("./lib/tooling-types.mjs").PackageManifest} PackageManifest */
/** @typedef {{ code: string, filename: string, message: string, severity: string }} LintDiagnostic */
/** @typedef {{ diagnostics: LintDiagnostic[] }} LintOutput */
/** @typedef {LintOutput & { status: number | null }} LintResult */

/**
 * Authored lint suppressions. Every entry is a deliberate, explained
 * exception; the list is asserted exactly so a suppression cannot be added,
 * removed, or moved without a reviewed contract change.
 *
 * @type {Map<string, string[]>}
 */
const allowedDisableDirectives = new Map([
  [
    "packages/gen/src/helpers/templateEngine.ts",
    ["// oxlint-disable-next-line no-new-func"],
  ],
  [
    "packages/server/__test__/unit/NodeAdapter.test.ts",
    ["/* oxlint-disable import/max-dependencies */"],
  ],
  [
    "packages/server/src/lib/TypeweaverApp.ts",
    ["// oxlint-disable import/max-dependencies"],
  ],
]);

/**
 * @param {string} filePath
 * @returns {PackageManifest}
 */
const readManifest = filePath => JSON.parse(readFileSync(filePath, "utf8"));

/**
 * @returns {string[]}
 */
const manifestPaths = () => {
  const packageRoot = path.join(workspaceRoot, "packages");
  const packageManifests = readdirSync(packageRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => path.join(packageRoot, entry.name, "package.json"))
    .filter(existsSync);
  return [path.join(workspaceRoot, "package.json"), ...packageManifests];
};

/**
 * @param {string} command
 * @returns {boolean}
 */
const invokesEslint = command =>
  /(?:^|[^a-z0-9_-])eslint(?:\.js)?(?:$|[^a-z0-9_-])/iu.test(command);

/**
 * @param {string} manifestPath
 * @returns {PackageManifest}
 */
const assertManifestHasNoEslint = manifestPath => {
  const manifest = readManifest(manifestPath);
  const dependencyGroups = [
    manifest.dependencies,
    manifest.devDependencies,
    manifest.optionalDependencies,
    manifest.peerDependencies,
  ];
  if (
    dependencyGroups.some(
      group =>
        group?.["eslint"] !== undefined ||
        Object.values(group ?? {}).some(specifier =>
          String(specifier).startsWith("npm:eslint@")
        )
    )
  ) {
    throw new Error(`${manifestPath} declares ESLint`);
  }
  if (Object.values(manifest.scripts ?? {}).some(invokesEslint)) {
    throw new Error(`${manifestPath} invokes ESLint`);
  }
  return manifest;
};

/**
 * @returns {string[]}
 */
const trackedFiles = () => {
  const result = spawnSync("git", ["ls-files", "-z"], {
    cwd: workspaceRoot,
    encoding: "utf8",
  });
  if (result.error !== undefined) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(
      `git ls-files failed with exit code ${String(result.status)}`
    );
  }
  return result.stdout.split("\0").filter(Boolean);
};

/**
 * @param {string} file
 * @returns {boolean}
 */
const isAuthoredLintSource = file =>
  /\.[cm]?[jt]sx?$/u.test(file) &&
  !/(?:^|\/)(?:dist|node_modules|output|outputs)(?:\/|$)/u.test(file) &&
  !file.startsWith(".vscode/");

/**
 * @param {string} file
 * @returns {ts.ScriptKind}
 */
const scriptKindFor = file => {
  if (file.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (file.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (file.endsWith(".js")) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
};

/**
 * @param {string} source
 * @param {string} [file]
 * @returns {string[]}
 */
const extractDisableDirectives = (source, file = "fixture.ts") => {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKindFor(file)
  );
  /** @type {Map<string, ts.CommentRange>} */
  const commentRanges = new Map();

  /**
   * @param {readonly ts.CommentRange[] | undefined} ranges
   * @returns {void}
   */
  const rememberRanges = ranges => {
    for (const range of ranges ?? []) {
      commentRanges.set(`${range.pos}:${range.end}`, range);
    }
  };

  /**
   * @param {ts.Node} node
   * @returns {void}
   */
  const visit = node => {
    rememberRanges(ts.getLeadingCommentRanges(source, node.getFullStart()));
    rememberRanges(ts.getTrailingCommentRanges(source, node.getEnd()));
    for (const child of node.getChildren(sourceFile)) {
      visit(child);
    }
  };
  visit(sourceFile);

  return [...commentRanges.values()]
    .sort((left, right) => left.pos - right.pos)
    .map(range => source.slice(range.pos, range.end).trim())
    .filter(comment => /(?:oxlint|eslint)-(?:disable|enable)/u.test(comment));
};

/**
 * @param {string} file
 * @returns {string[]}
 */
const disableDirectives = file =>
  extractDisableDirectives(
    readFileSync(path.join(workspaceRoot, file), "utf8"),
    file
  );

/**
 * @returns {void}
 */
const assertDisableDirectiveScanner = () => {
  const actual = extractDisableDirectives(
    [
      'const literal = "// oxlint-disable no-console";',
      "// oxlint-disable-next-line no-console",
      'const secondLiteral = "/* eslint-disable complexity */";',
      "const value = true; /* eslint-disable-line no-warning-comments */",
    ].join("\n")
  );
  const expected = [
    "// oxlint-disable-next-line no-console",
    "/* eslint-disable-line no-warning-comments */",
  ];
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error("Lint directive scanner does not distinguish comments");
  }
};

/**
 * @param {readonly string[]} files
 * @returns {void}
 */
const assertDisableDirectives = files => {
  assertDisableDirectiveScanner();
  /** @type {[string, string[]][]} */
  const entries = files
    .filter(isAuthoredLintSource)
    .map(file => [file, disableDirectives(file)]);
  const actual = new Map(
    entries.filter(([, directives]) => directives.length > 0)
  );
  if (
    JSON.stringify([...actual]) !==
    JSON.stringify([...allowedDisableDirectives])
  ) {
    throw new Error(
      `Authored lint-disable directives changed.\nExpected: ${JSON.stringify([
        ...allowedDisableDirectives,
      ])}\nActual: ${JSON.stringify([...actual])}`
    );
  }
};

/**
 * @returns {void}
 */
const assertNoEslintRuntime = () => {
  const manifests = manifestPaths().map(assertManifestHasNoEslint);
  const [rootManifest] = manifests;
  if (rootManifest === undefined) {
    throw new Error("The root package manifest is missing");
  }
  if (rootManifest.scripts?.["lint"] !== "oxlint . --deny-warnings") {
    throw new Error("The root lint script must remain the single Oxlint gate");
  }

  const virtualStore = path.join(workspaceRoot, "node_modules", ".pnpm");
  const installedEslint = existsSync(virtualStore)
    ? readdirSync(virtualStore).find(entry => entry.startsWith("eslint@"))
    : undefined;
  if (
    installedEslint !== undefined ||
    existsSync(path.join(workspaceRoot, "node_modules", "eslint"))
  ) {
    throw new Error("ESLint must not be installed");
  }

  const lockfile = readFileSync(
    path.join(workspaceRoot, "pnpm-lock.yaml"),
    "utf8"
  );
  if (/^ {2}eslint@[^:]+:/mu.test(lockfile)) {
    throw new Error("The pnpm lockfile resolves the ESLint package");
  }

  const repositoryFiles = trackedFiles();
  const eslintConfig = repositoryFiles.find(file =>
    /(?:^|\/)(?:eslint\.config\.[^.]+|\.eslintrc(?:\..+)?)$/u.test(file)
  );
  if (eslintConfig !== undefined) {
    throw new Error(`ESLint config is forbidden: ${eslintConfig}`);
  }

  const npmrc = readFileSync(path.join(workspaceRoot, ".npmrc"), "utf8");
  if (!/^auto-install-peers=false$/mu.test(npmrc)) {
    throw new Error("pnpm must not auto-install the SonarJS ESLint peer");
  }
  assertDisableDirectives(repositoryFiles);
};

/**
 * @returns {void}
 */
const assertRootConfiguration = () => {
  assertLintPolicyConfiguration();
  const config = readLintConfig();
  for (const ruleCase of ruleCases) {
    if (
      JSON.stringify(config.rules[ruleCase.rule]) !==
      JSON.stringify(ruleCase.options)
    ) {
      throw new Error(
        `${ruleCase.rule} does not match its verified configuration`
      );
    }
  }
};

/**
 * @param {import("node:child_process").SpawnSyncReturns<string>} result
 * @returns {LintOutput}
 */
const parseLintOutput = result => {
  if (result.error !== undefined) {
    throw result.error;
  }
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(
      `pnpm lint did not return JSON\n${result.stdout}\n${result.stderr}`,
      { cause: error }
    );
  }
};

/**
 * @returns {LintResult}
 */
const runRootLint = () => {
  const result = spawnPnpmSync({
    args: ["--silent", "run", "lint", "--format=json"],
    cwd: workspaceRoot,
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
  });
  return { ...parseLintOutput(result), status: result.status };
};

/**
 * @param {string} directory
 * @param {"valid" | "invalid"} kind
 * @returns {void}
 */
const writeFixtures = (directory, kind) => {
  for (const ruleCase of ruleCases) {
    writeFileSync(
      path.join(directory, `${ruleCase.name}.ts`),
      `${ruleCase[kind]}\n`
    );
  }
};

/**
 * @param {LintOutput} lintResult
 * @param {string} fixtureRoot
 * @returns {LintDiagnostic[]}
 */
const fixtureDiagnostics = (lintResult, fixtureRoot) =>
  lintResult.diagnostics.filter(diagnostic => {
    const absolutePath = path.resolve(workspaceRoot, diagnostic.filename);
    return absolutePath.startsWith(`${fixtureRoot}${path.sep}`);
  });

/**
 * @param {LintOutput} result
 * @param {string} fixtureRoot
 * @returns {void}
 */
const assertValidFixtures = (result, fixtureRoot) => {
  const diagnostics = fixtureDiagnostics(result, fixtureRoot);
  if (diagnostics.length > 0) {
    throw new Error(
      `Valid maintainability fixtures failed:\n${JSON.stringify(
        diagnostics,
        null,
        2
      )}`
    );
  }
};

/**
 * @param {LintResult} result
 * @param {string} fixtureRoot
 * @returns {void}
 */
const assertInvalidFixtures = (result, fixtureRoot) => {
  const diagnostics = fixtureDiagnostics(result, fixtureRoot);
  const actual = diagnostics
    .map(diagnostic => [
      path.basename(diagnostic.filename, ".ts"),
      diagnostic.code,
    ])
    .sort();
  const expected = ruleCases
    .map(ruleCase => [ruleCase.name, ruleCase.diagnostic])
    .sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Maintainability mutations did not produce the exact rule matrix.\nExpected: ${JSON.stringify(
        expected
      )}\nActual: ${JSON.stringify(actual)}`
    );
  }
  if (result.status === 0) {
    throw new Error("pnpm lint accepted the invalid maintainability fixtures");
  }
};

assertRootConfiguration();
assertNoEslintRuntime();

const fixtureRoot = mkdtempSync(
  path.join(workspaceRoot, "scripts", ".maintainability-run-")
);
/** @type {LintResult | undefined} */
let validResult;
try {
  writeFixtures(fixtureRoot, "valid");
  validResult = runRootLint();
  assertValidFixtures(validResult, fixtureRoot);

  writeFixtures(fixtureRoot, "invalid");
  const invalidResult = runRootLint();
  assertInvalidFixtures(invalidResult, fixtureRoot);
} finally {
  rmSync(fixtureRoot, { recursive: true, force: true });
}

if (validResult === undefined) {
  throw new Error("The maintainability fixture run did not produce a result");
}
if (validResult.status !== 0) {
  throw new Error(
    "The maintainability mutations passed, but the authored repository still fails pnpm lint"
  );
}

process.stdout.write(
  `Verified ${ruleCases.length} maintainability rules through pnpm lint without ESLint\n`
);
