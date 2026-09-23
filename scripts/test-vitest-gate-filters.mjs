import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import {
  collectVitestGates,
  parseVitestInvocations,
} from "./lib/vitest-gate-discovery.mjs";
import { validateVitestGate } from "./lib/vitest-gate-filters.mjs";

/**
 * Proves the Vitest gate filter contract rejects each way a gate silently
 * loses coverage: a stale filter, a bare prefix, an exact file inside a split
 * suite directory, and an exact file whose split siblings stay unselected.
 */

const fixtureRoot = mkdtempSync(path.join(os.tmpdir(), "vitest-gate-filters-"));

/**
 * @param {string} relativePath
 * @param {string} [contents]
 * @returns {void}
 */
const writeFixture = (relativePath, contents = "") => {
  const target = path.join(fixtureRoot, relativePath);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, contents);
};

/**
 * @param {readonly string[]} filters
 * @returns {string[]}
 */
const failuresFor = filters =>
  validateVitestGate({
    label: "packages/demo/package.json#gate",
    rootDirectory: path.join(fixtureRoot, "packages", "demo"),
    filters,
  });

try {
  writeFixture(
    "package.json",
    JSON.stringify({
      name: "workspace",
      scripts: {
        "test:tooling": "vitest --run tools/",
        "verify:docs":
          "pnpm --filter demo build && pnpm --filter demo exec vitest --run --no-file-parallelism __test__/suite/",
      },
    })
  );
  writeFixture("tools/tool.test.ts");
  writeFixture(
    "packages/demo/package.json",
    JSON.stringify({
      name: "demo",
      scripts: {
        test: "vitest --run",
        "test:gate":
          "pnpm run build && vitest run --reporter dot __test__/single.test.ts",
      },
    })
  );
  writeFixture("packages/demo/src/services/service.ts");
  writeFixture("packages/demo/__test__/single.test.ts");
  writeFixture("packages/demo/__test__/suite/first.test.ts");
  writeFixture("packages/demo/__test__/suite/second.test.ts");
  writeFixture("packages/demo/__test__/suite/fixtures.ts");
  writeFixture("packages/demo/__test__/services/pair.test.ts");
  writeFixture("packages/demo/__test__/services/pair.property.test.ts");
  writeFixture("packages/demo/__test__/legacy.test.ts");
  writeFixture("packages/demo/__test__/legacy.extra.test.ts");
  writeFixture("packages/demo/__test__/moved.test.ts");
  writeFixture("packages/demo/__test__/moved/part.test.ts");

  assert.deepEqual(
    parseVitestInvocations(
      "pnpm run build && vitest --run --no-file-parallelism a/ b.test.ts"
    ),
    [{ packageName: undefined, filters: ["a/", "b.test.ts"] }]
  );
  assert.deepEqual(
    parseVitestInvocations("vitest run --reporter dot --project=x c/"),
    [{ packageName: undefined, filters: ["c/"] }]
  );
  assert.deepEqual(
    parseVitestInvocations("pnpm --filter demo exec vitest --run d/"),
    [{ packageName: "demo", filters: ["d/"] }]
  );
  assert.deepEqual(parseVitestInvocations("tsc --noEmit && vitest --run"), [
    { packageName: undefined, filters: [] },
  ]);

  assert.deepEqual(
    collectVitestGates(fixtureRoot).map(gate => ({
      ...gate,
      rootDirectory: path.relative(fixtureRoot, gate.rootDirectory ?? "?"),
    })),
    [
      {
        label: "package.json#test:tooling",
        rootDirectory: "",
        filters: ["tools/"],
      },
      {
        label: "package.json#verify:docs",
        rootDirectory: path.join("packages", "demo"),
        filters: ["__test__/suite/"],
      },
      {
        label: "packages/demo/package.json#test:gate",
        rootDirectory: path.join("packages", "demo"),
        filters: ["__test__/single.test.ts"],
      },
    ]
  );
  assert.deepEqual(
    collectVitestGates(fixtureRoot).flatMap(validateVitestGate),
    []
  );

  assert.deepEqual(
    failuresFor([
      "__test__/suite/",
      "./__test__/single.test.ts",
      "__test__/services/pair.test.ts",
      "__test__/services/pair.property.test.ts",
      "__test__/legacy.test.ts",
      "__test__/legacy.extra.test.ts",
    ]),
    []
  );
  assert.deepEqual(failuresFor(["__test__/missing.test.ts"]), [
    "packages/demo/package.json#gate: filter '__test__/missing.test.ts' selects no test file",
  ]);
  assert.deepEqual(failuresFor(["__test__/suite"]), [
    "packages/demo/package.json#gate: filter '__test__/suite' must be a test file or a directory ending in '/'",
  ]);
  assert.deepEqual(failuresFor(["suite/"]), [
    "packages/demo/package.json#gate: filter 'suite/' is not a directory",
  ]);
  assert.deepEqual(failuresFor(["__test__/suite/first.test.ts"]), [
    "packages/demo/package.json#gate: filter '__test__/suite/first.test.ts' sits in the suite directory '__test__/suite/'",
  ]);
  assert.deepEqual(failuresFor(["__test__/moved.test.ts"]), [
    "packages/demo/package.json#gate: filter '__test__/moved.test.ts' names one file of the suite split into '__test__/moved/'",
  ]);
  assert.deepEqual(failuresFor(["__test__/legacy.test.ts"]), [
    "packages/demo/package.json#gate: filter '__test__/legacy.test.ts' leaves the split sibling '__test__/legacy.extra.test.ts' unselected",
  ]);
  assert.deepEqual(
    validateVitestGate({
      label: "package.json#gate",
      rootDirectory: undefined,
      filters: ["x/"],
    }),
    ["package.json#gate: targets a workspace package that does not exist"]
  );
} finally {
  rmSync(fixtureRoot, { recursive: true, force: true });
}

process.stdout.write(
  "Vitest gate filter contract rejected stale, bare, split-directory, and split-sibling filters\n"
);
