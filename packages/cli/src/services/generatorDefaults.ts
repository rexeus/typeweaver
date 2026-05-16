import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { typesPlugin } from "@rexeus/typeweaver-types";
import type { Plugin } from "@rexeus/typeweaver-gen";
import type { PluginResolutionStrategy } from "./PluginLoader.js";

export const CORE_DIR = "@rexeus/typeweaver-core";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * Resolves the EJS template directory for `Index.ejs`. The CLI is bundled
 * to `dist/` in production but executed via `tsx` in development; the
 * template lives in `src/generators/templates/` either way, copied across
 * by the build to `dist/generators/templates/`.
 */
export const resolveTemplateDir = (): string => {
  const candidates = [
    path.join(moduleDir, "..", "generators", "templates"),
    path.join(moduleDir, "generators", "templates"),
    path.join(moduleDir, "templates"),
    path.join(moduleDir, "..", "templates"),
    path.join(moduleDir, "..", "..", "src", "generators", "templates"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, "Index.ejs"))) {
      return candidate;
    }
  }

  return candidates[0]!;
};

export const defaultRequiredPlugins = (): Plugin[] => [typesPlugin];

export const DEFAULT_PLUGIN_RESOLUTION_STRATEGIES: readonly PluginResolutionStrategy[] =
  ["npm", "local"];
