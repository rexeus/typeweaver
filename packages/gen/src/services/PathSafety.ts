import { Effect } from "effect";
import { UnsafeGeneratedPathError } from "../errors/UnsafeGeneratedPathError.js";
import { resolveSafeGeneratedFilePath } from "../helpers/pathSafety.js";
import type { SafeGeneratedFilePath } from "../helpers/pathSafety.js";

export type { SafeGeneratedFilePath } from "../helpers/pathSafety.js";

/**
 * Effect-native facade over the sync `resolveSafeGeneratedFilePath` guard.
 *
 * The underlying helper has been audited carefully and is shared with the
 * existing sync `writeFile` path. This service exposes the same guarantees
 * to Effect-native callers without duplicating the security-critical logic.
 *
 * Anything other than `UnsafeGeneratedPathError` (e.g. filesystem `EACCES`)
 * becomes a defect — those failures are not recoverable at this boundary.
 */
export class PathSafety extends Effect.Service<PathSafety>()(
  "typeweaver/PathSafety",
  {
    succeed: {
      validateGeneratedPath: (params: {
        readonly outputDir: string;
        readonly requestedPath: string;
      }): Effect.Effect<SafeGeneratedFilePath, UnsafeGeneratedPathError> =>
        Effect.try({
          try: () =>
            resolveSafeGeneratedFilePath(
              params.outputDir,
              params.requestedPath
            ),
          catch: (error) => {
            if (error instanceof UnsafeGeneratedPathError) {
              return error;
            }
            throw error;
          },
        }),
    },
    accessors: true,
  }
) {}
