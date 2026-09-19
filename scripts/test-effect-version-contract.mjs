import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  PHASE_A_DOCUMENT_TOKENS,
  validateEffectPackageVersions,
  validateEffectPhaseAContract,
} from "./lib/effect-version-contract.mjs";

const fixtureRoot = mkdtempSync(
  path.join(tmpdir(), "typeweaver-effect-contract-")
);
const packageRoot = path.join(fixtureRoot, "packages", "runtime");
const publishedRoot = path.join(fixtureRoot, "packages", "published");
const installedEffectRoot = path.join(packageRoot, "node_modules", "effect");
const writeJson = (filePath, value) =>
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);

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

const validPhaseAContract = () => ({
  runtimeVersion: "3.22.0",
  peerRange: ">=3.22.0 <4",
  phaseA: {
    effectVersion: "4.0.0-rc.115",
    scope: "process-isolated-cli-only",
    stability: "release-candidate",
    nativeSurfaces: "effect-3-only",
  },
});

const validPhaseAManifests = () => ({
  cli: {
    dependencies: { effect: "^3.22.0" },
    peerDependencies: {},
  },
  gen: {
    dependencies: {},
    peerDependencies: { effect: "catalog:peers" },
  },
  effect: {
    dependencies: {},
    peerDependencies: { effect: "catalog:peers" },
  },
  hono: {
    dependencies: {},
    peerDependencies: { effect: "catalog:peers", hono: "catalog:peers" },
    peerDependenciesMeta: { hono: { optional: true } },
  },
  core: {
    peerDependencies: { zod: "catalog:peers" },
  },
});

const validPhaseADocuments = () =>
  Object.fromEntries(
    Object.entries(PHASE_A_DOCUMENT_TOKENS).map(([document, tokens]) => [
      document,
      tokens.join("\n"),
    ])
  );

const verifyPhaseAContractGuard = () => {
  const validate = (mutate = () => {}) => {
    const input = {
      contract: validPhaseAContract(),
      manifests: validPhaseAManifests(),
      documents: validPhaseADocuments(),
    };
    mutate(input);
    return validateEffectPhaseAContract(input);
  };

  assert.deepEqual(
    validate(),
    [],
    `valid Phase A contract rejected:\n${validate().join("\n")}`
  );

  assert(
    validate(input => {
      input.contract.phaseA.scope = "promised-range";
    }).some(failure => failure.includes("process-isolated-cli-only")),
    "missing Phase A scope failure"
  );
  assert(
    validate(input => {
      input.contract.phaseA.effectVersion = "4.0.0";
    }).some(failure => failure.includes("4.0.0-rc.115")),
    "missing exact Phase A RC failure"
  );
  assert(
    validate(input => {
      input.contract.phaseA.nativeSurfaces = "effect-4-capable";
    }).some(failure => failure.includes("effect-3-only")),
    "missing native-surfaces failure"
  );
  assert(
    validate(input => {
      input.contract.peerRange = ">=3.22.0 <5";
    }).some(failure => failure.includes("<4")),
    "missing peer widening failure"
  );
  assert(
    validate(input => {
      input.manifests.cli.peerDependencies.effect = "catalog:peers";
    }).some(failure => failure.includes("CLI")),
    "missing CLI Effect peer failure"
  );
  assert(
    validate(input => {
      input.manifests.gen.peerDependencies.effect = "^4.0.0";
    }).some(failure => failure.includes("@rexeus/typeweaver-gen")),
    "missing gen peer failure"
  );
  assert(
    validate(input => {
      delete input.documents[
        "docs/adr/0010-effect-4-workspace-compatibility.md"
      ];
    }).some(failure => failure.includes("0010")),
    "missing ADR 0010 failure"
  );
  assert(
    validate(input => {
      input.documents["README.md"] =
        `${input.documents["README.md"]}\nTypeWeaver supports Effect 4.\n`;
    }).some(failure => failure.includes("generic Phase A promise")),
    "missing generic Effect 4 promise failure"
  );
  assert(
    validate(input => {
      input.documents["packages/cli/README.md"] = input.documents[
        "packages/cli/README.md"
      ].replaceAll("4.0.0-rc.115", "Effect 4");
    }).some(failure => failure.includes("4.0.0-rc.115")),
    "missing exact-pin document failure"
  );
  assert(
    validate(input => {
      delete input.manifests.hono.peerDependenciesMeta.hono.optional;
    }).some(failure => failure.includes("hono")),
    "missing optional Hono peer failure"
  );
  assert(
    validate(input => {
      input.manifests.effect.peerDependenciesMeta = {
        effect: { optional: true },
      };
    }).some(failure => failure.includes("must not mark effect optional")),
    "missing required-Effect-peer failure"
  );
};

verifyPhaseAContractGuard();

process.stdout.write(
  "Effect package contract guard rejected the Effect 4, caret-drift, and unaccepted-dependency fixtures\n"
);
