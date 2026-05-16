import { Layer } from "effect";
import { ContextBuilder } from "../services/ContextBuilder.js";
import { PathSafety } from "../services/PathSafety.js";
import { PluginRegistry } from "../services/PluginRegistry.js";
import { TemplateRenderer } from "../services/TemplateRenderer.js";

/**
 * Composition root for typeweaver's gen-side Effect services.
 *
 * Pure services that do not need platform bindings live here:
 *   - `TemplateRenderer` (wraps the EJS-like renderer)
 *   - `PathSafety`       (Effect facade over the sync path-traversal guard)
 *   - `PluginRegistry`   (Ref<Map<string, V2Registration>>; toposorted)
 *   - `ContextBuilder`   (per-run plugin/generator context fabric;
 *                         consumes `FileSystem`, `PathSafety`, and
 *                         `TemplateRenderer` to keep plugin-author sync
 *                         callbacks routed through Effect services)
 *
 * Platform bindings (FileSystem, Path) and CLI-only services (Formatter,
 * ConfigLoader, SpecLoader) are stacked on top by the consumer entrypoint
 * — see `packages/cli/src/effectRuntime.ts`. Keeping this layer free of a
 * node-only dependency on `@effect/platform-node` lets the gen package
 * stay platform-agnostic.
 *
 * The generated-file tracker is intentionally **not** a singleton service.
 * Per-call isolation is enforced inside `ContextBuilder` so concurrent
 * generation runs cannot observe one another's state.
 */
export const MainLayer = Layer.mergeAll(
  TemplateRenderer.Default,
  PathSafety.Default,
  PluginRegistry.Default,
  ContextBuilder.Default
);
