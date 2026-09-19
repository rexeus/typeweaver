import { existsSync, readFileSync } from "node:fs";

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

/** @type {(value: unknown) => value is unknown[]} */
const isArray = Array.isArray;

/**
 * @param {unknown} value
 * @returns {value is string}
 */
export const isNonEmptyString = value =>
  typeof value === "string" && value.length > 0;

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
export const isRecord = value =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * @param {readonly string[]} values
 * @returns {Set<string>}
 */
const duplicateValues = values =>
  new Set(values.filter((value, index) => values.indexOf(value) !== index));

/**
 * @param {string} fallbackId
 * @returns {DocumentationGroup}
 */
const emptyGroup = fallbackId => ({
  id: fallbackId,
  documents: [],
  fixtures: [],
  runtimeFixtures: [],
  snippets: [],
});

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
 * @param {{ groupId: string, field: string, value: unknown }} options
 * @returns {{ failures: string[], values: string[] }}
 */
const validateStringArray = ({ groupId, field, value }) => {
  if (!isArray(value)) {
    return {
      failures: [`${groupId}: ${field} must be an array`],
      values: [],
    };
  }

  return {
    failures: value.flatMap((entry, index) =>
      isNonEmptyString(entry)
        ? []
        : [`${groupId}: ${field}[${String(index)}] must be a non-empty string`]
    ),
    values: value.filter(isNonEmptyString),
  };
};

/**
 * @param {{ groupId: string, value: unknown }} options
 * @returns {{ failures: string[], values: DocumentationSnippet[] }}
 */
const validateSnippets = ({ groupId, value }) => {
  if (value === undefined) {
    return { failures: [], values: [] };
  }
  if (!isArray(value)) {
    return {
      failures: [`${groupId}: snippets must be an array`],
      values: [],
    };
  }

  const results = value.map((snippet, index) => {
    const prefix = `${groupId}: snippets[${String(index)}]`;
    if (!isRecord(snippet)) {
      return { failures: [`${prefix} must be an object`], value: undefined };
    }

    const id = snippet["id"];
    const document = snippet["document"];
    const fixture = snippet["fixture"];
    const idValid = isNonEmptyString(id);
    const documentValid = isNonEmptyString(document);
    const fixtureValid = isNonEmptyString(fixture);
    const failures = [
      ...(idValid ? [] : [`${prefix}.id must be a non-empty string`]),
      ...(documentValid
        ? []
        : [`${prefix}.document must be a non-empty string`]),
      ...(fixtureValid ? [] : [`${prefix}.fixture must be a non-empty string`]),
    ];
    return {
      failures,
      value:
        idValid && documentValid && fixtureValid
          ? { id, document, fixture }
          : undefined,
    };
  });

  return {
    failures: results.flatMap(result => result.failures),
    values: results.flatMap(result =>
      result.value === undefined ? [] : [result.value]
    ),
  };
};

/**
 * @param {unknown} group
 * @param {number} index
 * @returns {{ failures: string[], group: DocumentationGroup }}
 */
const validateGroup = (group, index) => {
  const fallbackId = `<group ${String(index)}>`;
  if (!isRecord(group)) {
    return {
      failures: [`${fallbackId} must be an object`],
      group: emptyGroup(fallbackId),
    };
  }

  const rawId = group["id"];
  const id = isNonEmptyString(rawId) ? rawId : fallbackId;
  const documents = validateStringArray({
    groupId: id,
    field: "documents",
    value: group["documents"],
  });
  const fixtures = validateStringArray({
    groupId: id,
    field: "fixtures",
    value: group["fixtures"],
  });
  const runtimeFixtures =
    group["runtimeFixtures"] === undefined
      ? { failures: [], values: [] }
      : validateStringArray({
          groupId: id,
          field: "runtimeFixtures",
          value: group["runtimeFixtures"],
        });
  const snippets = validateSnippets({ groupId: id, value: group["snippets"] });
  const duplicateSnippetIds = duplicateValues(
    snippets.values.map(snippet => snippet.id)
  );

  return {
    failures: [
      ...(id === fallbackId
        ? [`${fallbackId}: id must be a non-empty string`]
        : []),
      ...documents.failures,
      ...fixtures.failures,
      ...runtimeFixtures.failures,
      ...snippets.failures,
      ...Array.from(
        duplicateSnippetIds,
        snippetId => `${id}: duplicate snippet id ${snippetId}`
      ),
    ],
    group: {
      id,
      documents: documents.values,
      fixtures: fixtures.values,
      runtimeFixtures: runtimeFixtures.values,
      snippets: snippets.values,
    },
  };
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
    ? manifest["groups"].map(validateGroup)
    : [];
  const groups = validatedGroups.map(result => result.group);
  if (!isArray(manifest["groups"])) {
    failures.push(`${manifestPath}: groups must be an array`);
  }
  failures.push(...validatedGroups.flatMap(result => result.failures));

  const duplicateGroupIds = duplicateValues(groups.map(group => group.id));
  failures.push(
    ...Array.from(
      duplicateGroupIds,
      groupId => `Duplicate documentation example group: ${groupId}`
    )
  );
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
