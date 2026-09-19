import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  EFFECT_4_DOCUMENT_TOKENS,
  validateEffectPackageVersions,
  validateEffect4WorkspaceContract,
} from "./lib/effect-version-contract.mjs";

/** @typedef {import("./lib/tooling-types.mjs").EffectBaselineContract} EffectBaselineContract */
/** @typedef {import("./lib/tooling-types.mjs").Effect4EvidenceContract} Effect4EvidenceContract */
/** @typedef {import("./lib/tooling-types.mjs").DependencyMap} DependencyMap */
/** @typedef {EffectBaselineContract & { effect4Evidence: Effect4EvidenceContract }} Effect4EvidenceContractInput */

/**
 * @typedef {object} TestManifest
 * @property {DependencyMap} dependencies
 * @property {DependencyMap} peerDependencies
 * @property {Record<string, { optional?: boolean }>} peerDependenciesMeta
 */

/** @typedef {{ cli: TestManifest, gen: TestManifest, effect: TestManifest, hono: TestManifest, core: TestManifest }} TestManifests */
/** @typedef {{ contract: Effect4EvidenceContractInput, manifests: TestManifests, documents: Record<string, string> }} ContractInput */
/** @typedef {[mutate: (input: ContractInput) => void, expected: string, message: string]} ContractMutation */

const fixtureRoot = mkdtempSync(
  path.join(tmpdir(), "typeweaver-effect-contract-")
);
const packageRoot = path.join(fixtureRoot, "packages", "runtime");
const publishedRoot = path.join(fixtureRoot, "packages", "published");
const installedEffectRoot = path.join(packageRoot, "node_modules", "effect");
/**
 * @param {string} filePath
 * @param {unknown} value
 * @returns {void}
 */
const writeJson = (filePath, value) => {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
};

try {
  mkdirSync(installedEffectRoot, { recursive: true });
  mkdirSync(publishedRoot, { recursive: true });
  writeJson(path.join(packageRoot, "package.json"), {
    name: "runtime-fixture",
    dependencies: {
      effect: "^4.0.0",
    },
  });
  writeJson(path.join(installedEffectRoot, "package.json"), {
    name: "effect",
    version: "4.0.0",
  });

  const mutatedFailures = validateEffectPackageVersions({
    workspaceRoot: fixtureRoot,
    runtimeVersion: "3.22.0",
  });
  assert(
    mutatedFailures.some(failure =>
      failure.includes("dependencies.effect must be ^3.22.0; found ^4.0.0")
    ),
    `missing manifest failure:\n${mutatedFailures.join("\n")}`
  );
  assert(
    mutatedFailures.some(failure =>
      failure.includes("resolves Effect 4.0.0; expected 3.22.0")
    ),
    `missing resolved-version failure:\n${mutatedFailures.join("\n")}`
  );

  writeJson(path.join(packageRoot, "package.json"), {
    name: "runtime-fixture",
    dependencies: {
      effect: "^3.22.0",
    },
  });
  writeJson(path.join(installedEffectRoot, "package.json"), {
    name: "effect",
    version: "3.22.0",
  });

  assert.deepEqual(
    validateEffectPackageVersions({
      workspaceRoot: fixtureRoot,
      runtimeVersion: "3.22.0",
    }),
    []
  );

  writeJson(path.join(publishedRoot, "package.json"), {
    name: "published-fixture",
    dependencies: {
      "@effect/platform": "^0.97.0",
    },
  });
  const caretFailures = validateEffectPackageVersions({
    workspaceRoot: fixtureRoot,
    runtimeVersion: "3.22.0",
    acceptedEffectDependencies: { "@effect/platform": "0.97.0" },
  });
  assert(
    caretFailures.some(failure =>
      failure.includes(
        "@effect/platform must be pinned to 0.97.0; found ^0.97.0"
      )
    ),
    `missing caret-drift failure:\n${caretFailures.join("\n")}`
  );

  writeJson(path.join(publishedRoot, "package.json"), {
    name: "published-fixture",
    dependencies: {
      "@effect/platform": "0.97.0",
      "@effect/sql": "0.52.0",
    },
  });
  const unacceptedFailures = validateEffectPackageVersions({
    workspaceRoot: fixtureRoot,
    runtimeVersion: "3.22.0",
    acceptedEffectDependencies: { "@effect/platform": "0.97.0" },
  });
  assert(
    unacceptedFailures.some(failure =>
      failure.includes("unaccepted Effect dependency @effect/sql@0.52.0")
    ),
    `missing unaccepted-dependency failure:\n${unacceptedFailures.join("\n")}`
  );
} finally {
  rmSync(fixtureRoot, { recursive: true });
}

/** @returns {Effect4EvidenceContractInput} */
const validEffect4WorkspaceContract = () => ({
  runtimeVersion: "3.22.0",
  peerRange: ">=3.22.0 <4",
  effect4Evidence: {
    effectVersion: "4.0.0-rc.115",
    scope: "process-isolated-cli-only",
    stability: "release-candidate",
    nativeSurfaces: "effect-3-only",
  },
  acceptedEffectDependencies: {},
  languageServiceVersion: "0.87.1",
  referenceRepository: "https://example.test/effect.git",
  referenceTag: "effect@3.22.0",
  referenceCommit: "0000000000000000000000000000000000000000",
});

/** @returns {TestManifests} */
const validEffect4WorkspaceManifests = () => ({
  cli: {
    dependencies: { effect: "^3.22.0" },
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
  hono: {
    dependencies: {},
    peerDependencies: { effect: "catalog:peers", hono: "catalog:peers" },
    peerDependenciesMeta: { hono: { optional: true } },
  },
  core: {
    dependencies: {},
    peerDependencies: { zod: "catalog:peers" },
    peerDependenciesMeta: {},
  },
});

/** @returns {Record<string, string>} */
const validEffect4WorkspaceDocuments = () => {
  /** @type {Record<string, string>} */
  const documents = {};
  for (const [document, tokens] of Object.entries(EFFECT_4_DOCUMENT_TOKENS)) {
    documents[document] = tokens.join("\n");
  }
  return documents;
};

/** @type {ContractMutation[]} */
const effect4EvidenceMutations = [
  [
    input => {
      input.contract.effect4Evidence.scope = "promised-range";
    },
    "process-isolated-cli-only",
    "missing Effect 4 evidence scope failure",
  ],
  [
    input => {
      input.contract.effect4Evidence.effectVersion = "4.0.0";
    },
    "4.0.0-rc.115",
    "missing exact Effect 4 evidence pin failure",
  ],
  [
    input => {
      input.contract.effect4Evidence.nativeSurfaces = "effect-4-capable";
    },
    "effect-3-only",
    "missing native-surfaces failure",
  ],
  [
    input => {
      input.contract.peerRange = ">=3.22.0 <5";
    },
    "<4",
    "missing peer widening failure",
  ],
  [
    input => {
      input.manifests.cli.peerDependencies["effect"] = "catalog:peers";
    },
    "CLI",
    "missing CLI Effect peer failure",
  ],
  [
    input => {
      input.manifests.gen.peerDependencies["effect"] = "^4.0.0";
    },
    "@rexeus/typeweaver-gen",
    "missing gen peer failure",
  ],
  [
    input => {
      delete input.documents[
        "docs/adr/0010-effect-4-workspace-compatibility.md"
      ];
    },
    "0010",
    "missing ADR 0010 failure",
  ],
  [
    input => {
      input.documents["README.md"] =
        `${input.documents["README.md"] ?? ""}\nTypeWeaver supports Effect 4.\n`;
    },
    "generic Effect 4 promise",
    "missing generic Effect 4 promise failure",
  ],
  [
    input => {
      input.documents["packages/cli/README.md"] = (
        input.documents["packages/cli/README.md"] ?? ""
      ).replaceAll("4.0.0-rc.115", "Effect 4");
    },
    "4.0.0-rc.115",
    "missing exact-pin document failure",
  ],
  [
    input => {
      const honoMeta = input.manifests.hono.peerDependenciesMeta["hono"];
      if (honoMeta !== undefined) {
        delete honoMeta.optional;
      }
    },
    "hono",
    "missing optional Hono peer failure",
  ],
  [
    input => {
      input.manifests.effect.peerDependenciesMeta = {
        effect: { optional: true },
      };
    },
    "must not mark effect optional",
    "missing required-Effect-peer failure",
  ],
];

const verifyEffect4WorkspaceContractGuard = () => {
  /**
   * @param {(input: ContractInput) => void} [mutate]
   * @returns {string[]}
   */
  const validate = (mutate = () => {}) => {
    const input = {
      contract: validEffect4WorkspaceContract(),
      manifests: validEffect4WorkspaceManifests(),
      documents: validEffect4WorkspaceDocuments(),
    };
    mutate(input);
    return validateEffect4WorkspaceContract(input);
  };

  assert.deepEqual(
    validate(),
    [],
    `valid Effect 4 workspace contract rejected:\n${validate().join("\n")}`
  );

  for (const [mutate, expected, message] of effect4EvidenceMutations) {
    assert(
      validate(mutate).some(failure => failure.includes(expected)),
      message
    );
  }
};

verifyEffect4WorkspaceContractGuard();

process.stdout.write(
  "Effect package contract guard rejected the Effect 4, caret-drift, and unaccepted-dependency fixtures\n"
);
