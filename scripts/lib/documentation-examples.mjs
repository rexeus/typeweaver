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

const readJson = filePath => JSON.parse(readFileSync(filePath, "utf8"));

const isNonEmptyString = value => typeof value === "string" && value.length > 0;

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

const validateGroup = (group, index) => {
  const fallbackId = `<group ${String(index)}>`;
  if (typeof group !== "object" || group === null || Array.isArray(group)) {
    return {
      failures: [`${fallbackId} must be an object`],
      group: { id: fallbackId, documents: [], fixtures: [] },
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

  return {
    failures: [
      ...(id === fallbackId
        ? [`${fallbackId}: id must be a non-empty string`]
        : []),
      ...documents.failures,
      ...fixtures.failures,
    ],
    group: {
      id,
      documents: documents.values,
      fixtures: fixtures.values,
    },
  };
};

const validateManifest = (manifest, manifestPath, requiredGroupIds) => {
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

const validateGroupFiles = (group, workspaceRoot) => {
  const marker = `<!-- docs-example: ${group.id} -->`;
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

  return [...documentFailures, ...fixtureFailures];
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
  const manifest = readJson(absoluteManifestPath);
  const manifestValidation = validateManifest(
    manifest,
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
