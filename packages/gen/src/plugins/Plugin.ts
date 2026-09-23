import { Effect } from "effect";
import { PluginExecutionError } from "./errors/PluginExecutionError.js";
import type { Issue } from "../issues/Issue.js";
import type { NormalizedSpec } from "../NormalizedSpec.js";
import type {
  GeneratorContext,
  PluginConfig,
  PluginContext,
  PluginValidationContext,
} from "./contextTypes.js";
import type { Scope } from "effect";

/**
 * Lifecycle hooks that a host runs once per generation. The error channel is
 * narrowed to PluginExecutionError; other failures indicate programming bugs
 * and propagate as defects. Every hook keeps `R = never`.
 */
export type PluginLifecycleHooks = {
  readonly initialize?: (
    context: PluginContext
  ) => Effect.Effect<void, PluginExecutionError>;
  readonly collectResources?: (
    normalizedSpec: NormalizedSpec
  ) => Effect.Effect<NormalizedSpec, PluginExecutionError>;
  readonly generate?: (
    context: GeneratorContext
  ) => Effect.Effect<void, PluginExecutionError>;
  /**
   * Lifecycle cleanup. Runs for every plugin whose `initialize` succeeded —
   * even when a later plugin's `initialize`, `collectResources`, or
   * `generate` fails, mirroring `try/finally`. Failures here are demoted
   * to WARN logs and do not fail the run. Use `generate` for any work
   * whose failure must abort generation.
   */
  readonly finalize?: (
    context: PluginContext
  ) => Effect.Effect<void, PluginExecutionError>;
};

/**
 * Scoped constructor for the lifecycle hooks of one generation. The host runs
 * it at the initialize stage inside a Scope that it owns for exactly that
 * generation and closes after `finalize`, on success, typed failure, defect,
 * and interruption. Acquisition failures belong to the `initialize` phase.
 */
export type PluginAcquisition = Effect.Effect<
  PluginLifecycleHooks,
  PluginExecutionError,
  Scope.Scope
>;

type PluginIdentity = {
  readonly name: string;
  readonly depends?: readonly string[];
  /**
   * Validation-only hosts run this without a generation Scope, so it must
   * not acquire resources.
   */
  readonly validate?: (
    normalizedSpec: NormalizedSpec,
    context: PluginValidationContext
  ) => Effect.Effect<readonly Issue[], PluginExecutionError>;
};

type StaticPluginLifecycle = PluginLifecycleHooks & {
  readonly acquire?: never;
};

type ScopedPluginLifecycle = {
  readonly [Hook in keyof PluginLifecycleHooks]?: never;
} & {
  readonly acquire: PluginAcquisition;
};

/**
 * Effect-native plugin. A plugin either declares its lifecycle hooks
 * directly, or declares `acquire`, a scoped constructor that returns the hooks
 * closed over the resources it acquired for one generation. The two forms are
 * exclusive. `defineScopedPlugin` builds the scoped form from a Layer.
 */
export type Plugin = PluginIdentity &
  (StaticPluginLifecycle | ScopedPluginLifecycle);

/**
 * Public construction contract for configurable plugins. The loader calls
 * this function once per generation. It must validate options and return the
 * plugin synchronously; resource acquisition belongs in `acquire`.
 */
export type PluginFactory = (config?: PluginConfig) => Plugin;

export const definePlugin = (plugin: Plugin): Plugin => plugin;

/**
 * Resolves the lifecycle hooks of one generation. A host runs this inside the
 * generation's Scope: it acquires a scoped plugin and returns a static
 * plugin's own hooks unchanged.
 */
export const acquirePluginLifecycle = (plugin: Plugin): PluginAcquisition =>
  plugin.acquire === undefined ? Effect.succeed(plugin) : plugin.acquire;
