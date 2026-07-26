import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const workspaceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const testProjectRoot = path.join(
  workspaceRoot,
  "packages",
  "test-utils",
  "src",
  "test-project"
);
const expectedOutputRoot = path.join(testProjectRoot, "output");
const cliEntry = path.join(
  workspaceRoot,
  "packages",
  "cli",
  "dist",
  "entry.mjs"
);

const collectFilePaths = root => {
  const pending = [""];
  const files = [];
  while (pending.length > 0) {
    const relativeDirectory = pending.pop();
    const absoluteDirectory = path.join(root, relativeDirectory);
    for (const entry of readdirSync(absoluteDirectory, {
      withFileTypes: true,
    })) {
      const relativePath = path.join(relativeDirectory, entry.name);
      if (entry.isDirectory()) {
        pending.push(relativePath);
      } else if (entry.isFile()) {
        files.push(relativePath);
      } else {
        throw new Error(`unsupported generated fixture entry: ${relativePath}`);
      }
    }
  }
  return files.sort();
};

const fileHash = filePath =>
  createHash("sha256").update(readFileSync(filePath)).digest("hex");

const compareTrees = (expectedRoot, actualRoot) => {
  const expectedFiles = collectFilePaths(expectedRoot);
  const actualFiles = collectFilePaths(actualRoot);
  const expectedSet = new Set(expectedFiles);
  const actualSet = new Set(actualFiles);
  const removed = expectedFiles.filter(file => !actualSet.has(file));
  const added = actualFiles.filter(file => !expectedSet.has(file));
  const changed = expectedFiles.filter(
    file =>
      actualSet.has(file) &&
      fileHash(path.join(expectedRoot, file)) !==
        fileHash(path.join(actualRoot, file))
  );
  if (removed.length + added.length + changed.length === 0) {
    return expectedFiles.length;
  }
  throw new Error(
    [
      "Generated fixture output is stale.",
      ...removed.map(file => `removed: ${file}`),
      ...added.map(file => `added: ${file}`),
      ...changed.map(file => `changed: ${file}`),
      "Run `pnpm run test:gen` and commit the generated fixture updates.",
    ].join("\n")
  );
};

if (!existsSync(cliEntry)) {
  throw new Error(
    "Built CLI is missing. Run `pnpm build` before `pnpm verify:generated`."
  );
}

const temporaryRoot = mkdtempSync(
  path.join(testProjectRoot, ".typeweaver-generated-verification-")
);
const actualOutputRoot = path.join(temporaryRoot, "output");
let verifiedFileCount = 0;
try {
  const generation = spawnSync(
    process.execPath,
    [
      cliEntry,
      "generate",
      "--output",
      actualOutputRoot,
      "--input",
      path.join(testProjectRoot, "spec", "index.ts"),
      "--plugins",
      "clients,command,aws-cdk,hono,server,effect,openapi",
    ],
    {
      cwd: path.join(workspaceRoot, "packages", "test-utils"),
      encoding: "utf8",
      env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" },
      maxBuffer: 20 * 1024 * 1024,
    }
  );
  if (generation.error !== undefined) {
    throw generation.error;
  }
  if (generation.status !== 0) {
    throw new Error(
      [generation.stdout, generation.stderr].filter(Boolean).join("\n")
    );
  }
  verifiedFileCount = compareTrees(expectedOutputRoot, actualOutputRoot);
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}

process.stdout.write(
  `${String(verifiedFileCount)} generated fixture files match a fresh isolated generation\n`
);
