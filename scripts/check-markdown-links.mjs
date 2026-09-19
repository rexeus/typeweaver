import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const defaultRepositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const usage =
  "Usage: node scripts/check-markdown-links.mjs [--repository-root <path>]";

/**
 * @param {string} message
 * @returns {never}
 */
const fail = message => {
  process.stderr.write(`${message}\n${usage}\n`);
  process.exit(2);
};

// `--repository-root` is an explicit private test seam. It is never read from
// ambient state, so an ordinary invocation always validates the workspace that
// contains this script.
/**
 * @param {readonly string[]} arguments_
 * @returns {string | undefined}
 */
const parseRepositoryRoot = arguments_ => {
  let repositoryRoot;
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument !== "--repository-root") {
      fail(`unexpected argument: ${argument}`);
    }
    const value = arguments_[index + 1];
    if (value === undefined || value.startsWith("--")) {
      fail("--repository-root requires a path");
    }
    if (repositoryRoot !== undefined) {
      fail("--repository-root may be provided only once");
    }
    repositoryRoot = value;
    index += 1;
  }
  return repositoryRoot;
};

/**
 * @param {string} value
 * @returns {string}
 */
const resolveRepositoryRoot = value => {
  if (!path.isAbsolute(value)) {
    fail(`--repository-root must be an absolute path: ${value}`);
  }
  const resolved = path.resolve(value);
  if (statSync(resolved, { throwIfNoEntry: false })?.isDirectory() !== true) {
    fail(`--repository-root is not a directory: ${value}`);
  }
  return resolved;
};

const repositoryRootArgument = parseRepositoryRoot(process.argv.slice(2));
const repositoryRoot =
  repositoryRootArgument === undefined
    ? defaultRepositoryRoot
    : resolveRepositoryRoot(repositoryRootArgument);

// `--cached --others --exclude-standard` covers tracked plus untracked,
// non-ignored files. The glob pathspec matches `.md` at any depth; `**/` also
// matches zero directories, so repository-root Markdown is included.
const markdownFiles = execFileSync(
  "git",
  [
    "ls-files",
    "-z",
    "--cached",
    "--others",
    "--exclude-standard",
    "--",
    ":(top,glob)**/*.md",
  ],
  {
    cwd: repositoryRoot,
  }
)
  .toString("utf8")
  .split("\0")
  .filter(Boolean);
// Containment is lexical (`path.resolve` semantics), so it is deterministic and
// cross-platform. On Windows, `path.relative` returns an absolute path when the
// two paths are on different drives, which the `path.isAbsolute` guard treats as
// outside the repository.
/**
 * @param {string} root
 * @param {string} candidate
 * @returns {boolean}
 */
const isWithinRepository = (root, candidate) => {
  const relative = path.relative(root, candidate);
  return (
    relative === "" ||
    (!path.isAbsolute(relative) &&
      relative !== ".." &&
      !relative.startsWith(`..${path.sep}`))
  );
};

const broken = [];
const linkPattern = /!?\[[^\]]*\]\(([^)\n]+)\)/g;

for (const markdownFile of markdownFiles) {
  const content = readFileSync(path.join(repositoryRoot, markdownFile), "utf8");
  for (const match of content.matchAll(linkPattern)) {
    let target = match[1]?.trim() ?? "";
    if (target.startsWith("<") && target.endsWith(">")) {
      target = target.slice(1, -1);
    }
    target = target.replace(/\s+(?:"[^"]*"|'[^']*')$/, "");
    if (target === "" || target.startsWith("#")) {
      continue;
    }
    // A drive-qualified Windows path (`C:\...` or `D:/...`) is a local absolute
    // path, not a URI scheme. Repository docs must not reference
    // machine-specific drives.
    if (/^[a-z]:[\\/]/i.test(target)) {
      const line = content.slice(0, match.index).split("\n").length;
      broken.push(
        `${markdownFile}:${line} -> ${target} (outside the repository root)`
      );
      continue;
    }
    if (/^[a-z][a-z+.-]*:/i.test(target)) {
      continue;
    }

    const fileTarget = decodeURIComponent(target.split("#", 1)[0] ?? "");
    const resolved = fileTarget.startsWith("/")
      ? path.join(repositoryRoot, fileTarget.replace(/^\/+/, ""))
      : path.resolve(
          path.dirname(path.join(repositoryRoot, markdownFile)),
          fileTarget
        );
    const line = content.slice(0, match.index).split("\n").length;
    if (!isWithinRepository(repositoryRoot, resolved)) {
      broken.push(
        `${markdownFile}:${line} -> ${target} (outside the repository root)`
      );
      continue;
    }
    if (!existsSync(resolved)) {
      broken.push(`${markdownFile}:${line} -> ${target}`);
    }
  }
}

if (broken.length > 0) {
  process.stderr.write(`Broken local Markdown links:\n${broken.join("\n")}\n`);
  process.exit(1);
}

process.stdout.write(
  `Local Markdown links verified across ${markdownFiles.length} repository files\n`
);
