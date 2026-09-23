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
 * Runtime cell keyed by the fiber that invokes a lifecycle hook. Keying a
 * `WeakMap` by the fiber object isolates concurrent generations that share one
 * plugin instance and does not leak across runs.
 *
 * Unlike an Effect 3 `FiberRef`, the entry is not inherited by child fibers.
 * The host must invoke `initialize`, `collectResources`, `generate`, and
 * `finalize` on the same orchestrating fiber, as the generator and
 * `createPluginTestKit` do. A hook that the host runs on a forked fiber, for
 * example through `Effect.timeout` or `Effect.race`, finds no retained runtime
 * and dies. Forks inside a hook body are unaffected because the retained
 * services are provided through the inherited Context.
 *
 * RC.116 offers no public fiber-local cell that survives across separately
 * invoked effects and is inherited by forks: a Context change made inside a
 * hook is restored when an enclosing `Effect.provide` or `Effect.withSpan`
 * exits.
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

      // `Layer.buildWithScope` would fork the ambient memo map, so inside a
      // runtime that already built this Layer value the generation would reuse
      // that instance and never acquire or release its own. A private memo map
      // (as `Effect.provide(layer, { local: true })` uses) also becomes the
      // `CurrentMemoMap` of the build and of the retained services, so Layers
      // built inside the plugin's Layer or hooks are not shared with the host.
      const memoMap = yield* Layer.makeMemoMap;
      yield* Effect.acquireUseRelease(
        Scope.make(),
        scope =>
          Layer.buildWithMemoMap(definition.layer, memoMap, scope).pipe(
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
 * runtime cell for the current generation, and closed by `finalize`. The build
 * uses a private memo map, so neither the Layer nor a Layer built inside it or
 * inside a hook reuses an instance that an enclosing runtime already built;
 * every generation acquires and releases its own resources. Failed,
 * defective, or interrupted initialization closes its provisional Scope before
 * the failure escapes. Once initialization succeeds, the generator's
 * unconditional finalization boundary guarantees release after success, typed
 * failure, defect, or interruption in downstream lifecycle stages. Hosts must
 * invoke every lifecycle hook on the same fiber.
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
