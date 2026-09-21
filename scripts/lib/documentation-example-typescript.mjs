import path from "node:path";
import ts from "typescript";

/** @param {ts.Diagnostic} diagnostic @param {string} workspaceRoot @returns {string} */
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

/** @param {string} workspaceRoot @param {string} tsconfig @returns {{ failures: string[], parsedConfig: ts.ParsedCommandLine | undefined }} */
export const parseTypeScriptConfig = (workspaceRoot, tsconfig) => {
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
    failures: parsedConfig.errors.map(error =>
      formatDiagnostic(error, workspaceRoot)
    ),
    parsedConfig,
  };
};

/** @param {readonly import("./documentation-example-manifest.mjs").DocumentationGroup[]} groups @param {string} workspaceRoot @param {string} tsconfig @param {ts.ParsedCommandLine} parsedConfig @returns {string[]} */
export const validateFixtureInclusion = (
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

/** @param {string} workspaceRoot @param {ts.ParsedCommandLine} parsedConfig @returns {string[]} */
export const getTypeScriptFailures = (workspaceRoot, parsedConfig) =>
  ts
    .getPreEmitDiagnostics(
      ts.createProgram(parsedConfig.fileNames, parsedConfig.options)
    )
    .map(diagnostic => formatDiagnostic(diagnostic, workspaceRoot));
