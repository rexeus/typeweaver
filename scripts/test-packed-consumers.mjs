import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import {
  collectPublishablePackages,
  contract,
  packWorkspace,
} from "./lib/packed-consumers/runtime.mjs";
import { verifyGeneratedImportScanner } from "./lib/packed-consumers/scanner.mjs";
import {
  peerLowerBound,
  verifyAllPlainProjectionsConsumer,
  verifyDuplicateGuard,
  verifyEffect4StrictPeerNegative,
  verifyMinimalStrictInstall,
  verifySupportedConsumer,
} from "./lib/packed-consumers/scenarios.mjs";

const main = () => {
  const matrixRoot = mkdtempSync(
    path.join(tmpdir(), "typeweaver-packed-consumers-")
  );
  try {
    const archiveRoot = path.join(matrixRoot, "archives");
    mkdirSync(archiveRoot);
    verifyGeneratedImportScanner();
    const packages = collectPublishablePackages();
    const archives = packWorkspace({ archiveRoot, packages });
    const supportedVersions = new Set([
      contract.runtimeVersion,
      peerLowerBound(contract.peerRange),
    ]);

    for (const effectVersion of supportedVersions) {
      verifySupportedConsumer({
        archives,
        effectVersion,
        matrixRoot,
        packages,
      });
    }
    verifyDuplicateGuard({ archives, matrixRoot, packages });
    const effect4EvidenceVersion = contract.effect4Evidence?.effectVersion;
    assert(
      typeof effect4EvidenceVersion === "string",
      "config/effect-baseline.json must pin effect4Evidence.effectVersion"
    );
    verifyMinimalStrictInstall({
      archives,
      effectVersion: effect4EvidenceVersion,
      matrixRoot,
      packages,
    });
    verifyAllPlainProjectionsConsumer({
      archives,
      effectVersion: effect4EvidenceVersion,
      matrixRoot,
      packages,
    });
    verifyEffect4StrictPeerNegative({
      archives,
      effectVersion: effect4EvidenceVersion,
      matrixRoot,
      packages,
    });
    process.stdout.write(
      `Packed consumer and plugin scaffold matrix verified for Effect ${Array.from(supportedVersions).join(", ")}; duplicate identity rejected; Effect ${effect4EvidenceVersion} minimal strict install, all plain projections, and strict-peer negative verified\n`
    );
  } finally {
    rmSync(matrixRoot, { recursive: true });
  }
};

main();
