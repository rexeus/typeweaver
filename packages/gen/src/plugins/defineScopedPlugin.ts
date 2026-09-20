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
  readonly scope: Scope.Closeable;
  readonly services: Context.Context<Services>;
};

/**
 * Per-fiber runtime cell. Effect 4 removed `FiberRef`; the current fiber object
 * is a stable, unique key for the duration of one generation run, so a
 * `WeakMap` keyed by it preserves the per-fiber isolation the previous
 * `FiberRef` provided without leaking across runs.
 */
type ScopedPluginRuntimeCell<Services> = {
  readonly get: Effect.Effect<ScopedPluginRuntime<Services> | undefined>;
  readonly set: (
    runtime: ScopedPluginRuntime<Services> | undefined
  ) => Effect.Effect<void>;
};

const makeRuntimeCell = <Services>(): ScopedPluginRuntimeCell<Services> => {
  const runtimes = new WeakMap<object, ScopedPluginRuntime<Services>>();
  return {
    get: Effect.withFiberSucceed(fiber => runtimes.get(fiber)),
    set: runtime =>
      Effect.withFiberSucceed(fiber => {
        if (runtime === undefined) {
          runtimes.delete(fiber);
          return;
        }
        runtimes.set(fiber, runtime);
      }),
  };
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
    runtimeCell: ScopedPluginRuntimeCell<Services>
  ) =>
  <A>(
    phase: Exclude<PluginExecutionPhase, "validate" | "initialize">,
    effect: () => Effect.Effect<A, unknown, Services>
  ): Effect.Effect<A, PluginExecutionError> =>
    Effect.gen(function* () {
      const current = yield* runtimeCell.get;
      if (current === undefined) {
        return yield* Effect.die(
          new Error(
            `Scoped plugin '${definition.name}' used before successful initialization`
          )
        );
      }

      return yield* effect().pipe(
        Effect.provide(current.services),
        Effect.mapError(cause => executionError(definition.name, phase, cause))
      );
    });

const makeInitialize = <Services>(
  definition: ScopedPluginDefinition<Services>,
  runtimeCell: ScopedPluginRuntimeCell<Services>
) => {
  const initializeHook = definition.initialize;
  return (context: PluginContext): Effect.Effect<void, PluginExecutionError> =>
    Effect.gen(function* () {
      const current = yield* runtimeCell.get;
      if (current !== undefined) {
        return yield* Effect.die(
          new Error(
            `Scoped plugin '${definition.name}' initialized more than once without finalization`
          )
        );
      }

      yield* Effect.acquireUseRelease(
        Scope.make(),
        scope =>
          Layer.buildWithScope(definition.layer, scope).pipe(
            Effect.tap(services => runtimeCell.set({ scope, services })),
            Effect.flatMap(services =>
              initializeHook === undefined
                ? Effect.void
                : initializeHook(context).pipe(Effect.provide(services))
            )
          ),
        (scope, exit) =>
          Exit.isFailure(exit)
            ? Scope.close(scope, exit).pipe(
                Effect.ensuring(runtimeCell.set(undefined))
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
  runtimeCell: ScopedPluginRuntimeCell<Services>
) => {
  const finalizeHook = definition.finalize;
  return (context: PluginContext): Effect.Effect<void, PluginExecutionError> =>
    Effect.gen(function* () {
      const current = yield* runtimeCell.get;
      yield* runtimeCell.set(undefined);
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
 * The Layer is built exactly once by `initialize`, retained in a per-fiber
 * runtime cell for the current generation, and closed by `finalize`. Failed,
 * defective, or interrupted initialization closes its provisional Scope before
 * the failure escapes. Once initialization succeeds, the generator's
 * unconditional finalization boundary guarantees release after success, typed
 * failure, defect, or interruption in downstream lifecycle stages.
 */
export const defineScopedPlugin = <Services>(
  definition: ScopedPluginDefinition<Services>
): Plugin => {
  const runtimeCell = makeRuntimeCell<Services>();
  const validateHook = definition.validate;
  const collectResourcesHook = definition.collectResources;
  const generateHook = definition.generate;
  const withRuntime = makeRuntimeProvider(definition, runtimeCell);

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
    initialize: makeInitialize(definition, runtimeCell),
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
    finalize: makeFinalize(definition, runtimeCell),
  });
};
