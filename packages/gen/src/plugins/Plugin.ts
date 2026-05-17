import { PluginExecutionError } from "./errors/PluginExecutionError.js";
import type { NormalizedSpec } from "../NormalizedSpec.js";
import type { GeneratorContext, PluginContext } from "./contextTypes.js";
import type { Effect } from "effect";

/**
 * Effect-native plugin. Plugin authors return Effects from each
 * lifecycle stage. The error channel is narrowed to PluginExecutionError;
 * other failures indicate programming bugs and propagate as defects.
 *
 * Plugins keep `R = never` on every lifecycle stage. Higher-order plugin
 * constructors (e.g. one that fetches a remote schema) take their config,
 * build any needed services inside `Effect.gen` at construction time, and
 * return a plain `Plugin` whose effects close over the resolved values.
 * The plugin author surface stays platform-agnostic; integrators write the
 * higher-order constructors.
 */
export type Plugin = {
  readonly name: string;
  readonly depends?: readonly string[];
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
   * Finalize failures are demoted to WARN logs and do not fail the run.
   * Use `generate` for any work whose failure must abort generation.
   */
  readonly finalize?: (
    context: PluginContext
  ) => Effect.Effect<void, PluginExecutionError>;
};

export const definePlugin = (plugin: Plugin): Plugin => plugin;
