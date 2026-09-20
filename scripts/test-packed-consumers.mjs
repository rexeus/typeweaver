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
  verifyAllPlainProjectionsConsumer,
  verifyDuplicateGuard,
  verifyNativeEffectStrictPeerNegative,
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
    const supportedVersions = new Set([contract.runtimeVersion]);

    for (const effectVersion of supportedVersions) {
      verifySupportedConsumer({
        archives,
        effectVersion,
        matrixRoot,
        packages,
      });
    }
    verifyDuplicateGuard({ archives, matrixRoot, packages });
    const nativeEffectVersion = contract.runtimeVersion;
    verifyMinimalStrictInstall({
      archives,
      effectVersion: nativeEffectVersion,
      matrixRoot,
      packages,
    });
    verifyAllPlainProjectionsConsumer({
      archives,
      effectVersion: nativeEffectVersion,
      matrixRoot,
      packages,
    });
    verifyNativeEffectStrictPeerNegative({
      archives,
      matrixRoot,
      packages,
    });
    process.stdout.write(
      `Packed consumer and plugin scaffold matrix verified for native Effect ${Array.from(supportedVersions).join(", ")}; duplicate identity rejected; strict-peer negative verified\n`
    );
  } finally {
    rmSync(matrixRoot, { recursive: true });
  }
};

main();
