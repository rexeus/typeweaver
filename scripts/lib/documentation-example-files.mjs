import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/** @typedef {import("./documentation-example-manifest.mjs").DocumentationGroup} DocumentationGroup */
/** @typedef {import("./documentation-example-manifest.mjs").DocumentationSnippet} DocumentationSnippet */

/** @param {string} source @returns {string} */
const normalizeSnippet = source =>
  source.replaceAll("\r\n", "\n").replaceAll("\r", "\n").trimEnd();

/** @param {{ groupId: string, snippet: DocumentationSnippet, documentSource: string }} options @returns {{ failure: string | undefined, source: string | undefined }} */
const extractDocumentedSnippet = ({ groupId, snippet, documentSource }) => {
  const marker = `<!-- docs-snippet: ${snippet.id} -->`;
  const markerParts = documentSource.split(marker);
  if (markerParts.length !== 2) {
    return {
      failure: `${groupId}: ${snippet.document} must contain exactly one marker ${marker}`,
      source: undefined,
    };
  }
  const sourceBeforeMarker = (markerParts[0] ?? "").trimEnd();
  const fenceMatches = Array.from(
    sourceBeforeMarker.matchAll(
      /(?:^|\n)```(?:ts|typescript)\r?\n([\s\S]*?)\r?\n```/g
    )
  );
  const fenceMatch = fenceMatches.at(-1);
  const fenceSource = fenceMatch?.[1];
  if (
    fenceMatch === undefined ||
    fenceSource === undefined ||
    fenceMatch.index === undefined ||
    fenceMatch.index + fenceMatch[0].length !== sourceBeforeMarker.length
  ) {
    return {
      failure: `${groupId}: ${snippet.document} must place a TypeScript code fence immediately before ${marker}`,
      source: undefined,
    };
  }
  return { failure: undefined, source: normalizeSnippet(fenceSource) };
};

/** @param {{ group: DocumentationGroup, snippet: DocumentationSnippet, workspaceRoot: string }} options @returns {string[]} */
const validateSnippet = ({ group, snippet, workspaceRoot }) => {
  const failures = [];
  if (!group.documents.includes(snippet.document)) {
    failures.push(
      `${group.id}: snippet ${snippet.id} document is not registered in the group: ${snippet.document}`
    );
  }
  const documentPath = path.resolve(workspaceRoot, snippet.document);
  const fixturePath = path.resolve(workspaceRoot, snippet.fixture);
  if (!existsSync(fixturePath)) {
    failures.push(`${group.id}: missing snippet fixture ${snippet.fixture}`);
  }
  if (!existsSync(documentPath) || !existsSync(fixturePath)) return failures;
  const extraction = extractDocumentedSnippet({
    groupId: group.id,
    snippet,
    documentSource: readFileSync(documentPath, "utf8"),
  });
  if (extraction.failure !== undefined) {
    failures.push(extraction.failure);
    return failures;
  }
  if (
    extraction.source !== normalizeSnippet(readFileSync(fixturePath, "utf8"))
  ) {
    failures.push(
      `${group.id}: documented snippet ${snippet.id} differs from ${snippet.fixture}`
    );
  }
  return failures;
};

/** @param {DocumentationGroup} group @param {string} workspaceRoot @returns {string[]} */
export const validateGroupFiles = (group, workspaceRoot) => {
  const marker = `<!-- docs-example: ${group.id} -->`;
  const documentFailures = group.documents.flatMap(document => {
    const documentPath = path.resolve(workspaceRoot, document);
    if (!existsSync(documentPath))
      return [`${group.id}: missing document ${document}`];
    return readFileSync(documentPath, "utf8").includes(marker)
      ? []
      : [`${group.id}: ${document} is missing marker ${marker}`];
  });
  const fixtureFailures = group.fixtures
    .filter(fixture => !existsSync(path.resolve(workspaceRoot, fixture)))
    .map(fixture => `${group.id}: missing fixture ${fixture}`);
  const runtimeFixtureFailures = group.runtimeFixtures
    .filter(fixture => !existsSync(path.resolve(workspaceRoot, fixture)))
    .map(fixture => `${group.id}: missing runtime fixture ${fixture}`);
  return [
    ...documentFailures,
    ...fixtureFailures,
    ...runtimeFixtureFailures,
    ...group.snippets.flatMap(snippet =>
      validateSnippet({ group, snippet, workspaceRoot })
    ),
  ];
};
