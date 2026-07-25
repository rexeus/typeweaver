import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const workspaceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const languageServiceCli = path.join(
  workspaceRoot,
  "node_modules",
  "@effect",
  "language-service",
  "cli.js"
);
const packageRoot = path.join(workspaceRoot, "packages");
const dependencySections = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
];
const projects = readdirSync(packageRoot, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .flatMap(entry => {
    const directory = path.join(packageRoot, entry.name);
    const packageJsonPath = path.join(directory, "package.json");
    if (!existsSync(packageJsonPath)) {
      return [];
    }
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
    const usesEffect = dependencySections.some(
      section => packageJson[section]?.effect !== undefined
    );
    if (!usesEffect) {
      return [];
    }
    const typecheckProject = path.join(directory, "tsconfig.typecheck.json");
    const project = existsSync(typecheckProject)
      ? typecheckProject
      : path.join(directory, "tsconfig.json");
    return [project];
  })
  .sort();
const format =
  process.env.GITHUB_ACTIONS === "true" ? "github-actions" : "text";

for (const project of projects) {
  process.stdout.write(
    `Effect diagnostics: ${path.relative(workspaceRoot, project)}\n`
  );
  const result = spawnSync(
    process.execPath,
    [
      languageServiceCli,
      "diagnostics",
      "--project",
      project,
      "--format",
      format,
      "--strict",
    ],
    {
      cwd: workspaceRoot,
      stdio: "inherit",
    }
  );

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
