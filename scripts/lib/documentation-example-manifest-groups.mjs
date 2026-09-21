import {
  isArray,
  isNonEmptyString,
  isRecord,
} from "./documentation-example-manifest-values.mjs";

/** @typedef {import("./documentation-example-manifest.mjs").DocumentationGroup} DocumentationGroup */
/** @typedef {import("./documentation-example-manifest.mjs").DocumentationSnippet} DocumentationSnippet */
/** @typedef {{ failures: string[], values: string[] }} StringArrayResult */
/** @typedef {{ failures: string[], values: DocumentationSnippet[] }} SnippetResult */
/** @typedef {{ failures: string[], group: DocumentationGroup }} GroupResult */

/** @param {readonly string[]} values @returns {Set<string>} */
const duplicateValues = values =>
  new Set(values.filter((value, index) => values.indexOf(value) !== index));

/** @param {string} fallbackId @returns {DocumentationGroup} */
const emptyGroup = fallbackId => ({
  id: fallbackId,
  documents: [],
  fixtures: [],
  runtimeFixtures: [],
  snippets: [],
});

/** @param {{ groupId: string, field: string, value: unknown }} options @returns {StringArrayResult} */
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

/** @param {{ groupId: string, value: unknown }} options @returns {SnippetResult} */
const validateSnippets = ({ groupId, value }) => {
  if (value === undefined) return { failures: [], values: [] };
  if (!isArray(value)) {
    return { failures: [`${groupId}: snippets must be an array`], values: [] };
  }
  const results = value.map((snippet, index) => {
    const prefix = `${groupId}: snippets[${String(index)}]`;
    if (!isRecord(snippet)) {
      return { failures: [`${prefix} must be an object`], value: undefined };
    }
    const id = snippet["id"];
    const document = snippet["document"];
    const fixture = snippet["fixture"];
    const failures = [
      ...(isNonEmptyString(id)
        ? []
        : [`${prefix}.id must be a non-empty string`]),
      ...(isNonEmptyString(document)
        ? []
        : [`${prefix}.document must be a non-empty string`]),
      ...(isNonEmptyString(fixture)
        ? []
        : [`${prefix}.fixture must be a non-empty string`]),
    ];
    return {
      failures,
      value:
        isNonEmptyString(id) &&
        isNonEmptyString(document) &&
        isNonEmptyString(fixture)
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

/** @param {unknown} group @param {number} index @returns {GroupResult} */
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

/** @param {unknown[]} groups @returns {{ failures: string[], groups: DocumentationGroup[] }} */
export const validateGroups = groups => {
  const results = groups.map(validateGroup);
  const values = results.map(result => result.group);
  const duplicateGroupIds = duplicateValues(values.map(group => group.id));
  return {
    failures: [
      ...results.flatMap(result => result.failures),
      ...Array.from(
        duplicateGroupIds,
        groupId => `Duplicate documentation example group: ${groupId}`
      ),
    ],
    groups: values,
  };
};
