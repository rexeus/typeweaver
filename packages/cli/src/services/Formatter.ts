import { Context, Data, Effect, FileSystem, Layer } from "effect";
import {
  FormatterExecutionError,
  FormatterFileSystemError,
  FormatterLoadError,
} from "./errors/FormatterError.js";
import { formatOutputDir, loadOxfmtModule } from "./formatterRuntime.js";
import type { FormatterError } from "./errors/FormatterError.js";
import type { FormatterModuleLoader } from "./formatterRuntime.js";

export type FormatterShape = {
  readonly format: (
    outputDir: string,
    startDir?: string
  ) => Effect.Effect<void, FormatterError>;
};

class FormatterOperationFailure extends Data.TaggedError(
  "FormatterOperationFailure"
)<{ readonly error: FormatterError }> {}

const restoreFormatterError = (error: FormatterError): FormatterError => {
  switch (error._tag) {
    case "FormatterExecutionError":
      return new FormatterExecutionError({
        filePath: error.filePath,
        cause: error.cause,
      });
    case "FormatterFileSystemError":
      return new FormatterFileSystemError({
        operation: error.operation,
        path: error.path,
        cause: error.cause,
      });
    case "FormatterLoadError":
      return new FormatterLoadError({
        moduleName: error.moduleName,
        cause: error.cause,
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
        Effect.catchTag("FormatterOperationFailure", failure =>
          Effect.fail(restoreFormatterError(failure.error))
        )
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
