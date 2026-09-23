import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import {
  assertLintPolicyConfiguration,
  expectedIgnorePatterns,
  readLintConfig,
  workspaceRoot,
} from "./lint-policy-contract.mjs";
import { ruleCases } from "./maintainability-fixtures.mjs";

/** @typedef {import("./tooling-types.mjs").PackageManifest} PackageManifest */

const allowedDisableDirectives = new Map([
  [
    "packages/gen/src/helpers/templateEngine.ts",
    ["// oxlint-disable-next-line no-new-func"],
  ],
  [
    "packages/server/src/lib/TypeweaverApp.ts",
    ["// oxlint-disable import/max-dependencies"],
  ],
]);

/** @param {string} filePath @returns {PackageManifest} */
const readManifest = filePath => JSON.parse(readFileSync(filePath, "utf8"));
/** @returns {string[]} */
const manifestPaths = () => {
  const packageRoot = path.join(workspaceRoot, "packages");
  return [
    path.join(workspaceRoot, "package.json"),
    ...readdirSync(packageRoot, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => path.join(packageRoot, entry.name, "package.json"))
      .filter(existsSync),
  ];
};
/** @param {unknown} command @returns {boolean} */
const invokesEslint = command =>
  /(?:^|[^a-z0-9_-])eslint(?:\.js)?(?:$|[^a-z0-9_-])/iu.test(String(command));
/** @param {string} manifestPath @returns {PackageManifest} */
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
  )
    throw new Error(`${manifestPath} declares ESLint`);
  if (Object.values(manifest.scripts ?? {}).some(invokesEslint))
    throw new Error(`${manifestPath} invokes ESLint`);
  return manifest;
};
/** @returns {string[]} */
const trackedFiles = () => {
  const result = spawnSync("git", ["ls-files", "-z"], {
    cwd: workspaceRoot,
    encoding: "utf8",
  });
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0)
    throw new Error(
      `git ls-files failed with exit code ${String(result.status)}`
    );
  return result.stdout.split("\0").filter(Boolean);
};
/** @returns {{ deleted: ReadonlySet<string>, changed: readonly string[] }} */
const worktreeStatus = () => {
  const result = spawnSync(
    "git",
    ["status", "--porcelain=v1", "-z", "--untracked-files=all"],
    { cwd: workspaceRoot, encoding: "utf8" }
  );
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0)
    throw new Error(
      `git status failed with exit code ${String(result.status)}`
    );
  const deleted = new Set();
  const changed = [];
  for (const entry of result.stdout.split("\0").filter(Boolean)) {
    const status = entry.slice(0, 2);
    const file = entry.slice(3);
    if (status.includes("D")) deleted.add(file);
    else changed.push(file);
  }
  return { deleted, changed };
};
/** @returns {string[]} */
const repositoryFiles = () => {
  const { changed, deleted } = worktreeStatus();
  return [...new Set([...trackedFiles(), ...changed])].filter(
    file => !deleted.has(file)
  );
};
/**
 * Translates an Oxlint `ignorePatterns` glob into an anchored expression so
 * the suppression scanner skips exactly the paths the linter ignores.
 *
 * @param {string} pattern
 * @returns {RegExp}
 */
const ignorePatternExpression = pattern => {
  const source = pattern
    .split(/(\*\*\/|\*\*|\*)/u)
    .map(part => {
      if (part === "**/") return "(?:.*/)?";
      if (part === "**") return ".*";
      if (part === "*") return "[^/]*";
      return part.replace(/[.+?^${}()|[\]\\]/gu, "\\$&");
    })
    .join("");
  return new RegExp(`^${source}$`, "u");
};
const lintIgnoredPaths = expectedIgnorePatterns.map(ignorePatternExpression);
/** @param {string} file @returns {boolean} */
const isAuthoredLintSource = file =>
  /\.[cm]?[jt]sx?$/u.test(file) &&
  !lintIgnoredPaths.some(expression => expression.test(file));
/** @type {readonly (readonly [string, boolean])[]} */
const scannerClassificationProbes = [
  ["packages/gen/dist/index.js", false],
  ["node_modules/pkg/index.js", false],
  [".vscode/settings.ts", false],
  ["packages/test-utils/src/test-project/output/lib/server/Router.ts", false],
  ["packages/cli/test/outputs/all/index.ts", false],
  ["packages/gen/src/output/writer.ts", true],
  ["packages/cli/src/outputs/writer.ts", true],
  ["packages/cli/test/nested/outputs/writer.ts", true],
];
/** @returns {void} */
const assertScannerMatchesIgnorePatterns = () => {
  const mismatches = scannerClassificationProbes.filter(
    ([file, scanned]) => isAuthoredLintSource(file) !== scanned
  );
  if (mismatches.length > 0)
    throw new Error(
      `Suppression scanner disagrees with the lint ignorePatterns: ${JSON.stringify(mismatches)}`
    );
};
/** @param {string} file @returns {ts.ScriptKind} */
const scriptKindFor = file =>
  file.endsWith(".tsx")
    ? ts.ScriptKind.TSX
    : file.endsWith(".jsx")
      ? ts.ScriptKind.JSX
      : file.endsWith(".js")
        ? ts.ScriptKind.JS
        : ts.ScriptKind.TS;
/** @param {string} source @param {string} [file] @returns {string[]} */
const extractDisableDirectives = (source, file = "fixture.ts") => {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKindFor(file)
  );
  const ranges = new Map();
  /** @param {readonly ts.CommentRange[] | undefined} values @returns {void} */
  const remember = values => {
    for (const range of values ?? [])
      ranges.set(`${range.pos}:${range.end}`, range);
  };
  /** @param {ts.Node} node @returns {void} */
  const visit = node => {
    remember(ts.getLeadingCommentRanges(source, node.getFullStart()));
    remember(ts.getTrailingCommentRanges(source, node.getEnd()));
    for (const child of node.getChildren(sourceFile)) visit(child);
  };
  visit(sourceFile);
  return [...ranges.values()]
    .sort((left, right) => left.pos - right.pos)
    .map(range => source.slice(range.pos, range.end).trim())
    .filter(comment => /(?:oxlint|eslint)-(?:disable|enable)/u.test(comment));
};
/** @param {string} file @returns {string[]} */
const disableDirectives = file =>
  extractDisableDirectives(
    readFileSync(path.join(workspaceRoot, file), "utf8"),
    file
  );

/** @param {readonly string[]} files @returns {void} */
const assertDisableDirectives = files => {
  assertScannerMatchesIgnorePatterns();
  const scannerInput = [
    'const literal = "// oxlint-disable no-console";',
    "// oxlint-disable-next-line no-console",
    'const secondLiteral = "/* eslint-disable complexity */";',
    "const value = true; /* eslint-disable-line no-warning-comments */",
  ].join("\n");
  const scanned = extractDisableDirectives(scannerInput);
  const expected = [
    "// oxlint-disable-next-line no-console",
    "/* eslint-disable-line no-warning-comments */",
  ];
  if (JSON.stringify(scanned) !== JSON.stringify(expected))
    throw new Error("Lint directive scanner does not distinguish comments");
  const entries = files
    .filter(isAuthoredLintSource)
    .map(file => /** @type {[string, string[]]} */ ([
      file,
      disableDirectives(file),
    ]));
  const actual = new Map(
    entries.filter(([, directives]) => directives.length > 0)
  );
  if (
    JSON.stringify([...actual]) !==
    JSON.stringify([...allowedDisableDirectives])
  )
    throw new Error(
      `Authored lint-disable directives changed.\nExpected: ${JSON.stringify([...allowedDisableDirectives])}\nActual: ${JSON.stringify([...actual])}`
    );
};

export const assertNoEslintRuntime = () => {
  const manifests = manifestPaths().map(assertManifestHasNoEslint);
  const [rootManifest] = manifests;
  if (rootManifest === undefined)
    throw new Error("The root package manifest is missing");
  if (rootManifest.scripts?.["lint"] !== "oxlint . --deny-warnings")
    throw new Error("The root lint script must remain the single Oxlint gate");
  const virtualStore = path.join(workspaceRoot, "node_modules", ".pnpm");
  if (
    (existsSync(virtualStore) &&
      readdirSync(virtualStore).some(entry => entry.startsWith("eslint@"))) ||
    existsSync(path.join(workspaceRoot, "node_modules", "eslint"))
  )
    throw new Error("ESLint must not be installed");
  const lockfile = readFileSync(
    path.join(workspaceRoot, "pnpm-lock.yaml"),
    "utf8"
  );
  if (/^ {2}eslint@[^:]+:/mu.test(lockfile))
    throw new Error("The pnpm lockfile resolves the ESLint package");
  const files = repositoryFiles();
  const eslintConfig = files.find(file =>
    /(?:^|\/)(?:eslint\.config\.[^.]+|\.eslintrc(?:\..+)?)$/u.test(file)
  );
  if (eslintConfig !== undefined)
    throw new Error(`ESLint config is forbidden: ${eslintConfig}`);
  if (
    !/^auto-install-peers=false$/mu.test(
      readFileSync(path.join(workspaceRoot, ".npmrc"), "utf8")
    )
  )
    throw new Error("pnpm must not auto-install the SonarJS ESLint peer");
  assertDisableDirectives(files);
};

export const assertRootConfiguration = () => {
  assertLintPolicyConfiguration();
  const config = readLintConfig();
  for (const ruleCase of ruleCases) {
    if (
      JSON.stringify(config.rules[ruleCase.rule]) !==
      JSON.stringify(ruleCase.options)
    )
      throw new Error(
        `${ruleCase.rule} does not match its verified configuration`
      );
  }
};
