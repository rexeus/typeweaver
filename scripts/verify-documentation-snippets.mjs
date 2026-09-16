import { cpSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { withDocumentationSnippetFixture } from "./lib/documentation-snippets.mjs";
import { spawnPnpmSync } from "./lib/pnpm-command.mjs";

const workspaceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const sourceRoot = path.join(
  workspaceRoot,
  "packages/cli/examples/documentation"
);
const runPnpm = args => {
  const result = spawnPnpmSync({
    args,
    cwd: workspaceRoot,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(
      [
        `pnpm ${args.join(" ")} failed with exit code ${String(result.status)}`,
        result.stdout.trim(),
        result.stderr.trim(),
      ]
        .filter(Boolean)
        .join("\n")
    );
  }
};
const snippetFiles = [
  "root-generated-client.ts",
  "getting-started-generated-client.ts",
];
// The fixture links the CLI workspace modules, which do not carry the root
// `@types/node` needed by the root compiler options.
const typeRoots = [
  path.join(workspaceRoot, "node_modules/@types"),
  path.join(workspaceRoot, "packages/cli/node_modules/@types"),
];

withDocumentationSnippetFixture({
  workspaceRoot,
  body: fixtureRoot => {
    const generatedRoot = path.join(fixtureRoot, "api/generated");
    runPnpm([
      "--filter",
      "@rexeus/typeweaver",
      "run",
      "cli",
      "--",
      "generate",
      "--input",
      path.join(sourceRoot, "getting-started.ts"),
      "--output",
      generatedRoot,
      "--plugins",
      "clients",
      "--no-format",
    ]);

    for (const snippetFile of snippetFiles) {
      cpSync(
        path.join(sourceRoot, "snippets", snippetFile),
        path.join(fixtureRoot, snippetFile)
      );
    }

    // Without a nearer manifest, the generated `.ts` files resolve as CommonJS
    // and violate `verbatimModuleSyntax`; the in-tree fixture inherited the CLI
    // package's module type instead.
    writeFileSync(
      path.join(fixtureRoot, "package.json"),
      `${JSON.stringify({ type: "module" }, null, 2)}\n`
    );
    writeFileSync(
      path.join(fixtureRoot, "tsconfig.json"),
      `${JSON.stringify(
        {
          extends: path
            .join(workspaceRoot, "tsconfig.json")
            .replaceAll(path.sep, "/"),
          compilerOptions: {
            declaration: false,
            declarationMap: false,
            noEmit: true,
            skipLibCheck: false,
            sourceMap: false,
            typeRoots: typeRoots.map(typeRoot =>
              typeRoot.replaceAll(path.sep, "/")
            ),
          },
          include: ["./*.ts", "./api/generated/**/*.ts"],
        },
        null,
        2
      )}\n`
    );
    runPnpm([
      "exec",
      "tsc",
      "--project",
      path.join(fixtureRoot, "tsconfig.json"),
    ]);
  },
});

process.stdout.write(
  `Documentation snippets generated and typechecked: ${snippetFiles.join(", ")}\n`
);
