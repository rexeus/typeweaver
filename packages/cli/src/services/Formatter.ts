import path from "node:path";
import { FileSystem } from "@effect/platform";
import { Cause, Data, Effect, Either, Layer } from "effect";
import {
  FormatterExecutionError,
  FormatterFileSystemError,
  FormatterLoadError,
} from "./errors/FormatterError.js";
import type {
  FormatterError,
  FormatterFileSystemOperation,
} from "./errors/FormatterError.js";
import type { PlatformError } from "@effect/platform/Error";

type FormatFn = (filename: string, source: string) => Promise<unknown>;

type FormatterModuleLoader = () => Promise<unknown>;

const loadOxfmtModule: FormatterModuleLoader = () => import("oxfmt");

const isFormatFn = (value: unknown): value is FormatFn =>
  typeof value === "function";

const isMissingOptionalFormatter = (cause: unknown): boolean => {
  if (typeof cause !== "object" || cause === null) {
    return false;
  }

  const code = Reflect.get(cause, "code");
  const message = Reflect.get(cause, "message");
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
      catch: cause => cause,
    }).pipe(Effect.either);

    if (Either.isLeft(loaded)) {
      if (isMissingOptionalFormatter(loaded.left)) {
        yield* Effect.logWarning(
          "oxfmt not installed - skipping formatting. Install with: npm install -D oxfmt"
        );
        return undefined;
      }

      return yield* Effect.fail(
        new FormatterLoadError({
          moduleName: "oxfmt",
          cause: loaded.left,
        })
      );
    }

    if (typeof loaded.right !== "object" || loaded.right === null) {
      return yield* Effect.fail(
        new FormatterLoadError({
          moduleName: "oxfmt",
          cause: new TypeError("Module did not export an object"),
        })
      );
    }

    const format = Reflect.get(loaded.right, "format");
    if (!isFormatFn(format)) {
      return yield* Effect.fail(
        new FormatterLoadError({
          moduleName: "oxfmt",
          cause: new TypeError("Module did not export a format function"),
        })
      );
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
      // Skip atomic-write tempdirs and the lockfile sentinel — both are
      // hidden coordination artifacts, not user-facing output. Walking
      // into them would re-read/rewrite in-flight content from another
      // run (`.typeweaver-XXXX/generated.tmp`) or the live lockfile
      // metadata (`.typeweaver-lock/info.json`).
      if (content.startsWith(".typeweaver-")) {
        continue;
      }

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

      if (info.type === "File") {
        const unformatted = yield* fileSystem
          .readFileString(filePath)
          .pipe(
            Effect.mapError(mapFileSystemError("readFileString", filePath))
          );
        const formatted = yield* Effect.tryPromise({
          try: () => format(filePath, unformatted),
          catch: cause => new FormatterExecutionError({ filePath, cause }),
        });
        if (typeof formatted !== "object" || formatted === null) {
          return yield* Effect.fail(
            new FormatterExecutionError({
              filePath,
              cause: new TypeError("Formatter did not return an object"),
            })
          );
        }
        const code = Reflect.get(formatted, "code");
        if (typeof code !== "string") {
          return yield* Effect.fail(
            new FormatterExecutionError({
              filePath,
              cause: new TypeError("Formatter did not return a string code"),
            })
          );
        }
        yield* fileSystem
          .writeFileString(filePath, code)
          .pipe(
            Effect.mapError(mapFileSystemError("writeFileString", filePath))
          );
      } else if (info.type === "Directory") {
        yield* formatDirectory(fileSystem, filePath, canonicalFilePath, format);
      }
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

type FormatterShape = {
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
  const original = Cause.originalError(error);

  switch (original._tag) {
    case "FormatterExecutionError":
      return new FormatterExecutionError({
        filePath: original.filePath,
        cause: Cause.originalError(original.cause),
      });
    case "FormatterFileSystemError":
      return new FormatterFileSystemError({
        operation: original.operation,
        path: original.path,
        cause: Cause.originalError(original.cause),
      });
    case "FormatterLoadError":
      return new FormatterLoadError({
        moduleName: original.moduleName,
        cause: Cause.originalError(original.cause),
      });
  }
};

const makeFormatter = (
  fileSystem: FileSystem.FileSystem,
  loadModule: FormatterModuleLoader
): FormatterShape => {
  const formatOperation = Effect.fn("typeweaver.Formatter.format", {
    captureStackTrace: false,
  })((outputDir, startDir) =>
    formatOutputDir(fileSystem, loadModule, outputDir, startDir).pipe(
      Effect.mapError(error => new FormatterOperationFailure({ error }))
    )
  );

  return {
    format: (outputDir, startDir) =>
      formatOperation(outputDir, startDir).pipe(
        Effect.catchTag("FormatterOperationFailure", failure => {
          const originalFailure = Cause.originalError(failure);
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
export class Formatter extends Effect.Service<Formatter>()(
  "typeweaver/Formatter",
  {
    effect: Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      return makeFormatter(fileSystem, loadOxfmtModule);
    }),
    accessors: true,
  }
) {}

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
      Formatter.make(makeFormatter(fileSystem, loadModule))
    )
  );
