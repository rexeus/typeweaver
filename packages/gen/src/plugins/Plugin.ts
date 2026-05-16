import type { Effect } from "effect";
import { PluginExecutionError } from "./errors/PluginExecutionError.js";
import type { NormalizedSpec } from "../NormalizedSpec.js";
import type { GeneratorContext, PluginContext } from "./contextTypes.js";

/**
 * Effect-native plugin. Plugin authors return Effects from each
 * lifecycle stage. The error channel is narrowed to PluginExecutionError;
 * other failures indicate programming bugs and propagate as defects.
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
  readonly finalize?: (
    context: PluginContext
  ) => Effect.Effect<void, PluginExecutionError>;
};

export const definePlugin = (plugin: Plugin): Plugin => plugin;
