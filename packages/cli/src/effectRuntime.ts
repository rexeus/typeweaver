import { MainLayer } from "@rexeus/typeweaver-gen";
import { NodeContext } from "@effect/platform-node";
import { Layer, Logger, LogLevel, ManagedRuntime } from "effect";
import { CliLoggerLayer, VerboseCliLoggerLayer } from "./cliLogger.js";
import {
  ConfigLoader,
  Formatter,
  Generator,
  IndexFileGenerator,
  PluginLoader,
  PluginModuleLoader,
  PluginScaffolder,
  ProjectDoctor,
  ProjectInitializer,
  ProjectValidator,
  SpecLoader,
} from "./services/index.js";

/**
 * Production runtime for the typeweaver CLI.
 *
 * Layers compose top-down: NodeContext supplies the Node-backed FileSystem,
 * Path, and Terminal implementations; MainLayer supplies the gen-side
 * services (TemplateRenderer, PathSafety, PluginRegistry, ContextBuilder);
 * the CLI then layers on its own services (ConfigLoader, SpecLoader,
 * Formatter, PluginModuleLoader, PluginLoader, Generator) plus the
 * friendly `cliLogger` that drops timestamps and tags warnings/errors.
 *
 * SpecLoader transitively brings in SpecBundler and SpecImporter via its
 * declared `dependencies`. PluginLoader and Generator likewise pull in the
 * gen-side PluginRegistry and ContextBuilder, plus PluginModuleLoader for
 * dynamic plugin module resolution.
 *
 * Tests build their own runtime against an InMemoryFileSystem layer instead
 * of NodeContext.layer — see `packages/test-utils`.
 */
const CliServices = Layer.mergeAll(
  MainLayer,
  ConfigLoader.Default,
  Formatter.Default,
  IndexFileGenerator.Default,
  SpecLoader.Default,
  PluginModuleLoader.Default,
  PluginLoader.Default,
  PluginScaffolder.Default,
  ProjectValidator.Default,
  ProjectDoctor.Default,
  ProjectInitializer.Default,
  Generator.Default,
  CliLoggerLayer
);

export const ProductionLayer = Layer.provideMerge(
  CliServices,
  NodeContext.layer
);

/**
 * Verbose flavor of the production runtime. Replaces the `Info`-default
 * logger with one that accepts `Debug`-level records and lifts the
 * minimum log level to `Debug` so `Effect.logDebug(...)` calls along
 * high-value seams (lock acquire/release, plugin lifecycle entries,
 * input/output paths) are routed to the console.
 *
 * Chosen by `cli.ts` when `--verbose` / `-V` is present in `process.argv`.
 */
const VerboseCliServices = Layer.mergeAll(
  MainLayer,
  ConfigLoader.Default,
  Formatter.Default,
  IndexFileGenerator.Default,
  SpecLoader.Default,
  PluginModuleLoader.Default,
  PluginLoader.Default,
  PluginScaffolder.Default,
  ProjectValidator.Default,
  ProjectDoctor.Default,
  ProjectInitializer.Default,
  Generator.Default,
  VerboseCliLoggerLayer,
  Logger.minimumLogLevel(LogLevel.Debug)
);

export const VerboseLayer = Layer.provideMerge(
  VerboseCliServices,
  NodeContext.layer
);

/**
 * Shared `ManagedRuntime` over the production layer. The CLI binary does
 * NOT use it — `cli.ts` provides its layer once via `NodeRuntime.runMain`,
 * which owns the lifecycle. This runtime exists for embedders and tests
 * that need to run individual service operations against the production
 * graph. Construction is lazy (the layer builds on first `run*` call);
 * test workers reclaim it on process exit, and long-lived embedders should
 * call `effectRuntime.dispose()` when finished.
 */
export const effectRuntime = ManagedRuntime.make(ProductionLayer);
