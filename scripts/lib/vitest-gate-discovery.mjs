import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * Discovers package scripts that select Vitest suites by path; the filter
 * contract they must follow lives in vitest-gate-filters.mjs.
 */

/** @typedef {import("./tooling-types.mjs").PackageManifest} PackageManifest */

/**
 * @typedef {object} VitestInvocation
 * @property {string | undefined} packageName Package selected by `pnpm --filter`.
 * @property {string[]} filters Positional Vitest file filters.
 */

/**
 * @typedef {object} VitestGate
 * @property {string} label Script location, such as `package.json#test:tooling`.
 * @property {string | undefined} rootDirectory Directory Vitest runs in.
 * @property {readonly string[]} filters
 */

const VITEST_SUBCOMMANDS = new Set([
  "bench",
  "list",
  "related",
  "run",
  "watch",
]);
const VALUE_FLAGS = new Set([
  "--config",
  "--dir",
  "--exclude",
  "--outputFile",
  "--project",
  "--reporter",
  "--root",
  "--testNamePattern",
  "-c",
  "-r",
  "-t",
]);

/**
 * @param {readonly string[]} tokens Arguments after the `vitest` binary.
 * @returns {string[]}
 */
const positionalArguments = tokens => {
  /** @type {string[]} */
  const filters = [];
  let skipValue = false;
  for (const [index, token] of tokens.entries()) {
    if (skipValue) {
      skipValue = false;
    } else if (token.startsWith("-")) {
      skipValue = VALUE_FLAGS.has(token);
    } else if (index > 0 || !VITEST_SUBCOMMANDS.has(token)) {
      filters.push(token);
    }
  }
  return filters;
};

/**
 * @param {string} command A package.json script.
 * @returns {VitestInvocation[]}
 */
export const parseVitestInvocations = command =>
  command
    .split("&&")
    .map(segment => segment.trim().split(/\s+/u))
    .filter(tokens => tokens.includes("vitest"))
    .map(tokens => {
      const vitestIndex = tokens.indexOf("vitest");
      const filterIndex = tokens.indexOf("--filter");
      return {
        packageName:
          filterIndex !== -1 && filterIndex < vitestIndex
            ? tokens[filterIndex + 1]
            : undefined,
        filters: positionalArguments(tokens.slice(vitestIndex + 1)),
      };
    });

/**
 * @param {string} filePath
 * @returns {PackageManifest}
 */
const readManifest = filePath => JSON.parse(readFileSync(filePath, "utf8"));

/**
 * @param {string} workspaceRoot
 * @returns {string[]} Manifest paths relative to the workspace root.
 */
const workspaceManifests = workspaceRoot => [
  "package.json",
  ...readdirSync(path.join(workspaceRoot, "packages"), { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => `packages/${entry.name}/package.json`)
    .filter(manifest => existsSync(path.join(workspaceRoot, manifest))),
];

/**
 * Discovers every package script that passes file filters to Vitest.
 *
 * @param {string} workspaceRoot
 * @returns {VitestGate[]}
 */
export const collectVitestGates = workspaceRoot => {
  const manifests = workspaceManifests(workspaceRoot).map(relativePath => ({
    relativePath,
    directory: path.dirname(path.join(workspaceRoot, relativePath)),
    manifest: readManifest(path.join(workspaceRoot, relativePath)),
  }));
  const directoriesByName = new Map(
    manifests.map(({ manifest, directory }) => [manifest.name, directory])
  );
  return manifests.flatMap(({ relativePath, directory, manifest }) =>
    Object.entries(manifest.scripts ?? {}).flatMap(([name, command]) =>
      parseVitestInvocations(command)
        .filter(invocation => invocation.filters.length > 0)
        .map(invocation => ({
          label: `${relativePath}#${name}`,
          rootDirectory:
            invocation.packageName === undefined
              ? directory
              : directoriesByName.get(invocation.packageName),
          filters: invocation.filters,
        }))
    )
  );
};
