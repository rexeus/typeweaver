import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import {
  readManifest,
  validateManifest,
} from "./documentation-example-manifest.mjs";

/** @typedef {import("./documentation-example-manifest.mjs").DocumentationGroup} DocumentationGroup */
/** @typedef {import("./documentation-example-manifest.mjs").DocumentationSnippet} DocumentationSnippet */

/** @typedef {{ failures: string[], parsedConfig: ts.ParsedCommandLine | undefined }} ParsedConfigResult */
/** @typedef {{ failure: string | undefined, source: string | undefined }} SnippetExtraction */

/**
 * @param {ts.Diagnostic} diagnostic
 * @param {string} workspaceRoot
 * @returns {string}
 */
const formatDiagnostic = (diagnostic, workspaceRoot) => {
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
  if (diagnostic.file === undefined || diagnostic.start === undefined) {
    return `TS${diagnostic.code}: ${message}`;
  }

  const position = diagnostic.file.getLineAndCharacterOfPosition(
    diagnostic.start
  );
  const file = path.relative(workspaceRoot, diagnostic.file.fileName);
  return `${file}:${position.line + 1}:${position.character + 1} TS${diagnostic.code}: ${message}`;
};

/**
 * @param {string} source
 * @returns {string}
 */
const normalizeSnippet = source =>
  source.replaceAll("\r\n", "\n").replaceAll("\r", "\n").trimEnd();

/**
 * @param {{ groupId: string, snippet: DocumentationSnippet, documentSource: string }} options
 * @returns {SnippetExtraction}
 */
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

/**
 * @param {{ group: DocumentationGroup, snippet: DocumentationSnippet, workspaceRoot: string }} options
 * @returns {string[]}
 */
const validateSnippet = ({ group, snippet, workspaceRoot }) => {
  /** @type {string[]} */
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
  if (!existsSync(documentPath) || !existsSync(fixturePath)) {
    return failures;
  }

  const extraction = extractDocumentedSnippet({
    groupId: group.id,
    snippet,
    documentSource: readFileSync(documentPath, "utf8"),
  });
  if (extraction.failure !== undefined) {
    failures.push(extraction.failure);
    return failures;
  }

  const fixtureSnippet = normalizeSnippet(readFileSync(fixturePath, "utf8"));
  if (extraction.source !== fixtureSnippet) {
    failures.push(
      `${group.id}: documented snippet ${snippet.id} differs from ${snippet.fixture}`
    );
  }
  return failures;
};

/**
 * @param {DocumentationGroup} group
 * @param {string} workspaceRoot
 * @returns {string[]}
 */
const validateGroupFiles = (group, workspaceRoot) => {
  const marker = `<!-- docs-example: ${group.id} -->`;
  const runtimeFixtures = Array.isArray(group.runtimeFixtures)
    ? group.runtimeFixtures
    : [];
  const documentFailures = group.documents.flatMap(document => {
    const documentPath = path.resolve(workspaceRoot, document);
    if (!existsSync(documentPath)) {
      return [`${group.id}: missing document ${document}`];
    }
    return readFileSync(documentPath, "utf8").includes(marker)
      ? []
      : [`${group.id}: ${document} is missing marker ${marker}`];
  });
  const fixtureFailures = group.fixtures
    .filter(fixture => !existsSync(path.resolve(workspaceRoot, fixture)))
    .map(fixture => `${group.id}: missing fixture ${fixture}`);
  const runtimeFixtureFailures = runtimeFixtures
    .filter(fixture => !existsSync(path.resolve(workspaceRoot, fixture)))
    .map(fixture => `${group.id}: missing runtime fixture ${fixture}`);
  const snippetFailures = group.snippets.flatMap(snippet =>
    validateSnippet({ group, snippet, workspaceRoot })
  );

  return [
    ...documentFailures,
    ...fixtureFailures,
    ...runtimeFixtureFailures,
    ...snippetFailures,
  ];
};

/**
 * @param {string} workspaceRoot
 * @param {string} tsconfig
 * @returns {ParsedConfigResult}
 */
const parseTypeScriptConfig = (workspaceRoot, tsconfig) => {
  const tsconfigPath = path.resolve(workspaceRoot, tsconfig);
  const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
  if (configFile.error !== undefined) {
    return {
      failures: [formatDiagnostic(configFile.error, workspaceRoot)],
      parsedConfig: undefined,
    };
  }

  const parsedConfig = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    path.dirname(tsconfigPath),
    { noEmit: true },
    tsconfigPath
  );
  return {
    failures: parsedConfig.errors.map(diagnostic =>
      formatDiagnostic(diagnostic, workspaceRoot)
    ),
    parsedConfig,
  };
};

/**
 * @param {readonly DocumentationGroup[]} groups
 * @param {string} workspaceRoot
 * @param {string} tsconfig
 * @param {ts.ParsedCommandLine} parsedConfig
 * @returns {string[]}
 */
const validateFixtureInclusion = (
  groups,
  workspaceRoot,
  tsconfig,
  parsedConfig
) => {
  const compiledFiles = new Set(
    parsedConfig.fileNames.map(fileName => path.resolve(fileName))
  );
  return groups.flatMap(group =>
    group.fixtures
      .filter(
        fixture => !compiledFiles.has(path.resolve(workspaceRoot, fixture))
      )
      .map(
        fixture =>
          `${group.id}: fixture is not included by ${tsconfig}: ${fixture}`
      )
  );
};

/**
 * @param {string} workspaceRoot
 * @param {ts.ParsedCommandLine} parsedConfig
 * @returns {string[]}
 */
const getTypeScriptFailures = (workspaceRoot, parsedConfig) => {
  const program = ts.createProgram(
    parsedConfig.fileNames,
    parsedConfig.options
  );
  return ts
    .getPreEmitDiagnostics(program)
    .map(diagnostic => formatDiagnostic(diagnostic, workspaceRoot));
};

/**
 * @param {{
 *   workspaceRoot: string,
 *   manifestPath: string,
 *   requiredGroupIds: readonly string[],
 * }} options
 * @returns {{ failures: string[], groups: DocumentationGroup[] }}
 */
export const verifyDocumentationExamples = ({
  workspaceRoot,
  manifestPath,
  requiredGroupIds,
}) => {
  const absoluteManifestPath = path.resolve(workspaceRoot, manifestPath);
  const manifestResult = readManifest(absoluteManifestPath, manifestPath);
  if (manifestResult.manifest === undefined) {
    return { failures: manifestResult.failures, groups: [] };
  }

  const manifestValidation = validateManifest(
    manifestResult.manifest,
    manifestPath,
    requiredGroupIds
  );
  const failures = [
    ...manifestValidation.failures,
    ...manifestValidation.groups.flatMap(group =>
      validateGroupFiles(group, workspaceRoot)
    ),
  ];
  if (manifestValidation.tsconfig === undefined) {
    return { failures, groups: manifestValidation.groups };
  }

  const configResult = parseTypeScriptConfig(
    workspaceRoot,
    manifestValidation.tsconfig
  );
  failures.push(...configResult.failures);

  if (configResult.parsedConfig === undefined) {
    return { failures, groups: manifestValidation.groups };
  }

  failures.push(
    ...validateFixtureInclusion(
      manifestValidation.groups,
      workspaceRoot,
      manifestValidation.tsconfig,
      configResult.parsedConfig
    )
  );
  if (configResult.failures.length > 0) {
    return { failures, groups: manifestValidation.groups };
  }

  failures.push(
    ...getTypeScriptFailures(workspaceRoot, configResult.parsedConfig)
  );
  return { failures, groups: manifestValidation.groups };
};
