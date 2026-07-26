import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { verifyDocumentationExamples } from "./lib/documentation-examples.mjs";

const fixtureRoot = mkdtempSync(
  path.join(tmpdir(), "typeweaver-documentation-examples-")
);
const manifestPath = "documentation-examples.json";
const groupId = "negative-fixture";
const writeJson = (relativePath, value) =>
  writeFileSync(
    path.join(fixtureRoot, relativePath),
    `${JSON.stringify(value, null, 2)}\n`
  );

try {
  mkdirSync(path.join(fixtureRoot, "examples"));
  writeFileSync(
    path.join(fixtureRoot, "README.md"),
    `# Fixture\n\n<!-- docs-example: ${groupId} -->\n`
  );
  writeFileSync(
    path.join(fixtureRoot, "examples", "invalid.ts"),
    "export const invalid: string = 42;\n"
  );
  writeJson("tsconfig.json", {
    compilerOptions: {
      module: "NodeNext",
      moduleResolution: "NodeNext",
      noEmit: true,
      strict: true,
    },
    include: ["examples/invalid.ts"],
  });
  writeJson(manifestPath, {
    version: 1,
    tsconfig: "tsconfig.json",
    groups: [
      {
        id: groupId,
        documents: ["README.md"],
        fixtures: ["examples/invalid.ts"],
      },
    ],
  });

  const invalidResult = verifyDocumentationExamples({
    workspaceRoot: fixtureRoot,
    manifestPath,
    requiredGroupIds: [groupId],
  });
  assert(
    invalidResult.failures.some(failure =>
      failure.includes("Type 'number' is not assignable to type 'string'")
    ),
    `invalid fixture unexpectedly passed:\n${invalidResult.failures.join("\n")}`
  );

  writeFileSync(
    path.join(fixtureRoot, "examples", "invalid.ts"),
    'export const valid: string = "checked";\n'
  );
  const validResult = verifyDocumentationExamples({
    workspaceRoot: fixtureRoot,
    manifestPath,
    requiredGroupIds: [groupId],
  });
  assert.deepEqual(validResult.failures, []);
} finally {
  rmSync(fixtureRoot, { recursive: true });
}

process.stdout.write(
  "Documentation example checker rejected its invalid TypeScript fixture\n"
);
