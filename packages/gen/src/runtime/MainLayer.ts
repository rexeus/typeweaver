import { Layer } from "effect";

/**
 * Composition root for typeweaver's Effect services.
 *
 * Currently empty; services accrete here as the migration progresses
 * (TemplateRenderer, Formatter, GeneratedFiles, PluginRegistry, ...).
 *
 * Platform bindings (FileSystem, Path) are *not* included here — they are
 * provided at the entrypoint (`@rexeus/typeweaver/runtime` for the CLI,
 * test layers for tests). This keeps the gen package free of a node-only
 * dependency on `@effect/platform-node`.
 */
export const MainLayer = Layer.empty;
