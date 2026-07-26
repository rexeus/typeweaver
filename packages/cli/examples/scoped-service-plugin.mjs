// @ts-check

import fs from "node:fs";
import { PluginConfigError, defineScopedPlugin } from "@rexeus/typeweaver-gen";
import { Context, Data, Effect, Layer } from "effect";

/** @typedef {import("@rexeus/typeweaver-gen").Plugin} Plugin */
/** @typedef {import("@rexeus/typeweaver-gen").PluginFactory} PluginFactory */
/** @typedef {{ readonly eventsPath?: string }} ScopedServicePluginOptions */
/** @typedef {{ readonly record: (event: string) => Effect.Effect<void, EventLogError> }} ScopedResourceService */

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
 * The standard loader calls plugin factories synchronously.
 * `defineScopedPlugin` owns one Layer/Scope for this per-generation plugin
 * instance and provides `ScopedResource` to every service-dependent hook.
 *
 * @type {PluginFactory}
 */
export const scopedServicePlugin = (options = {}) => {
  const { eventsPath } = parseOptions(options);

  return defineScopedPlugin({
    name: PLUGIN_NAME,
    layer: scopedResourceLayer(eventsPath),

    generate: context =>
      Effect.gen(function* () {
        const resource = yield* ScopedResource;
        yield* resource.record("generate");
        yield* context.writeFileEffect(
          "scoped-service/session.txt",
          "generated through a scoped service\n"
        );
      }),

    finalize: () =>
      Effect.flatMap(ScopedResource, resource => resource.record("finalize")),
  });
};

export default scopedServicePlugin;
