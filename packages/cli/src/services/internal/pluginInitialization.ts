import { acquirePluginLifecycle } from "@rexeus/typeweaver-gen";
import type {
  PluginAcquisition,
  PluginContext,
  PluginLifecycleHooks,
  PluginRegistration,
} from "@rexeus/typeweaver-gen";
import { Effect } from "effect";

/**
 * A plugin whose initialize stage succeeded in this generation, with the
 * lifecycle hooks it acquired in the generation Scope.
 */
export type InitializedPlugin = {
  readonly registration: PluginRegistration;
  readonly hooks: PluginLifecycleHooks;
};

type InitializePluginsParams = {
  readonly registrations: readonly PluginRegistration[];
  readonly pluginContext: PluginContext;
  readonly initialized: InitializedPlugin[];
};

const markPluginInitialized = (
  initialized: InitializedPlugin[],
  plugin: InitializedPlugin
): Effect.Effect<void> =>
  Effect.sync(() => {
    initialized.push(plugin);
  });

/**
 * The initialize stage: acquires the plugin's hooks in the generation Scope,
 * then runs its `initialize` hook. A plugin with neither emits no span.
 */
const acquireAndInitialize = (
  registration: PluginRegistration,
  pluginContext: PluginContext
): PluginAcquisition => {
  const plugin = registration.plugin;
  if (plugin.acquire === undefined && plugin.initialize === undefined) {
    return Effect.succeed(plugin);
  }
  return acquirePluginLifecycle(plugin).pipe(
    Effect.tap(hooks => hooks.initialize?.(pluginContext) ?? Effect.void),
    Effect.withSpan("typeweaver.plugin.initialize", {
      attributes: { plugin: plugin.name },
    })
  );
};

const initializePlugin = Effect.fn(function* (params: {
  readonly registration: PluginRegistration;
  readonly pluginContext: PluginContext;
  readonly initialized: InitializedPlugin[];
}) {
  yield* Effect.logDebug(
    `Initializing plugin: ${params.registration.plugin.name}`
  );
  yield* Effect.uninterruptibleMask(restore =>
    restore(
      acquireAndInitialize(params.registration, params.pluginContext)
    ).pipe(
      Effect.tap(hooks =>
        markPluginInitialized(params.initialized, {
          registration: params.registration,
          hooks,
        })
      )
    )
  );
});

/**
 * Initializes every plugin in registration order. A plugin joins
 * `initialized`, and so becomes eligible for `finalize`, in the same masked
 * step in which its acquisition and `initialize` hook succeed. Its acquired
 * resources belong to the caller's Scope.
 */
export const initializePlugins = Effect.fn(function* (
  params: InitializePluginsParams
) {
  yield* Effect.logInfo("Initializing plugins...");
  yield* Effect.forEach(
    params.registrations,
    registration =>
      initializePlugin({
        registration,
        pluginContext: params.pluginContext,
        initialized: params.initialized,
      }),
    { discard: true }
  );
});
