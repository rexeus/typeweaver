import { Layer } from "effect";
import { ContextBuilder } from "../services/ContextBuilder.js";
import { PathSafety } from "../services/PathSafety.js";
import { PluginRegistry } from "../services/PluginRegistry.js";
import { TemplateRenderer } from "../services/TemplateRenderer.js";

/**
 * Composition root for typeweaver's gen-side Effect services.
 *
 * Pure services that do not need platform bindings live here:
 *   - `TemplateRenderer` (Effect facade over the sync EJS-like renderer;
 *                         typed `TemplateRenderError` on malformed input)
 *   - `PathSafety`       (Effect facade over the sync path-traversal guard)
 *   - `PluginRegistry`   (Ref<Map<string, V2Registration>>; toposorted)
 *   - `ContextBuilder`   (per-run plugin/generator context fabric; wires
 *                         the same sync cores that back `PathSafety` and
 *                         `TemplateRenderer` into the sync plugin-author
 *                         callbacks — no `Effect.runSync` bridging — and
 *                         captures the platform-agnostic `FileSystem` tag
 *                         for the Effect-native context surface)
 *
 * Because `ContextBuilder` consumes `FileSystem`, this layer requires the
 * `FileSystem` tag from `@effect/platform` (platform-agnostic — no
 * `@effect/platform-node` dependency here). Consumers provide it at the
 * edge: `NodeContext.layer` in production, `InMemoryFileSystem` (or
 * `FileSystem.layerNoop`) in tests.
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
