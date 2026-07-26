import { Context, Effect, Exit, FiberRef, Layer, Scope } from "effect";
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

type ScopedPluginRuntimeRef<Services> = FiberRef.FiberRef<
  ScopedPluginRuntime<Services> | undefined
>;

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
    runtimeRef: ScopedPluginRuntimeRef<Services>
  ) =>
  <A>(
    phase: Exclude<PluginExecutionPhase, "validate" | "initialize">,
    effect: () => Effect.Effect<A, unknown, Services>
  ): Effect.Effect<A, PluginExecutionError> =>
    Effect.gen(function* () {
      const current = yield* FiberRef.get(runtimeRef);
      if (current === undefined) {
        return yield* Effect.dieMessage(
          `Scoped plugin '${definition.name}' used before successful initialization`
        );
      }

      return yield* effect().pipe(
        Effect.provide(current.services),
        Effect.mapError(cause => executionError(definition.name, phase, cause))
      );
    });

const makeInitialize = <Services>(
  definition: ScopedPluginDefinition<Services>,
  runtimeRef: ScopedPluginRuntimeRef<Services>
) => {
  const initializeHook = definition.initialize;
  return (context: PluginContext): Effect.Effect<void, PluginExecutionError> =>
    Effect.gen(function* () {
      const current = yield* FiberRef.get(runtimeRef);
      if (current !== undefined) {
        return yield* Effect.dieMessage(
          `Scoped plugin '${definition.name}' initialized more than once without finalization`
        );
      }

      yield* Effect.acquireUseRelease(
        Scope.make(),
        scope =>
          Layer.buildWithScope(definition.layer, scope).pipe(
            Effect.tap(services =>
              FiberRef.set(runtimeRef, { scope, services })
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
                Effect.ensuring(FiberRef.set(runtimeRef, undefined))
              )
            : Effect.void
      );
    }).pipe(
      Effect.asVoid,
      Effect.mapError(cause =>
        executionError(definition.name, "initialize", cause)
      )
    );
};

const makeFinalize = <Services>(
  definition: ScopedPluginDefinition<Services>,
  runtimeRef: ScopedPluginRuntimeRef<Services>
) => {
  const finalizeHook = definition.finalize;
  return (context: PluginContext): Effect.Effect<void, PluginExecutionError> =>
    Effect.gen(function* () {
      const current = yield* FiberRef.get(runtimeRef);
      yield* FiberRef.set(runtimeRef, undefined);
      if (current === undefined) {
        return;
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

      yield* finalizeEffect.pipe(
        Effect.ensuring(Scope.close(current.scope, Exit.void))
      );
    });
};

/**
 * Defines a service-dependent plugin while keeping every public lifecycle hook
 * at `R = never`.
 *
 * The Layer is built exactly once by `initialize`, retained in a plugin-local
 * FiberRef for the current generation fiber, and closed by `finalize`. Failed,
 * defective, or interrupted initialization closes its provisional Scope before
 * the failure escapes. Once initialization succeeds, the generator's
 * unconditional finalization boundary guarantees release after success, typed
 * failure, defect, or interruption in downstream lifecycle stages.
 */
export const defineScopedPlugin = <Services>(
  definition: ScopedPluginDefinition<Services>
): Plugin => {
  const runtimeRef = FiberRef.unsafeMake<
    ScopedPluginRuntime<Services> | undefined
  >(undefined, {
    fork: current => current,
    join: parent => parent,
  });
  const validateHook = definition.validate;
  const collectResourcesHook = definition.collectResources;
  const generateHook = definition.generate;
  const withRuntime = makeRuntimeProvider(definition, runtimeRef);

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
    initialize: makeInitialize(definition, runtimeRef),
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
    finalize: makeFinalize(definition, runtimeRef),
  });
};
