import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import path from "node:path";
import {
  ZOD_VERSION,
  packedDependenciesFor,
  writeConsumerManifest,
  writeFixtureManifest,
  writeStrictNpmrc,
} from "./fixtures.mjs";
import { assertSingleEffectIdentity } from "./graph.mjs";
import { contract, installFixture, runExpectFailure } from "./runtime.mjs";

/** @param {{ archives: ReadonlyMap<string, string>, matrixRoot: string, packages: readonly import("../tooling-types.mjs").PublicPackage[] }} options @returns {void} */
export const verifyDuplicateGuard = ({ archives, matrixRoot, packages }) => {
  const fixtureRoot = path.join(matrixRoot, "duplicate-effect");
  mkdirSync(fixtureRoot, { recursive: true });
  writeConsumerManifest({
    archives,
    effectVersion: contract.runtimeVersion,
    fixtureRoot,
    packages,
    pluginEffectVersion: "3.21.2",
  });
  installFixture(fixtureRoot);
  assert.throws(
    () =>
      assertSingleEffectIdentity({
        effectVersion: contract.runtimeVersion,
        fixtureRoot,
        packages,
      }),
    /multiple Effect identities detected/
  );
};

/** @param {{ archives: ReadonlyMap<string, string>, matrixRoot: string, packages: readonly import("../tooling-types.mjs").PublicPackage[] }} options @returns {void} */
export const verifyNativeEffectStrictPeerNegative = ({
  archives,
  matrixRoot,
  packages,
}) => {
  const incompatibleEffectVersion = "4.0.0-rc.115";
  assert.notEqual(
    incompatibleEffectVersion,
    contract.runtimeVersion,
    "strict-peer negative Effect version must differ from the runtime contract"
  );
  const fixtureRoot = path.join(
    matrixRoot,
    "native-effect-strict-peer-negative"
  );
  mkdirSync(fixtureRoot, { recursive: true });
  const packedDependencies = packedDependenciesFor({ archives, packages });
  writeFixtureManifest({
    fixtureRoot,
    name: "typeweaver-native-effect-strict-peer-negative",
    overrides: packedDependencies,
    dependencies: {
      "@rexeus/typeweaver-core": packedDependencies["@rexeus/typeweaver-core"],
      "@rexeus/typeweaver-effect":
        packedDependencies["@rexeus/typeweaver-effect"],
      "@rexeus/typeweaver-gen": packedDependencies["@rexeus/typeweaver-gen"],
      "@rexeus/typeweaver-server":
        packedDependencies["@rexeus/typeweaver-server"],
      effect: incompatibleEffectVersion,
      zod: ZOD_VERSION,
    },
  });
  writeStrictNpmrc(fixtureRoot);
  const output = runExpectFailure({
    args: ["install", "--ignore-scripts"],
    cwd: fixtureRoot,
  });
  assert(
    output.includes(`effect@${contract.runtimeVersion}`),
    `strict-peer install did not fail on the exact native Effect peer:\n${output}`
  );
  assert.match(
    output,
    /unmet peer|PEER_DEP_ISSUES/iu,
    `strict-peer install did not fail as a peer conflict:\n${output}`
  );
};

/** @param {string} peerRange @returns {string} */
export const peerVersion = peerRange => {
  assert(
    peerRange === contract.runtimeVersion,
    `unsupported Effect peer contract: ${peerRange}`
  );
  return peerRange;
};
