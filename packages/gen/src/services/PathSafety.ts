import { Context, Data, Effect, Layer } from "effect";
import { GeneratedPathProbeError } from "../errors/GeneratedPathProbeError.js";
import { UnsafeGeneratedPathError } from "../errors/UnsafeGeneratedPathError.js";
import { resolveSafeGeneratedFilePath } from "../helpers/pathSafety.js";
import type {
  PathSafetyFs,
  SafeGeneratedFilePath,
} from "../helpers/pathSafety.js";

export type { SafeGeneratedFilePath } from "../helpers/pathSafety.js";

class UnexpectedPathSafetyDefect extends Data.TaggedError(
  "UnexpectedPathSafetyDefect"
)<{
  readonly defect: unknown;
}> {}

export type PathSafetyShape = {
  readonly validateGeneratedPath: (params: {
    readonly outputDir: string;
    readonly requestedPath: string;
  }) => Effect.Effect<
    SafeGeneratedFilePath,
    GeneratedPathProbeError | UnsafeGeneratedPathError
  >;
};

/**
 * Effect-native facade over the sync `resolveSafeGeneratedFilePath` guard.
 *
 * The underlying helper has been audited carefully and is shared with the
 * existing sync `writeFile` path. This service exposes the same guarantees
 * to Effect-native callers without duplicating the security-critical logic.
 *
 * Recognized Node filesystem failures (e.g. `EACCES`) are exposed as
 * `GeneratedPathProbeError`; unexpected throws remain defects.
 */
export const makePathSafety = (fileSystem?: PathSafetyFs): PathSafetyShape => {
  const validateGeneratedPathTraced: (params: {
    readonly outputDir: string;
    readonly requestedPath: string;
  }) => Effect.Effect<
    SafeGeneratedFilePath,
    | GeneratedPathProbeError
    | UnexpectedPathSafetyDefect
    | UnsafeGeneratedPathError
  > = Effect.fn("typeweaver.PathSafety.validateGeneratedPath")(params =>
    Effect.try({
      try: () =>
        resolveSafeGeneratedFilePath(
          params.outputDir,
          params.requestedPath,
          fileSystem
        ),
      catch: error =>
        error instanceof GeneratedPathProbeError ||
        error instanceof UnsafeGeneratedPathError
          ? error
          : new UnexpectedPathSafetyDefect({ defect: error }),
    })
  );

  const validateGeneratedPath: PathSafetyShape["validateGeneratedPath"] =
    params =>
      validateGeneratedPathTraced(params).pipe(
        Effect.catchTag("UnexpectedPathSafetyDefect", error =>
          Effect.die(error.defect)
        )
      );

  return { validateGeneratedPath };
};

export class PathSafety extends Context.Service<PathSafety, PathSafetyShape>()(
  "typeweaver/PathSafety"
) {
  static readonly make = (service: PathSafetyShape) => service;

  static readonly Default: Layer.Layer<PathSafety> = Layer.succeed(
    PathSafety,
    makePathSafety()
  );

  static readonly validateGeneratedPath = (params: {
    readonly outputDir: string;
    readonly requestedPath: string;
  }) => PathSafety.use(service => service.validateGeneratedPath(params));
}
