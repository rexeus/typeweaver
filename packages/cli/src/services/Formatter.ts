import path from "node:path";
import {
  coordinationArtifactKindForTempDirectoryName,
  matchesCoordinationArtifactMarker,
  TYPEWEAVER_COORDINATION_MARKER_FILE,
} from "@rexeus/typeweaver-gen";
import { Context, Data, Effect, FileSystem, Layer, Result } from "effect";
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

type FormatFn = (filename: string, source: string) => Promise<unknown>;

type FormatterModuleLoader = () => Promise<unknown>;

const loadOxfmtModule: FormatterModuleLoader = () => import("oxfmt");

const isFormatFn = (value: unknown): value is FormatFn =>
  typeof value === "function";

const isMissingOptionalFormatter = (cause: unknown): boolean => {
  if (typeof cause !== "object" || cause === null) {
    return false;
  }

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
      catch: cause =>
        new FormatterLoadError({
          moduleName: "oxfmt",
          cause,
        }),
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
    new FormatterFileSystemError({
      operation,
      path: targetPath,
      cause,
    });

const hasCoordinationArtifactMarker = (
  fileSystem: FileSystem.FileSystem,
  directoryPath: string,
  canonicalDirectoryPath: string,
  entryName: string
): Effect.Effect<boolean, FormatterFileSystemError> =>
  Effect.gen(function* () {
    const kind = coordinationArtifactKindForTempDirectoryName(entryName);
    if (kind === undefined) {
      return false;
    }

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
    if (markerInfo.type !== "File") {
      return false;
    }

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

const formatDirectory: (
  fileSystem: FileSystem.FileSystem,
  targetDir: string,
  canonicalTargetDir: string,
  format: FormatFn
) => Effect.Effect<void, FormatterError> = (
  fileSystem,
  targetDir,
  canonicalTargetDir,
  format
) =>
  Effect.gen(function* () {
    const contents = yield* fileSystem.readDirectory(targetDir).pipe(
      Effect.mapError(mapFileSystemError("readDirectory", targetDir)),
      Effect.map(entries => entries.sort())
    );

    for (const content of contents) {
      // Atomic-write and bundler staging directories are skipped only when
      // both their Node-mkdtemp name shape and exact, versioned marker agree. A
      // proven legacy `.typeweaver-lock` directory is skipped below so its
      // metadata is not rewritten. A name alone is user content and must remain
      // format-visible.
      const filePath = path.join(targetDir, content);
      const canonicalFilePath = yield* fileSystem
        .realPath(filePath)
        .pipe(Effect.mapError(mapFileSystemError("realPath", filePath)));
      if (canonicalFilePath !== path.join(canonicalTargetDir, content)) {
        continue;
      }

      const info = yield* fileSystem
        .stat(filePath)
        .pipe(Effect.mapError(mapFileSystemError("stat", filePath)));

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
      if (info.type !== "File") {
        continue;
      }
      yield* formatFile(fileSystem, filePath, format);
    }
  });

const formatOutputDir = (
  fileSystem: FileSystem.FileSystem,
  loadModule: FormatterModuleLoader,
  outputDir: string,
  startDir?: string
): Effect.Effect<void, FormatterError> =>
  Effect.gen(function* () {
    const format = yield* loadFormatter(loadModule);
    if (format === undefined) {
      return;
    }
    const targetDir = startDir ?? outputDir;
    const canonicalTargetDir = yield* fileSystem
      .realPath(targetDir)
      .pipe(Effect.mapError(mapFileSystemError("realPath", targetDir)));
    yield* formatDirectory(fileSystem, targetDir, canonicalTargetDir, format);
  });

export type FormatterShape = {
  readonly format: (
    outputDir: string,
    startDir?: string
  ) => Effect.Effect<void, FormatterError>;
};

class FormatterOperationFailure extends Data.TaggedError(
  "FormatterOperationFailure"
)<{
  readonly error: FormatterError;
}> {}

const restoreFormatterError = (error: FormatterError): FormatterError => {
  const original = error;

  switch (original._tag) {
    case "FormatterExecutionError":
      return new FormatterExecutionError({
        filePath: original.filePath,
        cause: original.cause,
      });
    case "FormatterFileSystemError":
      return new FormatterFileSystemError({
        operation: original.operation,
        path: original.path,
        cause: original.cause,
      });
    case "FormatterLoadError":
      return new FormatterLoadError({
        moduleName: original.moduleName,
        cause: original.cause,
      });
  }
};

const makeFormatter = (
  fileSystem: FileSystem.FileSystem,
  loadModule: FormatterModuleLoader
): FormatterShape => {
  const formatOperation = Effect.fn("typeweaver.Formatter.format")(
    (outputDir: string, startDir?: string) =>
      formatOutputDir(fileSystem, loadModule, outputDir, startDir).pipe(
        Effect.mapError(error => new FormatterOperationFailure({ error }))
      )
  );

  return {
    format: (outputDir, startDir) =>
      formatOperation(outputDir, startDir).pipe(
        Effect.catchTag("FormatterOperationFailure", failure => {
          const originalFailure = failure;
          return Effect.fail(restoreFormatterError(originalFailure.error));
        })
      ),
  };
};

/**
 * Effect-native `oxfmt` facade. The missing-tool warning routes through
 * `Effect.logWarning` so it lands in the same logger pipeline as the rest
 * of the run (ADR 0006). Directory walking and file reads/writes use the
 * platform FileSystem service.
 *
 * A genuinely missing optional `oxfmt` package is a documented no-op.
 * Package-load failures, formatter rejections, and filesystem failures remain
 * in the typed `FormatterError` channel.
 */
export class Formatter extends Context.Service<Formatter, FormatterShape>()(
  "typeweaver/Formatter"
) {
  static readonly make = (service: FormatterShape) => service;

  static readonly Default: Layer.Layer<
    Formatter,
    never,
    FileSystem.FileSystem
  > = Layer.effect(
    Formatter,
    Effect.map(FileSystem.FileSystem, fileSystem =>
      makeFormatter(fileSystem, loadOxfmtModule)
    )
  );

  static readonly format = (outputDir: string, startDir?: string) =>
    Formatter.use(service => service.format(outputDir, startDir));
}

/**
 * Test seam for deterministic module-load and formatter-failure scenarios.
 * Production uses `Formatter.Default`.
 */
export const formatterLayerWith = (
  loadModule: FormatterModuleLoader
): Layer.Layer<Formatter, never, FileSystem.FileSystem> =>
  Layer.effect(
    Formatter,
    Effect.map(FileSystem.FileSystem, fileSystem =>
      makeFormatter(fileSystem, loadModule)
    )
  );
