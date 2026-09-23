import path from "node:path";
import {
  coordinationArtifactKindForTempDirectoryName,
  matchesCoordinationArtifactMarker,
  TYPEWEAVER_COORDINATION_MARKER_FILE,
} from "@rexeus/typeweaver-gen";
import { Effect, FileSystem, Result } from "effect";
import {
  FormatterExecutionError,
  FormatterFileSystemError,
  FormatterLoadError,
} from "./errors/FormatterError.js";
import { isCompleteLegacyOutputLock } from "./internal/outputCoordinationArtifact.js";
import type {
  FormatterError,
  FormatterFileSystemOperation,
} from "./errors/FormatterError.js";
import type { PlatformError } from "effect/PlatformError";

export type FormatFn = (filename: string, source: string) => Promise<unknown>;
export type FormatterModuleLoader = () => Promise<unknown>;

export const loadOxfmtModule: FormatterModuleLoader = () => import("oxfmt");

const isFormatFn = (value: unknown): value is FormatFn =>
  typeof value === "function";

const isMissingOptionalFormatter = (cause: unknown): boolean => {
  if (typeof cause !== "object" || cause === null) return false;
  const code: unknown = Reflect.get(cause, "code");
  const message: unknown = Reflect.get(cause, "message");
  if (
    (code !== "ERR_MODULE_NOT_FOUND" && code !== "MODULE_NOT_FOUND") ||
    typeof message !== "string"
  ) {
    return false;
  }
  return (
    message.includes("Cannot find package 'oxfmt'") ||
    message.includes('Cannot find package "oxfmt"') ||
    message.includes("Cannot find module 'oxfmt'") ||
    message.includes('Cannot find module "oxfmt"')
  );
};

const loadFormatter = (
  loadModule: FormatterModuleLoader
): Effect.Effect<FormatFn | undefined, FormatterLoadError> =>
  Effect.gen(function* () {
    const loaded = yield* Effect.tryPromise({
      try: loadModule,
      catch: cause => new FormatterLoadError({ moduleName: "oxfmt", cause }),
    }).pipe(Effect.result);
    if (Result.isFailure(loaded)) {
      if (isMissingOptionalFormatter(loaded.failure.cause)) {
        yield* Effect.logWarning(
          "oxfmt not installed - skipping formatting. Install with: npm install -D oxfmt"
        );
        return undefined;
      }
      return yield* loaded.failure;
    }
    if (typeof loaded.success !== "object" || loaded.success === null) {
      return yield* new FormatterLoadError({
        moduleName: "oxfmt",
        cause: new TypeError("Module did not export an object"),
      });
    }
    const format: unknown = Reflect.get(loaded.success, "format");
    if (!isFormatFn(format)) {
      return yield* new FormatterLoadError({
        moduleName: "oxfmt",
        cause: new TypeError("Module did not export a format function"),
      });
    }
    return format;
  });

const mapFileSystemError =
  (operation: FormatterFileSystemOperation, targetPath: string) =>
  (cause: PlatformError) =>
    new FormatterFileSystemError({ operation, path: targetPath, cause });

const hasCoordinationArtifactMarker = (
  fileSystem: FileSystem.FileSystem,
  directoryPath: string,
  canonicalDirectoryPath: string,
  entryName: string
): Effect.Effect<boolean, FormatterFileSystemError> =>
  Effect.gen(function* () {
    const kind = coordinationArtifactKindForTempDirectoryName(entryName);
    if (kind === undefined) return false;
    const markerPath = path.join(
      directoryPath,
      TYPEWEAVER_COORDINATION_MARKER_FILE
    );
    const markerRealPath = yield* fileSystem
      .realPath(markerPath)
      .pipe(
        Effect.mapError(mapFileSystemError("realPath", markerPath)),
        Effect.result
      );
    if (Result.isFailure(markerRealPath)) {
      if (
        markerRealPath.failure.cause._tag === "PlatformError" &&
        markerRealPath.failure.cause.reason._tag === "NotFound"
      ) {
        return false;
      }
      return yield* markerRealPath.failure;
    }
    if (
      markerRealPath.success !==
      path.join(canonicalDirectoryPath, TYPEWEAVER_COORDINATION_MARKER_FILE)
    ) {
      return false;
    }
    const markerInfo = yield* fileSystem
      .stat(markerPath)
      .pipe(Effect.mapError(mapFileSystemError("stat", markerPath)));
    if (markerInfo.type !== "File") return false;
    const markerSource = yield* fileSystem
      .readFileString(markerPath)
      .pipe(Effect.mapError(mapFileSystemError("readFileString", markerPath)));
    return matchesCoordinationArtifactMarker(markerSource, kind);
  });

const formatFile = (
  fileSystem: FileSystem.FileSystem,
  filePath: string,
  format: FormatFn
): Effect.Effect<void, FormatterError> =>
  Effect.gen(function* () {
    const unformatted = yield* fileSystem
      .readFileString(filePath)
      .pipe(Effect.mapError(mapFileSystemError("readFileString", filePath)));
    const formatted = yield* Effect.tryPromise({
      try: () => format(filePath, unformatted),
      catch: cause => new FormatterExecutionError({ filePath, cause }),
    });
    if (typeof formatted !== "object" || formatted === null) {
      return yield* new FormatterExecutionError({
        filePath,
        cause: new TypeError("Formatter did not return an object"),
      });
    }
    const code: unknown = Reflect.get(formatted, "code");
    if (typeof code !== "string") {
      return yield* new FormatterExecutionError({
        filePath,
        cause: new TypeError("Formatter did not return a string code"),
      });
    }
    yield* fileSystem
      .writeFileString(filePath, code)
      .pipe(Effect.mapError(mapFileSystemError("writeFileString", filePath)));
  });

const formatDirectory = (
  fileSystem: FileSystem.FileSystem,
  targetDir: string,
  canonicalTargetDir: string,
  format: FormatFn
): Effect.Effect<void, FormatterError> =>
  Effect.gen(function* () {
    const contents = yield* fileSystem.readDirectory(targetDir).pipe(
      Effect.mapError(mapFileSystemError("readDirectory", targetDir)),
      Effect.map(entries => entries.sort())
    );
    for (const content of contents) {
      const filePath = path.join(targetDir, content);
      const canonicalFilePath = yield* fileSystem
        .realPath(filePath)
        .pipe(Effect.mapError(mapFileSystemError("realPath", filePath)));
      if (canonicalFilePath !== path.join(canonicalTargetDir, content))
        continue;
      const info = yield* fileSystem
        .stat(filePath)
        .pipe(Effect.mapError(mapFileSystemError("stat", filePath)));
      // Atomic-write and bundler staging directories are skipped only when
      // both their Node-mkdtemp name shape and exact, versioned marker agree. A
      // proven legacy `.typeweaver-lock` directory is skipped too so its
      // metadata is not rewritten. A name alone is user content and must remain
      // format-visible.
      if (info.type === "Directory") {
        if (
          !isCompleteLegacyOutputLock(filePath, content) &&
          !(yield* hasCoordinationArtifactMarker(
            fileSystem,
            filePath,
            canonicalFilePath,
            content
          ))
        ) {
          yield* formatDirectory(
            fileSystem,
            filePath,
            canonicalFilePath,
            format
          );
        }
        continue;
      }
      if (info.type === "File") yield* formatFile(fileSystem, filePath, format);
    }
  });

export const formatOutputDir = (
  fileSystem: FileSystem.FileSystem,
  loadModule: FormatterModuleLoader,
  outputDir: string,
  startDir?: string
): Effect.Effect<void, FormatterError> =>
  Effect.gen(function* () {
    const format = yield* loadFormatter(loadModule);
    if (format === undefined) return;
    const targetDir = startDir ?? outputDir;
    const canonicalTargetDir = yield* fileSystem
      .realPath(targetDir)
      .pipe(Effect.mapError(mapFileSystemError("realPath", targetDir)));
    yield* formatDirectory(fileSystem, targetDir, canonicalTargetDir, format);
  });
