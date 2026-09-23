import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  NATIVE_EFFECT_DOCUMENT_TOKENS,
  validateNativeEffectWorkspaceContract,
} from "./lib/effect-native-contract.mjs";
import { validateEffectPackageVersions } from "./lib/effect-version-contract.mjs";

const runtimeVersion = "4.0.0-rc.116";
const fixtureRoot = mkdtempSync(
  path.join(tmpdir(), "typeweaver-effect-contract-")
);
const packageRoot = path.join(fixtureRoot, "packages", "runtime");
const installedEffectRoot = path.join(packageRoot, "node_modules", "effect");

/** @param {string} filePath @param {unknown} value @returns {void} */
const writeJson = (filePath, value) => {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
};

try {
  mkdirSync(installedEffectRoot, { recursive: true });
  writeJson(path.join(packageRoot, "package.json"), {
    name: "runtime-fixture",
    dependencies: { effect: runtimeVersion },
  });
  writeJson(path.join(installedEffectRoot, "package.json"), {
    name: "effect",
    version: runtimeVersion,
  });
  assert.deepEqual(
    validateEffectPackageVersions({
      workspaceRoot: fixtureRoot,
      runtimeVersion,
    }),
    []
  );

  writeJson(path.join(packageRoot, "package.json"), {
    name: "runtime-fixture",
    dependencies: { effect: "^4.0.0-rc.116" },
  });
  const driftFailures = validateEffectPackageVersions({
    workspaceRoot: fixtureRoot,
    runtimeVersion,
  });
  assert(
    driftFailures.some(failure =>
      failure.includes(
        "dependencies.effect must be 4.0.0-rc.116; found ^4.0.0-rc.116"
      )
    ),
    `missing exact-pin failure:\n${driftFailures.join("\n")}`
  );

  writeJson(path.join(packageRoot, "package.json"), {
    name: "runtime-fixture",
    dependencies: { effect: runtimeVersion },
  });
  writeJson(path.join(installedEffectRoot, "package.json"), {
    name: "effect",
    version: "4.0.0-rc.115",
  });
  const resolutionFailures = validateEffectPackageVersions({
    workspaceRoot: fixtureRoot,
    runtimeVersion,
  });
  assert(
    resolutionFailures.some(failure =>
      failure.includes("resolves Effect 4.0.0-rc.115; expected 4.0.0-rc.116")
    ),
    `missing resolved-version failure:\n${resolutionFailures.join("\n")}`
  );
} finally {
  rmSync(fixtureRoot, { recursive: true, force: true });
}

const manifests = {
  cli: {
    dependencies: { effect: runtimeVersion },
    peerDependencies: {},
    peerDependenciesMeta: {},
  },
  gen: {
    dependencies: {},
    peerDependencies: { effect: "catalog:peers" },
    peerDependenciesMeta: {},
  },
  effect: {
    dependencies: {},
    peerDependencies: { effect: "catalog:peers" },
    peerDependenciesMeta: {},
  },
  clients: {
    dependencies: {},
    peerDependencies: {},
    peerDependenciesMeta: {},
  },
  command: {
    dependencies: {},
    peerDependencies: { effect: "catalog:peers" },
    peerDependenciesMeta: {},
  },
  types: {
    dependencies: {},
    peerDependencies: {},
    peerDependenciesMeta: {},
  },
  server: {
    dependencies: {},
    peerDependencies: {},
    peerDependenciesMeta: {},
  },
  hono: {
    dependencies: {},
    peerDependencies: { effect: "catalog:peers", hono: "catalog:peers" },
    peerDependenciesMeta: { hono: { optional: true } },
  },
  openapi: {
    dependencies: {},
    peerDependencies: { effect: "catalog:peers" },
    peerDependenciesMeta: {},
  },
  "aws-cdk": {
    dependencies: {},
    peerDependencies: {},
    peerDependenciesMeta: {},
  },
  core: {
    dependencies: {},
    peerDependencies: { zod: "catalog:peers" },
    peerDependenciesMeta: {},
  },
};

const documents = Object.fromEntries(
  Object.entries(NATIVE_EFFECT_DOCUMENT_TOKENS).map(([document, tokens]) => [
    document,
    tokens.join("\n"),
  ])
);

const validContract = {
  runtimeVersion,
  peerRange: runtimeVersion,
  tsgoVersion: "0.45.0",
  referenceRepository: "https://github.com/Effect-TS/effect.git",
  referenceTag: `effect@${runtimeVersion}`,
  referenceCommit: "d62dd0d65252e5d3635538f0e41adc7c08aa9beb",
  acceptedEffectDependencies: {},
};

assert.deepEqual(
  validateNativeEffectWorkspaceContract({
    contract: validContract,
    manifests,
    documents,
  }),
  []
);

/** @type {Array<[() => void, string]>} */
const mutations = [
  [
    () => {
      manifests.gen.peerDependencies.effect = runtimeVersion;
    },
    "must be catalog:peers",
  ],
  [
    () => {
      documents["README.md"] = `${documents["README.md"]}\nEffect 3 only\n`;
    },
    "obsolete Effect guidance",
  ],
  [
    () => {
      Object.assign(manifests.core.peerDependencies, {
        effect: "catalog:peers",
      });
    },
    "Effect-optional",
  ],
  [
    () => {
      documents["packages/effect/README.md"] = "4.0.0-rc.116\nCause\n";
    },
    "packages/effect/README.md is missing native Effect statement: ManagedRuntime",
  ],
];
for (const [mutate, expected] of mutations) {
  const original = JSON.parse(JSON.stringify(manifests));
  const documentCopy = { ...documents };
  mutate();
  const failures = validateNativeEffectWorkspaceContract({
    contract: validContract,
    manifests,
    documents,
  });
  assert(
    failures.some(failure => failure.includes(expected)),
    `missing native contract failure containing ${expected}:\n${failures.join("\n")}`
  );
  Object.assign(manifests, JSON.parse(JSON.stringify(original)));
  Object.assign(documents, documentCopy);
}

const obsoleteContract = { ...validContract, effect4Evidence: {} };
assert(
  validateNativeEffectWorkspaceContract({
    contract: obsoleteContract,
    manifests,
    documents,
  }).some(failure => failure.includes("obsolete effect4Evidence"))
);

process.stdout.write(
  "Native Effect RC.116 package and workspace contract guard passed\n"
);
