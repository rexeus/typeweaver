import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { validateEffectPackageVersions } from "./lib/effect-version-contract.mjs";

const fixtureRoot = mkdtempSync(
  path.join(tmpdir(), "typeweaver-effect-contract-")
);
const packageRoot = path.join(fixtureRoot, "packages", "runtime");
const installedEffectRoot = path.join(packageRoot, "node_modules", "effect");
const writeJson = (filePath, value) =>
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);

try {
  mkdirSync(installedEffectRoot, { recursive: true });
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
} finally {
  rmSync(fixtureRoot, { recursive: true });
}

process.stdout.write(
  "Effect package contract guard rejected the Effect 4 fixture\n"
);
