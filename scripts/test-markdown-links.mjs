import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const workspaceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const checkerPath = path.join(
  workspaceRoot,
  "scripts/check-markdown-links.mjs"
);
const brokenLink = "[missing](./not-present.md)\n";

const tempRoot = mkdtempSync(path.join(tmpdir(), "typeweaver-markdown-links-"));
const fixtureRoot = path.join(tempRoot, "repository");
const gitConfigRoot = path.join(tempRoot, "git-config");

// A hermetic Git environment keeps an inherited GIT_DIR, work tree, index, or
// user/system configuration from leaking into the fixture repository or into
// the checker's own `git ls-files` call.
const gitEnvironment = () => {
  const environment = { ...process.env };
  for (const name of [
    "GIT_DIR",
    "GIT_WORK_TREE",
    "GIT_INDEX_FILE",
    "GIT_OBJECT_DIRECTORY",
    "GIT_ALTERNATE_OBJECT_DIRECTORIES",
    "GIT_COMMON_DIR",
  ]) {
    delete environment[name];
  }
  environment.HOME = gitConfigRoot;
  environment.USERPROFILE = gitConfigRoot;
  environment.XDG_CONFIG_HOME = gitConfigRoot;
  environment.GIT_CONFIG_NOSYSTEM = "1";
  environment.GIT_CONFIG_GLOBAL = path.join(gitConfigRoot, "global.gitconfig");
  environment.GIT_CONFIG_SYSTEM = path.join(gitConfigRoot, "system.gitconfig");
  return environment;
};

const runGit = args => {
  const result = spawnSync("git", args, {
    cwd: fixtureRoot,
    encoding: "utf8",
    env: gitEnvironment(),
  });
  if (result.error !== undefined || result.status !== 0) {
    throw new Error(
      [
        `git ${args.join(" ")} failed with status ${String(result.status)}`,
        result.error?.message,
        result.stdout,
        result.stderr,
      ]
        .filter(Boolean)
        .join("\n")
    );
  }
};

const spawnChecker = arguments_ =>
  spawnSync(process.execPath, [checkerPath, ...arguments_], {
    cwd: workspaceRoot,
    encoding: "utf8",
    env: gitEnvironment(),
  });

const assertCheckerRejectsRepository = ({
  label,
  expectedDiagnostics,
  expectedMessages = [],
  forbiddenDiagnostics = [],
  repositoryRoot,
}) => {
  const result = spawnChecker(["--repository-root", repositoryRoot]);
  const diagnostics = result.stderr ?? "";
  const missingDiagnostics = [
    ...expectedDiagnostics,
    ...expectedMessages,
  ].filter(diagnostic => !diagnostics.includes(diagnostic));
  const leakedDiagnostics = forbiddenDiagnostics.filter(diagnostic =>
    diagnostics.includes(diagnostic)
  );
  if (
    result.status !== 1 ||
    missingDiagnostics.length > 0 ||
    leakedDiagnostics.length > 0
  ) {
    throw new Error(
      [
        `${label} did not reject every fixture (status ${String(result.status)})`,
        ...missingDiagnostics.map(
          diagnostic => `Missing diagnostic: ${diagnostic}`
        ),
        ...leakedDiagnostics.map(
          diagnostic => `Unexpected diagnostic: ${diagnostic}`
        ),
        result.error?.message,
        result.stdout,
        diagnostics,
      ]
        .filter(Boolean)
        .join("\n")
    );
  }
};

const assertCheckerRejectsArguments = arguments_ => {
  const result = spawnChecker(arguments_);
  if (result.status === 0) {
    throw new Error(
      `checker accepted invalid arguments: ${arguments_.join(" ")}`
    );
  }
};

try {
  mkdirSync(fixtureRoot);
  mkdirSync(gitConfigRoot);
  writeFileSync(path.join(gitConfigRoot, "global.gitconfig"), "", "utf8");
  writeFileSync(path.join(gitConfigRoot, "system.gitconfig"), "", "utf8");
  runGit(["init", "--quiet"]);
  mkdirSync(path.join(fixtureRoot, "nested"));
  writeFileSync(path.join(fixtureRoot, "root.md"), brokenLink, "utf8");
  writeFileSync(
    path.join(fixtureRoot, "nested", "broken.md"),
    brokenLink,
    "utf8"
  );

  // Both escaping links point at an existing file outside fixtureRoot, so only
  // the containment check can reject them.
  writeFileSync(path.join(tempRoot, "outside.md"), "# Outside\n", "utf8");
  writeFileSync(
    path.join(fixtureRoot, "escaping-relative.md"),
    "[outside](../outside.md)\n",
    "utf8"
  );
  writeFileSync(
    path.join(fixtureRoot, "escaping-rooted.md"),
    "[outside](/../outside.md)\n",
    "utf8"
  );
  // Drive-qualified paths are local absolute paths even though they look like a
  // URI scheme; both Windows separators must be rejected.
  writeFileSync(
    path.join(fixtureRoot, "escaping-drive-backslash.md"),
    "[drive](C:\\outside.md)\n",
    "utf8"
  );
  writeFileSync(
    path.join(fixtureRoot, "escaping-drive-forward.md"),
    "[drive](D:/outside.md)\n",
    "utf8"
  );
  writeFileSync(
    path.join(fixtureRoot, "nested", "present.md"),
    "# Present\n",
    "utf8"
  );
  writeFileSync(
    path.join(fixtureRoot, "rooted-valid.md"),
    "[present](/nested/present.md)\n",
    "utf8"
  );

  const expectedDiagnostics = [
    "root.md",
    "nested/broken.md",
    "escaping-relative.md",
    "escaping-rooted.md",
    "escaping-drive-backslash.md",
    "escaping-drive-forward.md",
  ];
  const expectedMessages = ["outside the repository root"];
  const forbiddenDiagnostics = ["rooted-valid.md"];
  assertCheckerRejectsRepository({
    label: "Untracked discovery",
    expectedDiagnostics,
    expectedMessages,
    forbiddenDiagnostics,
    repositoryRoot: fixtureRoot,
  });
  runGit(["add", "--all"]);
  assertCheckerRejectsRepository({
    label: "Tracked discovery",
    expectedDiagnostics,
    expectedMessages,
    forbiddenDiagnostics,
    repositoryRoot: fixtureRoot,
  });
  assertCheckerRejectsArguments(["--repository-root", "relative/path"]);
  assertCheckerRejectsArguments(["--repository-root", "/does/not/exist"]);
  assertCheckerRejectsArguments(["--unknown-flag"]);
} finally {
  rmSync(tempRoot, { force: true, maxRetries: 3, recursive: true });
}

// No argument and no ambient override: this is the ordinary workspace check
// that `pnpm docs:check` depends on.
execFileSync(process.execPath, [checkerPath], {
  cwd: workspaceRoot,
  stdio: "inherit",
});

process.stdout.write("Markdown link checker self-test passed\n");
