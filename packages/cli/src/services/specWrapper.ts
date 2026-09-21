import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  coordinationArtifactMarkerSource,
  SPEC_BUNDLER_TEMP_DIRECTORY_PREFIX,
  TYPEWEAVER_COORDINATION_MARKER_FILE,
} from "@rexeus/typeweaver-gen";
import { Effect, FileSystem } from "effect";
import { makeBundleError } from "./specBundlerTypes.js";
import type {
  BundleOperation,
  FileUrlConverter,
  SpecBundlerConfig,
  SpecBundlerDeps,
} from "./specBundlerTypes.js";

const WINDOWS_ABSOLUTE_PATH_PATTERN = /^[A-Za-z]:[\\/]/;
const WINDOWS_UNC_PATH_PATTERN = /^\\\\/;

export const createWrapperImportSpecifierWith = (
  wrapperFile: string,
  inputFile: string,
  realpathSync: (filePath: string) => string,
  toFileUrl: FileUrlConverter = pathToFileURL
): string => {
  const absoluteInputFile = resolveBundledInputFile(inputFile);
  const useWindowsPathSemantics = usesWindowsPathSemantics(
    wrapperFile,
    absoluteInputFile
  );
  const pathModule = useWindowsPathSemantics ? path.win32 : path.posix;
  const wrapperDir = useWindowsPathSemantics
    ? pathModule.dirname(wrapperFile)
    : resolveRealFilePath(pathModule.dirname(wrapperFile), realpathSync);
  const resolvedInputFile = useWindowsPathSemantics
    ? absoluteInputFile
    : resolveRealFilePath(absoluteInputFile, realpathSync);
  const relativeInputFile = pathModule.relative(wrapperDir, resolvedInputFile);
  if (pathModule.isAbsolute(relativeInputFile)) {
    return toFileUrl(resolvedInputFile).href;
  }
  const posixRelative = relativeInputFile.replaceAll(pathModule.sep, "/");
  return posixRelative.startsWith(".") || posixRelative.startsWith("..")
    ? posixRelative
    : `./${posixRelative}`;
};

export const createWrapperImportSpecifier = (
  wrapperFile: string,
  inputFile: string
): string =>
  createWrapperImportSpecifierWith(
    wrapperFile,
    inputFile,
    fs.realpathSync.native,
    pathToFileURL
  );

const resolveBundledInputFile = (inputFile: string): string => {
  if (path.isAbsolute(inputFile)) return inputFile;
  if (WINDOWS_ABSOLUTE_PATH_PATTERN.test(inputFile)) {
    return path.win32.normalize(inputFile);
  }
  if (WINDOWS_UNC_PATH_PATTERN.test(inputFile)) {
    return path.win32.normalize(inputFile);
  }
  return path.resolve(inputFile);
};

const usesWindowsPathSemantics = (...filePaths: string[]): boolean =>
  filePaths.some(
    filePath =>
      WINDOWS_ABSOLUTE_PATH_PATTERN.test(filePath) ||
      WINDOWS_UNC_PATH_PATTERN.test(filePath)
  );

const resolveRealFilePath = (
  filePath: string,
  realpathSync: (filePath: string) => string
): string => (fs.existsSync(filePath) ? realpathSync(filePath) : filePath);

const buildWrapperSource = (wrapperImportSpecifier: string): string =>
  [
    `import * as specModule from ${JSON.stringify(wrapperImportSpecifier)};`,
    "const resolvedSpec =",
    '  Reflect.get(specModule, "spec") ??',
    '  Reflect.get(specModule, "default") ??',
    "  specModule;",
    "",
    "export const spec = resolvedSpec;",
    "",
  ].join("\n");

export const makeBundlePaths = (
  config: SpecBundlerConfig,
  tempDir: string,
  deps: SpecBundlerDeps
) => ({
  wrapperFile: path.join(tempDir, "spec-entrypoint.ts"),
  stagedSpecFile: path.join(tempDir, "spec.js"),
  bundledSpecFile: path.join(config.specOutputDir, "spec.js"),
  wrapperImportSpecifier: createWrapperImportSpecifierWith(
    path.join(tempDir, "spec-entrypoint.ts"),
    config.inputFile,
    deps.realpathSync ?? fs.realpathSync.native,
    deps.toFileUrl
  ),
});

export const prepareBundleDirectory = Effect.fn(function* (params: {
  readonly config: SpecBundlerConfig;
  readonly fileSystem: FileSystem.FileSystem;
}) {
  const mapError = makeBundleError(params.config.inputFile);
  yield* params.fileSystem
    .makeDirectory(params.config.specOutputDir, { recursive: true })
    .pipe(Effect.mapError(mapError));
  const tempDir = yield* params.fileSystem
    .makeTempDirectoryScoped({
      directory: params.config.specOutputDir,
      prefix: SPEC_BUNDLER_TEMP_DIRECTORY_PREFIX,
    })
    .pipe(Effect.mapError(mapError));
  yield* params.fileSystem
    .writeFileString(
      path.join(tempDir, TYPEWEAVER_COORDINATION_MARKER_FILE),
      coordinationArtifactMarkerSource("spec-bundler-temp"),
      { flag: "wx", mode: 0o600 }
    )
    .pipe(Effect.mapError(mapError));
  return tempDir;
});

export const writeBundleWrapper = Effect.fn(function* (
  operation: BundleOperation
) {
  yield* operation.fileSystem
    .writeFileString(
      operation.paths.wrapperFile,
      buildWrapperSource(operation.paths.wrapperImportSpecifier)
    )
    .pipe(Effect.mapError(makeBundleError(operation.config.inputFile)));
});
