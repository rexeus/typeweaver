import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const workspaceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const result = spawnSync(
  process.execPath,
  [
    path.join(
      workspaceRoot,
      "node_modules",
      "@effect",
      "language-service",
      "cli.js"
    ),
    "diagnostics",
    "--project",
    path.join(
      workspaceRoot,
      "packages",
      "cli",
      "test-fixtures",
      "effect-diagnostics",
      "tsconfig.json"
    ),
    "--format",
    "text",
    "--strict",
  ],
  {
    cwd: workspaceRoot,
    encoding: "utf8",
  }
);

const output = `${result.stdout}${result.stderr}`;
if (result.status === 0 || !output.includes("effect(effectFnImplicitAny)")) {
  process.stderr.write(output);
  throw new Error(
    "Effect diagnostics sentinel did not reject the implicit-any Effect.fn fixture"
  );
}

process.stdout.write(
  "Effect diagnostics sentinel rejected an implicit-any Effect.fn as expected\n"
);
