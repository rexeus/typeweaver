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

const validateManifest = (manifest, manifestPath, requiredGroupIds) => {
  const failures =
    manifest.version === 1
      ? []
      : [`${manifestPath} has unsupported version ${String(manifest.version)}`];
  const groups = Array.isArray(manifest.groups) ? manifest.groups : [];
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

  return { failures, groups };
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

  return [...documentFailures, ...fixtureFailures, ...runtimeFixtureFailures];
};

const parseTypeScriptConfig = (workspaceRoot, manifest) => {
  const tsconfigPath = path.resolve(workspaceRoot, manifest.tsconfig);
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
  manifest,
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
          `${group.id}: fixture is not included by ${manifest.tsconfig}: ${fixture}`
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
  const configResult = parseTypeScriptConfig(workspaceRoot, manifest);
  failures.push(...configResult.failures);

  if (configResult.parsedConfig === undefined) {
    return { failures, groups: manifestValidation.groups };
  }

  failures.push(
    ...validateFixtureInclusion(
      manifestValidation.groups,
      workspaceRoot,
      manifest,
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
