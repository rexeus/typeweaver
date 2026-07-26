import { PluginExecutionError } from "./errors/PluginExecutionError.js";
import type { Issue } from "../issues/Issue.js";
import type { NormalizedSpec } from "../NormalizedSpec.js";
import type {
  GeneratorContext,
  PluginConfig,
  PluginContext,
  PluginValidationContext,
} from "./contextTypes.js";
import type { Effect } from "effect";

/**
 * Effect-native plugin. Plugin authors return Effects from each
 * lifecycle stage. The error channel is narrowed to PluginExecutionError;
 * other failures indicate programming bugs and propagate as defects.
 *
 * Plugins keep `R = never` on every lifecycle stage. A service-dependent
 * plugin uses a synchronous `PluginFactory` to create per-generation state,
 * acquires its private Layer/Scope in `initialize`, and releases that Scope
 * from `finalize`. The standard loader never runs an Effect-returning factory.
 */
export type Plugin = {
  readonly name: string;
  readonly depends?: readonly string[];
  readonly validate?: (
    normalizedSpec: NormalizedSpec,
    context: PluginValidationContext
  ) => Effect.Effect<readonly Issue[], PluginExecutionError>;
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
 * Public construction contract for configurable plugins. The loader calls
 * this function once per generation. It must validate options and return the
 * plugin synchronously; resource acquisition belongs in `initialize`.
 */
export type PluginFactory = (config?: PluginConfig) => Plugin;

export const definePlugin = (plugin: Plugin): Plugin => plugin;
