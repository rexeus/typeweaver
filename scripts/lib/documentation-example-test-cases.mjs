import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { verifyDocumentationExamples } from "./documentation-examples.mjs";

/** @typedef {{ failures: string[], groups: import("./documentation-example-manifest.mjs").DocumentationGroup[] }} DocumentationVerification */

const manifestPath = "documentation-examples.json";
const groupId = "negative-fixture";
/** @param {string} root @param {string} relativePath @param {unknown} value @returns {void} */
const writeJson = (root, relativePath, value) =>
  writeFileSync(
    path.join(root, relativePath),
    `${JSON.stringify(value, null, 2)}\n`
  );
/** @param {string} root @returns {DocumentationVerification} */
const verify = root =>
  verifyDocumentationExamples({
    workspaceRoot: root,
    manifestPath,
    requiredGroupIds: [groupId],
  });
/** @param {string} root @param {string} value @returns {void} */
const document = (root, value) =>
  writeFileSync(
    path.join(root, "README.md"),
    [
      "# Fixture",
      "",
      `<!-- docs-example: ${groupId} -->`,
      "",
      "```ts",
      value,
      "```",
      `<!-- docs-snippet: ${groupId} -->`,
      "",
    ].join("\n")
  );

/** @param {string} root @returns {void} */
const writeInitialFixture = root => {
  mkdirSync(path.join(root, "examples"));
  document(root, "export const invalid: string = 42;");
  writeFileSync(
    path.join(root, "examples", "invalid.ts"),
    "export const invalid: string = 42;\n"
  );
  writeJson(root, "tsconfig.json", {
    compilerOptions: {
      module: "NodeNext",
      moduleResolution: "NodeNext",
      noEmit: true,
      strict: true,
    },
    include: ["examples/invalid.ts"],
  });
  writeJson(root, manifestPath, {
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
};

/** @param {string} root @returns {void} */
const assertInitialFailures = root => {
  const result = verify(root);
  assert(
    result.failures.some(failure =>
      failure.includes("Type 'number' is not assignable to type 'string'")
    ),
    `invalid fixture unexpectedly passed:\n${result.failures.join("\n")}`
  );
  assert(
    result.failures.some(failure =>
      failure.includes(
        "missing runtime fixture examples/missing.process.test.ts"
      )
    ),
    `missing runtime fixture unexpectedly passed:\n${result.failures.join("\n")}`
  );
};

/** @param {string} root @returns {void} */
const assertSnippetDrift = root => {
  writeFileSync(
    path.join(root, "examples", "invalid.ts"),
    'export const valid: string = "checked";\n'
  );
  writeFileSync(
    path.join(root, "examples", "missing.process.test.ts"),
    'export const runtimeFixture = "registered";\n'
  );
  document(root, 'export const valid: string = "checked";');
  assert.deepEqual(verify(root).failures, []);
  document(root, 'export const valid: string = "drifted";');
  const result = verify(root);
  assert(
    result.failures.includes(
      `${groupId}: documented snippet ${groupId} differs from examples/invalid.ts`
    ),
    `drifted snippet unexpectedly passed:\n${result.failures.join("\n")}`
  );
};

/** @param {string} root @returns {void} */
const assertManifestValidation = root => {
  writeJson(root, manifestPath, {
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
  assert(
    verify(root).failures.includes(
      `${groupId}: missing snippet fixture examples/missing-snippet.ts`
    )
  );
  writeJson(root, manifestPath, {
    version: 1,
    tsconfig: "tsconfig.json",
    groups: [],
  });
  assert.deepEqual(verify(root).failures, [
    `Missing required documentation example group: ${groupId}`,
  ]);
  writeJson(root, manifestPath, {
    version: 1,
    tsconfig: "tsconfig.json",
    groups: [{ id: groupId }],
  });
  assert.deepEqual(verify(root).failures, [
    `${groupId}: documents must be an array`,
    `${groupId}: fixtures must be an array`,
  ]);
  for (const tsconfig of [undefined, 42]) {
    writeJson(root, manifestPath, {
      version: 1,
      ...(tsconfig === undefined ? {} : { tsconfig }),
      groups: [
        {
          id: groupId,
          documents: ["README.md"],
          fixtures: ["examples/invalid.ts"],
        },
      ],
    });
    assert.deepEqual(verify(root).failures, [
      `${manifestPath}: tsconfig must be a non-empty string`,
    ]);
  }
};

/** @param {string} root @returns {void} */
const assertManifestReadFailures = root => {
  rmSync(path.join(root, manifestPath));
  assert.deepEqual(verify(root), {
    failures: [`${manifestPath}: manifest file does not exist`],
    groups: [],
  });
  writeFileSync(path.join(root, manifestPath), "{ invalid json");
  assert.deepEqual(verify(root), {
    failures: [`${manifestPath}: manifest contains invalid JSON`],
    groups: [],
  });
  writeJson(root, manifestPath, null);
  assert.deepEqual(verify(root), {
    failures: [`${manifestPath}: manifest must be a JSON object`],
    groups: [],
  });
};

/** @param {string} fixtureRoot @returns {void} */
export const runDocumentationExampleCases = fixtureRoot => {
  writeInitialFixture(fixtureRoot);
  assertInitialFailures(fixtureRoot);
  assertSnippetDrift(fixtureRoot);
  assertManifestValidation(fixtureRoot);
  assertManifestReadFailures(fixtureRoot);
};
