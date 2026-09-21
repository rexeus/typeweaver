import assert from "node:assert/strict";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import {
  assertDoctorInFixture,
  assertPhantomImportsUnavailable,
  typecheckAndRunApp,
} from "./checks.mjs";
import {
  allProjectionDependencies,
  minimalDependencies,
  packedDependenciesFor,
  writeAppModule,
  writeConsumerSpec,
  writeFixtureManifest,
  writePlainProjectionsConfig,
  writeStrictNpmrc,
} from "./fixtures.mjs";
import {
  assertGeneratorEffectPeerContract,
  assertNativeEffectIdentities,
  assertPackedPackages,
} from "./graph.mjs";
import { installFixture, run } from "./runtime.mjs";
import {
  assertNoForbiddenModuleSpecifiers,
  assertProjectionOutputsExist,
} from "./scanner.mjs";

/** @param {{ archives: ReadonlyMap<string, string>, effectVersion: string, matrixRoot: string, packages: readonly import("../tooling-types.mjs").PublicPackage[] }} options @returns {void} */
export const verifyMinimalStrictInstall = ({
  archives,
  effectVersion,
  matrixRoot,
  packages,
}) => {
  const fixtureRoot = path.join(matrixRoot, "effect-4-minimal-strict");
  mkdirSync(fixtureRoot, { recursive: true });
  writeFixtureManifest({
    dependencies: minimalDependencies({ archives, effectVersion, packages }),
    fixtureRoot,
    name: "typeweaver-effect-4-minimal-strict",
    overrides: packedDependenciesFor({ archives, packages }),
  });
  writeStrictNpmrc(fixtureRoot);
  installFixture(fixtureRoot);
  assertPackedPackages({ fixtureRoot, packages });
  assert(
    !existsSync(path.join(fixtureRoot, "node_modules", "hono")),
    "the minimal strict fixture unexpectedly installed hono"
  );
  assertNativeEffectIdentities({ effectVersion, fixtureRoot, packages });
};

/** @param {{ archives: ReadonlyMap<string, string>, effectVersion: string, matrixRoot: string, packages: readonly import("../tooling-types.mjs").PublicPackage[] }} options @returns {void} */
export const verifyAllPlainProjectionsConsumer = ({
  archives,
  effectVersion,
  matrixRoot,
  packages,
}) => {
  const fixtureRoot = path.join(matrixRoot, "effect-4-all-plain");
  mkdirSync(fixtureRoot, { recursive: true });
  writeFixtureManifest({
    dependencies: allProjectionDependencies({
      archives,
      effectVersion,
      packages,
    }),
    fixtureRoot,
    name: "typeweaver-effect-4-all-plain",
    overrides: packedDependenciesFor({ archives, packages }),
  });
  writeStrictNpmrc(fixtureRoot);
  writeConsumerSpec(fixtureRoot);
  installFixture(fixtureRoot);
  assertPackedPackages({ fixtureRoot, packages });
  assertGeneratorEffectPeerContract(fixtureRoot);
  assertNativeEffectIdentities({ effectVersion, fixtureRoot, packages });
  assertPhantomImportsUnavailable(fixtureRoot);
  const { configPath, outputRoot } = writePlainProjectionsConfig(fixtureRoot);
  const generated = run({
    args: [
      "exec",
      "typeweaver",
      "generate",
      "--config",
      configPath,
      "--no-format",
    ],
    cwd: fixtureRoot,
  });
  assert.match(generated, /Successfully loaded/u);
  assertProjectionOutputsExist(outputRoot);
  assertNoForbiddenModuleSpecifiers(outputRoot);
  writeAppModule(fixtureRoot);
  typecheckAndRunApp({ fixtureRoot, outputRoot });
  assertDoctorInFixture(fixtureRoot);
};
