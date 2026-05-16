import { Layer } from "effect";
import { ContextBuilder } from "../services/ContextBuilder.js";
import { GeneratedFiles } from "../services/GeneratedFiles.js";
import { PathSafety } from "../services/PathSafety.js";
import { PluginRegistry } from "../services/PluginRegistry.js";
import { TemplateRenderer } from "../services/TemplateRenderer.js";

/**
 * Composition root for typeweaver's gen-side Effect services.
 *
 * Pure services that do not need platform bindings live here:
 *   - `TemplateRenderer` (wraps the EJS-like renderer)
 *   - `PathSafety`       (Effect facade over the sync path-traversal guard)
 *   - `GeneratedFiles`   (Ref<SortedSet<string>>; deterministic snapshots)
 *   - `PluginRegistry`   (Ref<Map<string, V2Registration>>; toposorted)
 *   - `ContextBuilder`   (per-run plugin/generator context fabric)
 *
 * Platform bindings (FileSystem, Path) and CLI-only services (Formatter,
 * ConfigLoader, SpecLoader) are stacked on top by the consumer entrypoint
 * — see `packages/cli/src/effectRuntime.ts`. Keeping this layer free of a
 * node-only dependency on `@effect/platform-node` lets the gen package
 * stay platform-agnostic.
 */
export const MainLayer = Layer.mergeAll(
  TemplateRenderer.Default,
  PathSafety.Default,
  GeneratedFiles.Default,
  PluginRegistry.Default,
  ContextBuilder.Default
);
