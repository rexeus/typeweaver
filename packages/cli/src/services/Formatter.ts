import { Effect } from "effect";
import { formatCode } from "../generators/formatter.js";

/**
 * Effect-native facade over `oxfmt`. Delegates to the existing async
 * `formatCode` helper, which silently skips when `oxfmt` is not installed.
 *
 * Filesystem failures (read/write/readdir) propagate as defects — the
 * formatter is best-effort and has no recovery path.
 */
export class Formatter extends Effect.Service<Formatter>()(
  "typeweaver/Formatter",
  {
    succeed: {
      format: (
        outputDir: string,
        startDir?: string
      ): Effect.Effect<void> =>
        Effect.promise(() => formatCode(outputDir, startDir)),
    },
    accessors: true,
  }
) {}
