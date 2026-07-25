import { Effect } from "effect";
import { GeneratedPathProbeError } from "../errors/GeneratedPathProbeError.js";
import { UnsafeGeneratedPathError } from "../errors/UnsafeGeneratedPathError.js";
import { resolveSafeGeneratedFilePath } from "../helpers/pathSafety.js";
import type {
  PathSafetyFs,
  SafeGeneratedFilePath,
} from "../helpers/pathSafety.js";

export type { SafeGeneratedFilePath } from "../helpers/pathSafety.js";

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
export const makePathSafety = (
  fileSystem?: PathSafetyFs
): {
  readonly validateGeneratedPath: (params: {
    readonly outputDir: string;
    readonly requestedPath: string;
  }) => Effect.Effect<
    SafeGeneratedFilePath,
    GeneratedPathProbeError | UnsafeGeneratedPathError
  >;
} => ({
  validateGeneratedPath: params =>
    Effect.try({
      try: () =>
        resolveSafeGeneratedFilePath(
          params.outputDir,
          params.requestedPath,
          fileSystem
        ),
      catch: error => {
        if (
          error instanceof GeneratedPathProbeError ||
          error instanceof UnsafeGeneratedPathError
        ) {
          return error;
        }
        throw error;
      },
    }),
});

export class PathSafety extends Effect.Service<PathSafety>()(
  "typeweaver/PathSafety",
  {
    succeed: makePathSafety(),
    accessors: true,
  }
) {}
