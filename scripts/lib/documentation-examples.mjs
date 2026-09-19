import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

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

const readManifest = (absoluteManifestPath, manifestPath) => {
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

const isNonEmptyString = value => typeof value === "string" && value.length > 0;

const isRecord = value =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const validateStringArray = ({ groupId, field, value }) => {
  if (!Array.isArray(value)) {
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

const validateSnippets = ({ groupId, value }) => {
  if (value === undefined) {
    return { failures: [], values: [] };
  }
  if (!Array.isArray(value)) {
    return {
      failures: [`${groupId}: snippets must be an array`],
      values: [],
    };
  }

  const results = value.map((snippet, index) => {
    const prefix = `${groupId}: snippets[${String(index)}]`;
    if (!isRecord(snippet)) {
      return {
        failures: [`${prefix} must be an object`],
        value: undefined,
      };
    }

    const fields = ["id", "document", "fixture"];
    const failures = fields.flatMap(field =>
      isNonEmptyString(snippet[field])
        ? []
        : [`${prefix}.${field} must be a non-empty string`]
    );
    return {
      failures,
      value:
        failures.length === 0
          ? {
              id: snippet.id,
              document: snippet.document,
              fixture: snippet.fixture,
            }
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

const validateGroup = (group, index) => {
  const fallbackId = `<group ${String(index)}>`;
  if (typeof group !== "object" || group === null || Array.isArray(group)) {
    return {
      failures: [`${fallbackId} must be an object`],
      group: {
        id: fallbackId,
        documents: [],
        fixtures: [],
        runtimeFixtures: [],
        snippets: [],
      },
    };
  }

  const id = isNonEmptyString(group.id) ? group.id : fallbackId;
  const documents = validateStringArray({
    groupId: id,
    field: "documents",
    value: group.documents,
  });
  const fixtures = validateStringArray({
    groupId: id,
    field: "fixtures",
    value: group.fixtures,
  });
  const runtimeFixtures =
    group.runtimeFixtures === undefined
      ? { failures: [], values: [] }
      : validateStringArray({
          groupId: id,
          field: "runtimeFixtures",
          value: group.runtimeFixtures,
        });
  const snippets = validateSnippets({ groupId: id, value: group.snippets });
  const snippetIds = snippets.values.map(snippet => snippet.id);
  const duplicateSnippetIds = new Set(
    snippetIds.filter(
      (snippetId, snippetIndex) =>
        snippetIds.indexOf(snippetId) !== snippetIndex
    )
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

const validateManifest = (manifest, manifestPath, requiredGroupIds) => {
  if (!isRecord(manifest)) {
    return {
      failures: [`${manifestPath}: manifest must be a JSON object`],
      groups: [],
      tsconfig: undefined,
    };
  }

  const failures =
    manifest.version === 1
      ? []
      : [`${manifestPath} has unsupported version ${String(manifest.version)}`];
  const tsconfig = isNonEmptyString(manifest.tsconfig)
    ? manifest.tsconfig
    : undefined;
  if (tsconfig === undefined) {
    failures.push(`${manifestPath}: tsconfig must be a non-empty string`);
  }
  const validatedGroups = Array.isArray(manifest.groups)
    ? manifest.groups.map(validateGroup)
    : [];
  const groups = validatedGroups.map(result => result.group);
  if (!Array.isArray(manifest.groups)) {
    failures.push(`${manifestPath}: groups must be an array`);
  }
  failures.push(...validatedGroups.flatMap(result => result.failures));

  const groupIds = groups.map(group => group.id);
  const duplicateGroupIds = new Set(
    groupIds.filter((groupId, index) => groupIds.indexOf(groupId) !== index)
  );

  failures.push(
    ...Array.from(
      duplicateGroupIds,
      groupId => `Duplicate documentation example group: ${groupId}`
    )
  );
  failures.push(
    ...requiredGroupIds
      .filter(groupId => !groupIds.includes(groupId))
      .map(
        groupId => `Missing required documentation example group: ${groupId}`
      )
  );

  return { failures, groups, tsconfig };
};

const normalizeSnippet = source =>
  source.replaceAll("\r\n", "\n").replaceAll("\r", "\n").trimEnd();

const extractDocumentedSnippet = ({ groupId, snippet, documentSource }) => {
  const marker = `<!-- docs-snippet: ${snippet.id} -->`;
  const markerParts = documentSource.split(marker);
  if (markerParts.length !== 2) {
    return {
      failure: `${groupId}: ${snippet.document} must contain exactly one marker ${marker}`,
      source: undefined,
    };
  }

  const sourceBeforeMarker = markerParts[0].trimEnd();
  const fenceMatches = Array.from(
    sourceBeforeMarker.matchAll(
      /(?:^|\n)```(?:ts|typescript)\r?\n([\s\S]*?)\r?\n```/g
    )
  );
  const fenceMatch = fenceMatches.at(-1);
  if (
    fenceMatch?.[1] === undefined ||
    fenceMatch.index === undefined ||
    fenceMatch.index + fenceMatch[0].length !== sourceBeforeMarker.length
  ) {
    return {
      failure: `${groupId}: ${snippet.document} must place a TypeScript code fence immediately before ${marker}`,
      source: undefined,
    };
  }
  return { failure: undefined, source: normalizeSnippet(fenceMatch[1]) };
};

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

const getTypeScriptFailures = (workspaceRoot, parsedConfig) => {
  const program = ts.createProgram(
    parsedConfig.fileNames,
    parsedConfig.options
  );
  return ts
    .getPreEmitDiagnostics(program)
    .map(diagnostic => formatDiagnostic(diagnostic, workspaceRoot));
};

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
