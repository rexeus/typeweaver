// @ts-check

import fs from "node:fs";
import {
  PluginConfigError,
  PluginExecutionError,
  definePlugin,
} from "@rexeus/typeweaver-gen";
import { Context, Data, Effect, Exit, Layer, Scope } from "effect";

/** @typedef {import("@rexeus/typeweaver-gen").Plugin} Plugin */
/** @typedef {import("@rexeus/typeweaver-gen").PluginFactory} PluginFactory */
/** @typedef {import("@rexeus/typeweaver-gen").PluginExecutionPhase} PluginExecutionPhase */
/** @typedef {{ readonly eventsPath?: string }} ScopedServicePluginOptions */
/** @typedef {{ readonly record: (event: string) => Effect.Effect<void, EventLogError> }} ScopedResourceService */
/**
 * @typedef {{
 *   readonly scope: Scope.CloseableScope;
 *   readonly services: Context.Context<ScopedResourceService>;
 * }} ScopedResourceRuntime
 */

const PLUGIN_NAME = "scoped-service";

class EventLogError extends Data.TaggedError("EventLogError") {
  /** @param {{ readonly cause: unknown }} fields */
  constructor(fields) {
    super(fields);
  }
}

/** @type {Context.Tag<ScopedResourceService, ScopedResourceService>} */
const ScopedResource = Context.GenericTag("typeweaver/examples/ScopedResource");

/**
 * @param {string | undefined} eventsPath
 * @param {string} event
 * @returns {Effect.Effect<void, EventLogError>}
 */
const appendEvent = (eventsPath, event) => {
  if (eventsPath === undefined) {
    return Effect.void;
  }

  return Effect.try({
    try: () => {
      fs.appendFileSync(eventsPath, `${event}\n`);
    },
    catch: cause => new EventLogError({ cause }),
  });
};

/** @param {string | undefined} eventsPath */
const scopedResourceLayer = eventsPath => {
  /** @type {ScopedResourceService} */
  const service = {
    record: event => appendEvent(eventsPath, event),
  };

  return Layer.scoped(
    ScopedResource,
    Effect.acquireRelease(
      service.record("acquire").pipe(Effect.as(service)),
      resource =>
        resource
          .record("release")
          .pipe(
            Effect.catchAll(error =>
              Effect.logWarning(
                `Scoped-service release event could not be recorded: ${String(error.cause)}`
              )
            )
          )
    )
  );
};

/**
 * @param {unknown} options
 * @returns {ScopedServicePluginOptions}
 */
const parseOptions = options => {
  if (
    typeof options !== "object" ||
    options === null ||
    Array.isArray(options)
  ) {
    throw new PluginConfigError({
      pluginName: PLUGIN_NAME,
      reason: "options must be an object",
    });
  }

  const eventsPath = Reflect.get(options, "eventsPath");
  if (eventsPath !== undefined && typeof eventsPath !== "string") {
    throw new PluginConfigError({
      pluginName: PLUGIN_NAME,
      reason: "eventsPath must be a string when provided",
    });
  }

  return eventsPath === undefined ? {} : { eventsPath };
};

/**
 * @param {PluginExecutionPhase} phase
 * @param {unknown} cause
 */
const executionError = (phase, cause) =>
  new PluginExecutionError({
    pluginName: PLUGIN_NAME,
    phase,
    cause,
  });

/**
 * The standard loader calls plugin factories synchronously. Resource
 * acquisition therefore belongs in `initialize`, while the matching Scope is
 * retained by this per-generation plugin instance until `finalize`.
 *
 * @type {PluginFactory}
 */
export const scopedServicePlugin = (options = {}) => {
  const { eventsPath } = parseOptions(options);
  /** @type {ScopedResourceRuntime | undefined} */
  let runtime;

  /**
   * @param {string} event
   * @returns {Effect.Effect<void, EventLogError>}
   */
  const recordWithResource = event =>
    Effect.suspend(() => {
      const current = runtime;
      if (current === undefined) {
        return Effect.dieMessage(
          "scoped-service plugin used before successful initialization"
        );
      }

      return Effect.flatMap(ScopedResource, resource =>
        resource.record(event)
      ).pipe(Effect.provide(current.services));
    });

  return definePlugin({
    name: PLUGIN_NAME,

    initialize: () =>
      Effect.acquireUseRelease(
        Scope.make(),
        scope =>
          Layer.buildWithScope(scopedResourceLayer(eventsPath), scope).pipe(
            Effect.tap(services =>
              Effect.sync(() => {
                runtime = { scope, services };
              })
            )
          ),
        (scope, exit) =>
          Exit.isFailure(exit) ? Scope.close(scope, exit) : Effect.void
      ).pipe(
        Effect.asVoid,
        Effect.mapError(cause => executionError("initialize", cause))
      ),

    generate: context =>
      Effect.gen(function* () {
        yield* recordWithResource("generate");
        yield* context.writeFileEffect(
          "scoped-service/session.txt",
          "generated through a scoped service\n"
        );
      }).pipe(Effect.mapError(cause => executionError("generate", cause))),

    finalize: () =>
      Effect.suspend(() => {
        const current = runtime;
        runtime = undefined;
        if (current === undefined) {
          return Effect.void;
        }

        return Effect.flatMap(ScopedResource, resource =>
          resource.record("finalize")
        ).pipe(
          Effect.provide(current.services),
          // Plugin.finalize does not receive the generator's Exit. This pattern
          // therefore owns exit-independent resources and closes them with a
          // neutral Exit after the plugin's final work has completed.
          Effect.ensuring(Scope.close(current.scope, Exit.void)),
          Effect.mapError(cause => executionError("finalize", cause))
        );
      }),
  });
};

export default scopedServicePlugin;
