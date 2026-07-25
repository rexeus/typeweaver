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
import { fileURLToPath } from "node:url";
import ts from "typescript";

const workspaceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const pnpmCli = process.env.npm_execpath;
if (pnpmCli === undefined) {
  throw new Error("Run this check through `pnpm test:maintainability-lint`.");
}

const switchComplexity = caseCount =>
  [
    "function switchComplexity(value) {",
    "  switch (value) {",
    ...Array.from({ length: caseCount }, (_, index) => `    case ${index}:`),
    "      return true;",
    "    default:",
    "      return false;",
    "  }",
    "}",
  ].join("\n");

const nestedIfs = depth => {
  const opening = Array.from(
    { length: depth },
    (_, index) => `${"  ".repeat(index + 1)}if (values[${index}]) {`
  );
  const closing = Array.from(
    { length: depth },
    (_, index) => `${"  ".repeat(depth - index)}}`
  );
  return [
    "function nested(values) {",
    ...opening,
    `${"  ".repeat(depth + 1)}return true;`,
    ...closing,
    "  return false;",
    "}",
  ].join("\n");
};

const functionLines = valueLines =>
  [
    "function lines() {",
    "",
    "  // Blank and comment-only lines must not count.",
    "  /* This comment-only line must not count either. */",
    "  return [",
    ...Array.from({ length: valueLines }, () => "    0,"),
    "  ];",
    "}",
  ].join("\n");

const nestedCallbacks = depth => {
  let body = "return value;";
  for (let index = 0; index < depth; index += 1) {
    body = `run(() => { ${body} });`;
  }
  return `function callbacks(run, value) { ${body} }`;
};

const statements = count =>
  [
    "function statements(value) {",
    ...Array.from({ length: count }, (_, index) => `  value(${index});`),
    "}",
  ].join("\n");

const cognitiveComplexity = withElse => {
  const flatConditions = Array.from({ length: 5 }, (_, index) => {
    const condition = `  if (values[${index + 4}]) { consume(); }`;
    return withElse && index === 4
      ? `${condition} else { consume(); }`
      : condition;
  });
  return [
    "function cognitive(values, consume) {",
    "  if (values[0]) {",
    "    if (values[1]) {",
    "      if (values[2]) {",
    "        if (values[3]) {",
    "          consume();",
    "        }",
    "      }",
    "    }",
    "  }",
    ...flatConditions,
    "}",
  ].join("\n");
};

const logicalChain = (start, operatorCount) =>
  Array.from(
    { length: operatorCount + 1 },
    (_, index) => `values[${start + index}]`
  ).join(" && ");

const expressionComplexity = secondOperatorCount =>
  [
    `function firstExpression(values) { return ${logicalChain(0, 6)}; }`,
    `function secondExpression(values) { return ${logicalChain(
      7,
      secondOperatorCount
    )}; }`,
  ].join("\n");

const ruleCases = [
  {
    name: "complexity",
    rule: "eslint/complexity",
    diagnostic: "eslint(complexity)",
    options: ["error", { max: 10, variant: "classic" }],
    valid: switchComplexity(9),
    invalid: switchComplexity(10),
  },
  {
    name: "max-depth",
    rule: "eslint/max-depth",
    diagnostic: "eslint(max-depth)",
    options: ["error", { max: 4 }],
    valid: nestedIfs(4),
    invalid: nestedIfs(5),
  },
  {
    name: "max-lines-per-function",
    rule: "eslint/max-lines-per-function",
    diagnostic: "eslint(max-lines-per-function)",
    options: ["error", { max: 100, skipBlankLines: true, skipComments: true }],
    valid: functionLines(96),
    invalid: functionLines(97),
  },
  {
    name: "max-nested-callbacks",
    rule: "eslint/max-nested-callbacks",
    diagnostic: "eslint(max-nested-callbacks)",
    options: ["error", { max: 4 }],
    valid: nestedCallbacks(4),
    invalid: nestedCallbacks(5),
  },
  {
    name: "max-params",
    rule: "eslint/max-params",
    diagnostic: "eslint(max-params)",
    options: ["error", { max: 4, countThis: "except-void" }],
    valid:
      "function parameters(this: void, a, b, c, d) { return [a, b, c, d]; }",
    invalid:
      "function parameters(this: unknown, a, b, c, d) { return [a, b, c, d]; }",
  },
  {
    name: "max-statements",
    rule: "eslint/max-statements",
    diagnostic: "eslint(max-statements)",
    options: ["error", { max: 40 }],
    valid: statements(40),
    invalid: statements(41),
  },
  {
    name: "cognitive-complexity",
    rule: "sonarjs/cognitive-complexity",
    diagnostic: "sonarjs(cognitive-complexity)",
    options: ["error", 15],
    valid: cognitiveComplexity(false),
    invalid: cognitiveComplexity(true),
  },
  {
    name: "expression-complexity",
    rule: "sonarjs/expression-complexity",
    diagnostic: "sonarjs(expression-complexity)",
    options: ["error", { max: 6 }],
    valid: expressionComplexity(6),
    invalid: expressionComplexity(7),
  },
  {
    name: "no-nested-switch",
    rule: "sonarjs/no-nested-switch",
    diagnostic: "sonarjs(no-nested-switch)",
    options: "error",
    valid:
      "function switches(a, b) { switch (a) { case 1: return true; } switch (b) { case 2: return true; } return false; }",
    invalid:
      "function nestedSwitch(a, b) { switch (a) { case 1: switch (b) { case 2: return true; } } return false; }",
  },
];

const readJson = filePath => JSON.parse(readFileSync(filePath, "utf8"));

const allowedIgnorePatterns = [
  "**/dist/**",
  "**/node_modules/**",
  ".vscode/**",
  "**/output/**",
  "**/outputs/**",
];

const allowedDisableDirectives = new Map([
  ["packages/cli/src/cli.ts", ["// eslint-disable-next-line no-console"]],
  [
    "packages/cli/src/cliLogger.ts",
    Array.from({ length: 7 }, () => "// eslint-disable-next-line no-console"),
  ],
  [
    "packages/core/src/index.ts",
    ["/* oxlint-disable import/max-dependencies */"],
  ],
  [
    "packages/server/__test__/unit/NodeAdapter.test.ts",
    ["/* oxlint-disable import/max-dependencies */"],
  ],
  [
    "packages/server/src/lib/TypeweaverApp.ts",
    ["// oxlint-disable import/max-dependencies"],
  ],
  [
    "packages/server/src/lib/index.ts",
    ["/* oxlint-disable import/max-dependencies */"],
  ],
  [
    "packages/test-utils/src/data/index.ts",
    ["/* oxlint-disable import/max-dependencies */"],
  ],
  [
    "packages/test-utils/src/data/todo/index.ts",
    ["/* oxlint-disable import/max-dependencies */"],
  ],
  [
    "packages/test-utils/src/test-project/spec/shared/index.ts",
    ["/* oxlint-disable import/max-dependencies */"],
  ],
  [
    "packages/test-utils/src/test-project/spec/todo/index.ts",
    ["/* oxlint-disable import/max-dependencies */"],
  ],
]);

const assertRootConfiguration = () => {
  const config = readJson(path.join(workspaceRoot, ".oxlintrc.json"));
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
  if (!config.jsPlugins?.includes("eslint-plugin-sonarjs")) {
    throw new Error("The root config does not load the SonarJS Oxlint plugin");
  }
  if (
    JSON.stringify(config.ignorePatterns) !==
    JSON.stringify(allowedIgnorePatterns)
  ) {
    throw new Error("The Oxlint ignore patterns changed from the audited set");
  }
  if (
    config.overrides !== undefined &&
    JSON.stringify(config.overrides) !== "[]"
  ) {
    throw new Error("Oxlint overrides may not weaken the root rule contract");
  }
};

const manifestPaths = () => {
  const packageRoot = path.join(workspaceRoot, "packages");
  const packageManifests = readdirSync(packageRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => path.join(packageRoot, entry.name, "package.json"))
    .filter(existsSync);
  return [path.join(workspaceRoot, "package.json"), ...packageManifests];
};

const invokesEslint = command =>
  /(?:^|[^a-z0-9_-])eslint(?:\.js)?(?:$|[^a-z0-9_-])/iu.test(command);

const assertManifestHasNoEslint = manifestPath => {
  const manifest = readJson(manifestPath);
  const dependencyGroups = [
    manifest.dependencies,
    manifest.devDependencies,
    manifest.optionalDependencies,
    manifest.peerDependencies,
  ];
  if (
    dependencyGroups.some(
      group =>
        group?.eslint !== undefined ||
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

const isAuthoredLintSource = file =>
  /\.[cm]?[jt]sx?$/u.test(file) &&
  !/(?:^|\/)(?:dist|node_modules|output|outputs)(?:\/|$)/u.test(file) &&
  !file.startsWith(".vscode/");

const scriptKindFor = file => {
  if (file.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (file.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (file.endsWith(".js")) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
};

const extractDisableDirectives = (source, file = "fixture.ts") => {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKindFor(file)
  );
  const commentRanges = new Map();

  const rememberRanges = ranges => {
    for (const range of ranges ?? []) {
      commentRanges.set(`${range.pos}:${range.end}`, range);
    }
  };

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

const disableDirectives = file =>
  extractDisableDirectives(
    readFileSync(path.join(workspaceRoot, file), "utf8"),
    file
  );

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

const assertDisableDirectives = files => {
  assertDisableDirectiveScanner();
  const actual = new Map(
    files
      .filter(isAuthoredLintSource)
      .map(file => [file, disableDirectives(file)])
      .filter(([, directives]) => directives.length > 0)
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

const assertNoEslintRuntime = () => {
  const manifests = manifestPaths().map(assertManifestHasNoEslint);
  if (manifests[0].scripts?.lint !== "oxlint .") {
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

const runRootLint = () => {
  const result = spawnSync(
    process.execPath,
    [pnpmCli, "--silent", "run", "lint", "--format=json"],
    {
      cwd: workspaceRoot,
      encoding: "utf8",
      maxBuffer: 50 * 1024 * 1024,
    }
  );
  return { ...parseLintOutput(result), status: result.status };
};

const writeFixtures = (directory, kind) => {
  for (const ruleCase of ruleCases) {
    writeFileSync(
      path.join(directory, `${ruleCase.name}.ts`),
      `${ruleCase[kind]}\n`
    );
  }
};

const fixtureDiagnostics = (lintResult, fixtureRoot) =>
  lintResult.diagnostics.filter(diagnostic => {
    const absolutePath = path.resolve(workspaceRoot, diagnostic.filename);
    return absolutePath.startsWith(`${fixtureRoot}${path.sep}`);
  });

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

if (validResult.status !== 0) {
  throw new Error(
    "The maintainability mutations passed, but the authored repository still fails pnpm lint"
  );
}

process.stdout.write(
  `Verified ${ruleCases.length} maintainability rules through pnpm lint without ESLint\n`
);
