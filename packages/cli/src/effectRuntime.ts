import { MainLayer } from "@rexeus/typeweaver-gen";
import { NodeContext } from "@effect/platform-node";
import { Layer, ManagedRuntime } from "effect";
import { ConfigLoader } from "./services/ConfigLoader.js";
import { Formatter } from "./services/Formatter.js";
import { Generator } from "./services/Generator.js";
import { IndexFileGenerator } from "./services/IndexFileGenerator.js";
import { PluginLoader } from "./services/PluginLoader.js";
import { SpecLoader } from "./services/SpecLoader.js";

/**
 * Production runtime for the typeweaver CLI.
 *
 * Layers compose top-down: NodeContext supplies the Node-backed FileSystem,
 * Path, and Terminal implementations; MainLayer supplies the gen-side
 * services (TemplateRenderer, PathSafety, GeneratedFiles, PluginRegistry,
 * ContextBuilder); the CLI then layers on its own services (ConfigLoader,
 * SpecLoader, Formatter, PluginLoader, Generator).
 *
 * SpecLoader transitively brings in SpecBundler and SpecImporter via its
 * declared `dependencies`. PluginLoader and Generator likewise pull in the
 * gen-side PluginRegistry and ContextBuilder.
 *
 * Tests build their own runtime against an InMemoryFileSystem layer instead
 * of NodeContext.layer — see `packages/test-utils`.
 */
export const ProductionLayer = Layer.mergeAll(
  NodeContext.layer,
  MainLayer,
  ConfigLoader.Default,
  Formatter.Default,
  IndexFileGenerator.Default,
  SpecLoader.Default,
  PluginLoader.Default,
  Generator.Default
);

export const effectRuntime = ManagedRuntime.make(ProductionLayer);
