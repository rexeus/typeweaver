import { Context, Effect, Exit, Layer, Scope } from "effect";
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
import type { Plugin } from "./Plugin.js";

type ScopedPluginRuntime<Services> = {
  readonly scope: Scope.CloseableScope;
  readonly services: Context.Context<Services>;
};

type ScopedPluginRuntimeState<Services> = {
  current: ScopedPluginRuntime<Services> | undefined;
};

/**
 * Public definition for a plugin that owns one scoped Effect Layer for the
 * duration of a generation call. Service-dependent hooks may use the Layer's
 * output directly in their Effect requirement channel; the helper provides
 * the retained Context before exposing the ordinary `Plugin` contract.
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

const makeRuntimeProvider =
  <Services>(
    definition: ScopedPluginDefinition<Services>,
    state: ScopedPluginRuntimeState<Services>
  ) =>
  <A>(
    phase: Exclude<PluginExecutionPhase, "validate" | "initialize">,
    effect: () => Effect.Effect<A, unknown, Services>
  ): Effect.Effect<A, PluginExecutionError> =>
    Effect.suspend(() => {
      const current = state.current;
      if (current === undefined) {
        return Effect.dieMessage(
          `Scoped plugin '${definition.name}' used before successful initialization`
        );
      }

      return effect().pipe(
        Effect.provide(current.services),
        Effect.mapError(cause => executionError(definition.name, phase, cause))
      );
    });

const makeInitialize = <Services>(
  definition: ScopedPluginDefinition<Services>,
  state: ScopedPluginRuntimeState<Services>
) => {
  const initializeHook = definition.initialize;
  return (context: PluginContext): Effect.Effect<void, PluginExecutionError> =>
    Effect.suspend(() => {
      if (state.current !== undefined) {
        return Effect.dieMessage(
          `Scoped plugin '${definition.name}' initialized more than once without finalization`
        );
      }

      return Effect.acquireUseRelease(
        Scope.make(),
        scope =>
          Layer.buildWithScope(definition.layer, scope).pipe(
            Effect.tap(services =>
              Effect.sync(() => {
                state.current = { scope, services };
              })
            ),
            Effect.flatMap(services =>
              initializeHook === undefined
                ? Effect.void
                : initializeHook(context).pipe(Effect.provide(services))
            )
          ),
        (scope, exit) =>
          Exit.isFailure(exit)
            ? Scope.close(scope, exit).pipe(
                Effect.ensuring(
                  Effect.sync(() => {
                    state.current = undefined;
                  })
                )
              )
            : Effect.void
      ).pipe(
        Effect.asVoid,
        Effect.mapError(cause =>
          executionError(definition.name, "initialize", cause)
        )
      );
    });
};

const makeFinalize = <Services>(
  definition: ScopedPluginDefinition<Services>,
  state: ScopedPluginRuntimeState<Services>
) => {
  const finalizeHook = definition.finalize;
  return (context: PluginContext): Effect.Effect<void, PluginExecutionError> =>
    Effect.suspend(() => {
      const current = state.current;
      state.current = undefined;
      if (current === undefined) {
        return Effect.void;
      }

      const finalizeEffect =
        finalizeHook === undefined
          ? Effect.void
          : finalizeHook(context).pipe(
              Effect.provide(current.services),
              Effect.mapError(cause =>
                executionError(definition.name, "finalize", cause)
              )
            );

      return finalizeEffect.pipe(
        Effect.ensuring(Scope.close(current.scope, Exit.void))
      );
    });
};

/**
 * Defines a service-dependent plugin while keeping every public lifecycle hook
 * at `R = never`.
 *
 * The Layer is built exactly once by `initialize`, retained in the
 * per-plugin closure, and closed by `finalize`. Failed, defective, or
 * interrupted initialization closes its provisional Scope before the failure
 * escapes. Once initialization succeeds, the generator's unconditional
 * finalization boundary guarantees release after success, typed failure,
 * defect, or interruption in downstream lifecycle stages.
 */
export const defineScopedPlugin = <Services>(
  definition: ScopedPluginDefinition<Services>
): Plugin => {
  const state: ScopedPluginRuntimeState<Services> = { current: undefined };
  const validateHook = definition.validate;
  const collectResourcesHook = definition.collectResources;
  const generateHook = definition.generate;
  const withRuntime = makeRuntimeProvider(definition, state);

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
    initialize: makeInitialize(definition, state),
    ...(collectResourcesHook === undefined
      ? {}
      : {
          collectResources: (normalizedSpec: NormalizedSpec) =>
            withRuntime("collectResources", () =>
              collectResourcesHook(normalizedSpec)
            ),
        }),
    ...(generateHook === undefined
      ? {}
      : {
          generate: (context: GeneratorContext) =>
            withRuntime("generate", () => generateHook(context)),
        }),
    finalize: makeFinalize(definition, state),
  });
};
