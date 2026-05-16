import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "@rexeus/typeweaver-gen";
import { typesPlugin } from "@rexeus/typeweaver-types";
import { FileSystem } from "@effect/platform";
import { Effect } from "effect";
import type { PluginResolutionStrategy } from "./PluginLoader.js";
import type { PlatformError } from "@effect/platform/Error";

export const CORE_DIR = "@rexeus/typeweaver-core";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * Candidates for locating the EJS template directory. The CLI is bundled
 * to `dist/` in production but executed via `tsx` in development; the
 * template lives in `src/generators/templates/` either way, copied across
 * by the build to `dist/generators/templates/`.
 */
const TEMPLATE_DIR_CANDIDATES = [
  path.join(moduleDir, "..", "generators", "templates"),
  path.join(moduleDir, "generators", "templates"),
  path.join(moduleDir, "templates"),
  path.join(moduleDir, "..", "templates"),
  path.join(moduleDir, "..", "..", "src", "generators", "templates"),
] as const;

/**
 * Effect-native template-directory probe. Walks the candidate list and
 * returns the first directory containing `Index.ejs`; falls back to the
 * first candidate if none match (preserves the previous best-effort
 * behavior). Filesystem probes run through the `FileSystem` service so
 * tests can substitute a fake platform implementation.
 */
export const resolveTemplateDir = (): Effect.Effect<
  string,
  PlatformError,
  FileSystem.FileSystem
> =>
  Effect.gen(function* () {
    const fileSystem = yield* FileSystem.FileSystem;

    for (const candidate of TEMPLATE_DIR_CANDIDATES) {
      const indexFile = path.join(candidate, "Index.ejs");
      const exists = yield* fileSystem.exists(indexFile);
      if (exists) {
        return candidate;
      }
    }

    return TEMPLATE_DIR_CANDIDATES[0];
  });

export const defaultRequiredPlugins = (): Plugin[] => [typesPlugin];

export const DEFAULT_PLUGIN_RESOLUTION_STRATEGIES: readonly PluginResolutionStrategy[] =
  ["npm", "local"];
