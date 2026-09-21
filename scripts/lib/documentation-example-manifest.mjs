import { existsSync, readFileSync } from "node:fs";
import { validateGroups } from "./documentation-example-manifest-groups.mjs";
import {
  isArray,
  isNonEmptyString,
  isRecord,
} from "./documentation-example-manifest-values.mjs";

/**
 * @typedef {object} DocumentationSnippet
 * @property {string} id
 * @property {string} document
 * @property {string} fixture
 *
 * @typedef {object} DocumentationGroup
 * @property {string} id
 * @property {string[]} documents
 * @property {string[]} fixtures
 * @property {string[]} runtimeFixtures
 * @property {DocumentationSnippet[]} snippets
 *
 * @typedef {object} ReadManifestResult
 * @property {string[]} failures
 * @property {unknown} manifest
 *
 * @typedef {object} ValidatedManifest
 * @property {string[]} failures
 * @property {DocumentationGroup[]} groups
 * @property {string | undefined} tsconfig
 */

export { isNonEmptyString, isRecord };

/**
 * @param {string} absoluteManifestPath
 * @param {string} manifestPath
 * @returns {ReadManifestResult}
 */
export const readManifest = (absoluteManifestPath, manifestPath) => {
  if (!existsSync(absoluteManifestPath)) {
    return {
      failures: [`${manifestPath}: manifest file does not exist`],
      manifest: undefined,
    };
  }

  let source;
  try {
    source = readFileSync(absoluteManifestPath, "utf8");
  } catch {
    return {
      failures: [`${manifestPath}: manifest file could not be read`],
      manifest: undefined,
    };
  }

  try {
    return { failures: [], manifest: JSON.parse(source) };
  } catch {
    return {
      failures: [`${manifestPath}: manifest contains invalid JSON`],
      manifest: undefined,
    };
  }
};

/**
 * @param {unknown} manifest
 * @param {string} manifestPath
 * @param {readonly string[]} requiredGroupIds
 * @returns {ValidatedManifest}
 */
export const validateManifest = (manifest, manifestPath, requiredGroupIds) => {
  if (!isRecord(manifest)) {
    return {
      failures: [`${manifestPath}: manifest must be a JSON object`],
      groups: [],
      tsconfig: undefined,
    };
  }

  const failures =
    manifest["version"] === 1
      ? []
      : [
          `${manifestPath} has unsupported version ${String(manifest["version"])}`,
        ];
  const tsconfig = isNonEmptyString(manifest["tsconfig"])
    ? manifest["tsconfig"]
    : undefined;
  if (tsconfig === undefined) {
    failures.push(`${manifestPath}: tsconfig must be a non-empty string`);
  }
  const validatedGroups = isArray(manifest["groups"])
    ? validateGroups(manifest["groups"])
    : { failures: [], groups: [] };
  const groups = validatedGroups.groups;
  if (!isArray(manifest["groups"])) {
    failures.push(`${manifestPath}: groups must be an array`);
  }
  failures.push(...validatedGroups.failures);
  const groupIds = groups.map(group => group.id);
  failures.push(
    ...requiredGroupIds
      .filter(groupId => !groupIds.includes(groupId))
      .map(
        groupId => `Missing required documentation example group: ${groupId}`
      )
  );

  return { failures, groups, tsconfig };
};
