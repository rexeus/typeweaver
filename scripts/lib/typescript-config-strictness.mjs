import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { strictOptionMatrix } from "./typescript-toolchain-probes.mjs";

/**
 * Strictness options every repository compiler configuration must keep at the
 * value `packages/tsconfig/base.json` resolves to. A package, example, fixture,
 * or tooling tsconfig may add options but never relax one of these.
 */
export const strictnessOptionNames = [
  ...strictOptionMatrix,
  "allowUnreachableCode",
  "forceConsistentCasingInFileNames",
];

/**
 * Lists every tracked or new, non-ignored `tsconfig*.json` so a configuration
 * added before its first commit is checked as well.
 *
 * @param {string} workspaceRoot
 * @returns {string[]} workspace-relative POSIX paths
 */
export const listTsconfigFiles = workspaceRoot => {
  const result = spawnSync(
    "git",
    ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
    { cwd: workspaceRoot, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
  );
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0)
    throw new Error(
      `git ls-files failed with exit code ${String(result.status)}`
    );
  return [...new Set(result.stdout.split("\0"))]
    .filter(
      file =>
        /^tsconfig[^/]*\.json$/u.test(path.posix.basename(file)) &&
        existsSync(path.join(workspaceRoot, file))
    )
    .sort();
};

/**
 * @param {Record<string, unknown>} options effective compiler options
 * @param {Record<string, unknown>} baseOptions effective base-profile options
 * @returns {string[]} strictness options whose effective value differs
 */
export const weakenedStrictnessOptions = (options, baseOptions) =>
  strictnessOptionNames.filter(name => options[name] !== baseOptions[name]);

/**
 * @typedef {object} StrictnessCheck
 * @property {string} workspaceRoot
 * @property {Record<string, unknown>} baseOptions
 * @property {(configPath: string) => Record<string, unknown>} effectiveOptions
 */

/**
 * @param {StrictnessCheck} check
 * @param {readonly string[]} configs workspace-relative tsconfig paths
 * @returns {void}
 */
const assertTsconfigsKeepStrictness = (check, configs) => {
  const failures = configs.flatMap(config => {
    const weakened = weakenedStrictnessOptions(
      check.effectiveOptions(config),
      check.baseOptions
    );
    return weakened.length === 0 ? [] : [`${config}: ${weakened.join(", ")}`];
  });
  assert.deepEqual(
    failures,
    [],
    `tsconfig files relax base strictness:\n${failures.join("\n")}`
  );
};

/**
 * @param {StrictnessCheck} check
 * @returns {number} the number of checked configurations
 */
export const assertEveryTsconfigKeepsStrictness = check => {
  const configs = listTsconfigFiles(check.workspaceRoot);
  for (const required of ["tsconfig.json", "packages/server/tsconfig.json"])
    assert.ok(configs.includes(required), `${required} was not discovered`);
  assertTsconfigsKeepStrictness(check, configs);
  return configs.length;
};

/**
 * Mutation probe: a new configuration layered on `packages/server/tsconfig.json`
 * that disables `exactOptionalPropertyTypes` must be discovered and rejected.
 *
 * @param {StrictnessCheck} check
 * @returns {void}
 */
export const assertStrictnessWeakeningRejected = check => {
  const probeRoot = mkdtempSync(
    path.join(check.workspaceRoot, "packages", "server", ".tsconfig-probe-")
  );
  try {
    writeFileSync(
      path.join(probeRoot, "tsconfig.json"),
      JSON.stringify({
        extends: "../tsconfig.json",
        compilerOptions: { exactOptionalPropertyTypes: false },
      })
    );
    const probe = path
      .relative(check.workspaceRoot, path.join(probeRoot, "tsconfig.json"))
      .split(path.sep)
      .join("/");
    assert.ok(
      listTsconfigFiles(check.workspaceRoot).includes(probe),
      `the strictness check did not discover ${probe}`
    );
    assert.throws(
      () => assertTsconfigsKeepStrictness(check, [probe]),
      /tsconfig-probe-[^:]*: exactOptionalPropertyTypes$/mu,
      "disabling exactOptionalPropertyTypes in a package tsconfig must be rejected"
    );
  } finally {
    rmSync(probeRoot, { recursive: true, force: true });
  }
};
