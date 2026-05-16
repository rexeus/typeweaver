import { Layer } from "effect";
import { GeneratedFiles } from "../services/GeneratedFiles.js";
import { PathSafety } from "../services/PathSafety.js";
import { TemplateRenderer } from "../services/TemplateRenderer.js";

/**
 * Composition root for typeweaver's gen-side Effect services.
 *
 * Pure services that do not need platform bindings live here:
 *   - `TemplateRenderer` (wraps the EJS-like renderer)
 *   - `PathSafety`       (Effect facade over the sync path-traversal guard)
 *   - `GeneratedFiles`   (Ref<SortedSet<string>>; deterministic snapshots)
 *
 * Platform-backed services (`FileSystem`, `Path`, `Formatter`) are layered
 * on top at the consumer entrypoint — see `@rexeus/typeweaver/effectRuntime`.
 */
export const MainLayer = Layer.mergeAll(
  TemplateRenderer.Default,
  PathSafety.Default,
  GeneratedFiles.Default
);
