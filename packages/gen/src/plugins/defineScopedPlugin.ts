import { Effect, Layer } from "effect";
import { PluginExecutionError } from "./errors/PluginExecutionError.js";
import { definePlugin } from "./Plugin.js";
import type { Issue } from "../issues/Issue.js";
import type { NormalizedSpec } from "../NormalizedSpec.js";
import type {
  GeneratorContext,
  PluginContext,
  PluginValidationContext,
} from "./contextTypes.js";
import type { PluginExecutionPhase } from "./errors/PluginExecutionError.js";
import type { Plugin, PluginLifecycleHooks } from "./Plugin.js";
import type { Context } from "effect";

/**
 * Public definition for a plugin that owns one scoped Effect Layer for the
 * duration of a generation call. Service-dependent hooks may use the Layer's
 * output directly in their Effect requirement channel; the helper provides
 * the acquired Context before exposing the ordinary `Plugin` contract.
 */
export type ScopedPluginDefinition<Services> = {
  readonly name: string;
  readonly depends?: readonly string[];
  readonly layer: Layer.Layer<Services, unknown>;
  readonly validate?: (
    normalizedSpec: NormalizedSpec,
    context: PluginValidationContext
  ) => Effect.Effect<readonly Issue[], unknown>;
  readonly initialize?: (
    context: PluginContext
  ) => Effect.Effect<void, unknown, Services>;
  readonly collectResources?: (
    normalizedSpec: NormalizedSpec
  ) => Effect.Effect<NormalizedSpec, unknown, Services>;
  readonly generate?: (
    context: GeneratorContext
  ) => Effect.Effect<void, unknown, Services>;
  readonly finalize?: (
    context: PluginContext
  ) => Effect.Effect<void, unknown, Services>;
};

const executionError = (
  pluginName: string,
  phase: PluginExecutionPhase,
  cause: unknown
): PluginExecutionError =>
  new PluginExecutionError({ pluginName, phase, cause });

type ServiceHookPhase = Exclude<PluginExecutionPhase, "validate">;

const makeLifecycleHooks = <Services>(
  definition: ScopedPluginDefinition<Services>,
  services: Context.Context<Services>
): PluginLifecycleHooks => {
  const run = <A>(
    phase: ServiceHookPhase,
    effect: Effect.Effect<A, unknown, Services>
  ): Effect.Effect<A, PluginExecutionError> =>
    effect.pipe(
      Effect.provide(services),
      Effect.mapError(cause => executionError(definition.name, phase, cause))
    );
  const { initialize, collectResources, generate, finalize } = definition;

  return {
    ...(initialize === undefined
      ? {}
      : {
          initialize: (context: PluginContext) =>
            run("initialize", initialize(context)),
        }),
    ...(collectResources === undefined
      ? {}
      : {
          collectResources: (normalizedSpec: NormalizedSpec) =>
            run("collectResources", collectResources(normalizedSpec)),
        }),
    ...(generate === undefined
      ? {}
      : {
          generate: (context: GeneratorContext) =>
            run("generate", generate(context)),
        }),
    ...(finalize === undefined
      ? {}
      : {
          finalize: (context: PluginContext) =>
            run("finalize", finalize(context)),
        }),
  };
};

/**
 * Builds the Layer into the host's generation Scope and returns hooks closed
 * over the built services.
 *
 * `Layer.buildWithScope` would fork the ambient memo map, so inside a runtime
 * that already built this Layer value the generation would reuse that
 * instance and never acquire or release its own. A private memo map (as
 * `Effect.provide(layer, { local: true })` uses) also becomes the
 * `CurrentMemoMap` of the build and of the provided services, so Layers built
 * inside the plugin's Layer or hooks are not shared with the host.
 */
const acquireLifecycleHooks = <Services>(
  definition: ScopedPluginDefinition<Services>
) =>
  Effect.gen(function* () {
    const memoMap = yield* Layer.makeMemoMap;
    const scope = yield* Effect.scope;
    const services = yield* Layer.buildWithMemoMap(
      definition.layer,
      memoMap,
      scope
    );
    return makeLifecycleHooks(definition, services);
  }).pipe(
    Effect.mapError(cause =>
      executionError(definition.name, "initialize", cause)
    )
  );

/**
 * Defines a service-dependent plugin while keeping every public lifecycle hook
 * at `R = never`.
 *
 * The returned plugin is a scoped constructor: the host runs its `acquire` in
 * a Scope that the host owns for exactly one generation. Acquisition builds
 * the Layer once, with a private memo map, so neither the Layer nor a Layer
 * built inside it or inside a hook reuses an instance that an enclosing
 * runtime already built. Every generation, including concurrent ones that
 * share this plugin instance, acquires its own resources, and the host
 * releases them when it closes the generation Scope after `finalize`, on
 * success, typed failure, defect, and interruption. `validate` stays outside
 * the acquisition and never builds the Layer.
 */
export const defineScopedPlugin = <Services>(
  definition: ScopedPluginDefinition<Services>
): Plugin => {
  const validateHook = definition.validate;

  return definePlugin({
    name: definition.name,
    ...(definition.depends === undefined
      ? {}
      : { depends: definition.depends }),
    ...(validateHook === undefined
      ? {}
      : {
          validate: (
            normalizedSpec: NormalizedSpec,
            context: PluginValidationContext
          ) =>
            validateHook(normalizedSpec, context).pipe(
              Effect.mapError(cause =>
                executionError(definition.name, "validate", cause)
              )
            ),
        }),
    acquire: acquireLifecycleHooks(definition),
  });
};
