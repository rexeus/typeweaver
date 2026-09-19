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
    [
      "# Fixture",
      "",
      `<!-- docs-example: ${groupId} -->`,
      "",
      "```ts",
      "export const invalid: string = 42;",
      "```",
      `<!-- docs-snippet: ${groupId} -->`,
      "",
    ].join("\n")
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
        runtimeFixtures: ["examples/missing.process.test.ts"],
        snippets: [
          {
            id: groupId,
            document: "README.md",
            fixture: "examples/invalid.ts",
          },
        ],
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
  assert(
    invalidResult.failures.some(failure =>
      failure.includes(
        "missing runtime fixture examples/missing.process.test.ts"
      )
    ),
    `missing runtime fixture unexpectedly passed:\n${invalidResult.failures.join("\n")}`
  );

  writeFileSync(
    path.join(fixtureRoot, "examples", "invalid.ts"),
    'export const valid: string = "checked";\n'
  );
  writeFileSync(
    path.join(fixtureRoot, "examples", "missing.process.test.ts"),
    'export const runtimeFixture = "registered";\n'
  );
  writeFileSync(
    path.join(fixtureRoot, "README.md"),
    [
      "# Fixture",
      "",
      `<!-- docs-example: ${groupId} -->`,
      "",
      "```ts",
      'export const valid: string = "checked";',
      "```",
      `<!-- docs-snippet: ${groupId} -->`,
      "",
    ].join("\n")
  );
  const validResult = verifyDocumentationExamples({
    workspaceRoot: fixtureRoot,
    manifestPath,
    requiredGroupIds: [groupId],
  });
  assert.deepEqual(validResult.failures, []);

  writeFileSync(
    path.join(fixtureRoot, "README.md"),
    [
      "# Fixture",
      "",
      `<!-- docs-example: ${groupId} -->`,
      "",
      "```ts",
      'export const valid: string = "drifted";',
      "```",
      `<!-- docs-snippet: ${groupId} -->`,
      "",
    ].join("\n")
  );
  const driftedSnippetResult = verifyDocumentationExamples({
    workspaceRoot: fixtureRoot,
    manifestPath,
    requiredGroupIds: [groupId],
  });
  assert(
    driftedSnippetResult.failures.includes(
      `${groupId}: documented snippet ${groupId} differs from examples/invalid.ts`
    ),
    `drifted snippet unexpectedly passed:\n${driftedSnippetResult.failures.join("\n")}`
  );

  writeJson(manifestPath, {
    version: 1,
    tsconfig: "tsconfig.json",
    groups: [
      {
        id: groupId,
        documents: ["README.md"],
        fixtures: [],
        snippets: [
          {
            id: groupId,
            document: "README.md",
            fixture: "examples/missing-snippet.ts",
          },
        ],
      },
    ],
  });
  const missingSnippetFixtureResult = verifyDocumentationExamples({
    workspaceRoot: fixtureRoot,
    manifestPath,
    requiredGroupIds: [groupId],
  });
  assert(
    missingSnippetFixtureResult.failures.includes(
      `${groupId}: missing snippet fixture examples/missing-snippet.ts`
    ),
    `missing snippet fixture unexpectedly passed:\n${missingSnippetFixtureResult.failures.join("\n")}`
  );

  writeJson(manifestPath, {
    version: 1,
    tsconfig: "tsconfig.json",
    groups: [],
  });
  const missingRequiredGroupResult = verifyDocumentationExamples({
    workspaceRoot: fixtureRoot,
    manifestPath,
    requiredGroupIds: [groupId],
  });
  assert.deepEqual(missingRequiredGroupResult.failures, [
    `Missing required documentation example group: ${groupId}`,
  ]);

  writeJson(manifestPath, {
    version: 1,
    tsconfig: "tsconfig.json",
    groups: [{ id: groupId }],
  });
  const malformedManifestResult = verifyDocumentationExamples({
    workspaceRoot: fixtureRoot,
    manifestPath,
    requiredGroupIds: [groupId],
  });
  assert.deepEqual(malformedManifestResult.failures, [
    `${groupId}: documents must be an array`,
    `${groupId}: fixtures must be an array`,
  ]);

  for (const invalidTsconfig of [undefined, 42]) {
    writeJson(manifestPath, {
      version: 1,
      ...(invalidTsconfig === undefined ? {} : { tsconfig: invalidTsconfig }),
      groups: [
        {
          id: groupId,
          documents: ["README.md"],
          fixtures: ["examples/invalid.ts"],
        },
      ],
    });
    const invalidTsconfigResult = verifyDocumentationExamples({
      workspaceRoot: fixtureRoot,
      manifestPath,
      requiredGroupIds: [groupId],
    });
    assert.deepEqual(invalidTsconfigResult.failures, [
      `${manifestPath}: tsconfig must be a non-empty string`,
    ]);
  }

  rmSync(path.join(fixtureRoot, manifestPath));
  const missingManifestResult = verifyDocumentationExamples({
    workspaceRoot: fixtureRoot,
    manifestPath,
    requiredGroupIds: [groupId],
  });
  assert.deepEqual(missingManifestResult, {
    failures: [`${manifestPath}: manifest file does not exist`],
    groups: [],
  });

  writeFileSync(path.join(fixtureRoot, manifestPath), "{ invalid json");
  const invalidJsonResult = verifyDocumentationExamples({
    workspaceRoot: fixtureRoot,
    manifestPath,
    requiredGroupIds: [groupId],
  });
  assert.deepEqual(invalidJsonResult, {
    failures: [`${manifestPath}: manifest contains invalid JSON`],
    groups: [],
  });

  writeJson(manifestPath, null);
  const nonObjectManifestResult = verifyDocumentationExamples({
    workspaceRoot: fixtureRoot,
    manifestPath,
    requiredGroupIds: [groupId],
  });
  assert.deepEqual(nonObjectManifestResult, {
    failures: [`${manifestPath}: manifest must be a JSON object`],
    groups: [],
  });
} finally {
  rmSync(fixtureRoot, { recursive: true });
}

process.stdout.write(
  "Documentation example checker rejected invalid fixtures and manifests\n"
);
