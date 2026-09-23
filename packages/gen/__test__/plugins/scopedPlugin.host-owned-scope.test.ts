import { assert, it } from "@effect/vitest";
import {
  Cause,
  Context,
  Data,
  Deferred,
  Effect,
  Exit,
  Layer,
  Ref,
} from "effect";
import { describe } from "vitest";
import {
  PluginExecutionError,
  acquirePluginLifecycle,
  createPluginTestKit,
  defineScopedPlugin,
} from "../../src/index.js";
import type { NormalizedSpec, Plugin } from "../../src/index.js";

type Connection = {
  readonly id: number;
};

const Connection = Context.Service<Connection>(
  "typeweaver/plugin-tests/HostOwnedScopeConnection"
);

type Session = {
  readonly connectionId: number;
};

const Session = Context.Service<Session>(
  "typeweaver/plugin-tests/HostOwnedScopeSession"
);

class SessionOpenError extends Data.TaggedError("SessionOpenError")<{
  readonly message: string;
}> {}

const emptySpec: NormalizedSpec = {
  metadata: { title: "Scoped Plugin Host Scope Test API", version: "1.0.0" },
  securitySchemes: [],
  security: { requirements: [], source: "none" },
  resources: [],
  responses: [],
  warnings: [],
};

const makeConnectionLayer = (events: string[]) => {
  let nextId = 0;
  return Layer.effect(
    Connection,
    Effect.acquireRelease(
      Effect.sync(() => {
        nextId += 1;
        events.push(`acquire:${nextId}`);
        return { id: nextId };
      }),
      connection =>
        Effect.sync(() => {
          events.push(`release:${connection.id}`);
        })
    )
  );
};

const validationDoesNotAcquire = () =>
  Effect.gen(function* () {
    const events: string[] = [];
    const plugin = defineScopedPlugin({
      name: "scoped-validate-only",
      layer: makeConnectionLayer(events),
      validate: () => Effect.succeed([]),
    });
    const kit = createPluginTestKit({ normalizedSpec: emptySpec });

    const issues = yield* (
      plugin.validate?.(emptySpec, kit.buildValidationContext()) ??
        Effect.succeed([])
    );

    assert.deepStrictEqual(issues, []);
    assert.deepStrictEqual(events, []);
  });

const acquisitionFailureReleasesPartialResources = () =>
  Effect.gen(function* () {
    const events: string[] = [];
    const failingSession = Layer.effect(
      Session,
      Effect.flatMap(Connection, connection =>
        Effect.fail(
          new SessionOpenError({
            message: `session refused on connection ${connection.id}`,
          })
        )
      )
    );
    const plugin = defineScopedPlugin({
      name: "scoped-partial-acquisition",
      layer: Layer.provideMerge(failingSession, makeConnectionLayer(events)),
      initialize: () => Effect.sync(() => events.push("initialize")),
      finalize: () => Effect.sync(() => events.push("finalize")),
    });

    const exit = yield* Effect.exit(
      createPluginTestKit({ normalizedSpec: emptySpec }).run(plugin)
    );

    assert.isTrue(Exit.isFailure(exit));
    if (Exit.isFailure(exit)) {
      const failure = Cause.findErrorOption(exit.cause);
      assert.isTrue(
        failure._tag === "Some" &&
          failure.value instanceof PluginExecutionError &&
          failure.value.phase === "initialize" &&
          failure.value.cause instanceof SessionOpenError
      );
    }
    assert.deepStrictEqual(events, ["acquire:1", "release:1"]);
  });

const onForkedFiber = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(Effect.timeout("5 seconds"));

/**
 * A host that runs one generation of `plugin` in its own Scope and invokes
 * the acquisition and every hook on a forked fiber. It finalizes only once
 * both concurrent generations have generated, so their lifetimes overlap.
 */
const runForkingHostGeneration = (
  plugin: Plugin,
  bothGenerating: Deferred.Deferred<void>
) =>
  Effect.scoped(
    Effect.gen(function* () {
      const kit = createPluginTestKit({ normalizedSpec: emptySpec });
      const hooks = yield* onForkedFiber(acquirePluginLifecycle(plugin));
      yield* onForkedFiber(
        hooks.generate?.(kit.buildGeneratorContext()) ?? Effect.void
      );
      yield* Deferred.await(bothGenerating);
      yield* onForkedFiber(
        hooks.finalize?.(kit.buildPluginContext()) ?? Effect.void
      );
    })
  );

const concurrentForkingHosts = () =>
  Effect.gen(function* () {
    const events: string[] = [];
    const generating = yield* Ref.make(0);
    const bothGenerating = yield* Deferred.make<void>();
    const observe = (phase: string) =>
      Effect.flatMap(Connection, connection =>
        Effect.sync(() => events.push(`${phase}:${connection.id}`))
      );
    const plugin = defineScopedPlugin({
      name: "scoped-forking-hosts",
      layer: makeConnectionLayer(events),
      generate: () =>
        observe("generate").pipe(
          Effect.andThen(Ref.updateAndGet(generating, count => count + 1)),
          Effect.flatMap(count =>
            count === 2
              ? Deferred.succeed(bothGenerating, undefined)
              : Effect.void
          )
        ),
      finalize: () => observe("finalize"),
    });

    yield* Effect.all(
      [
        runForkingHostGeneration(plugin, bothGenerating),
        runForkingHostGeneration(plugin, bothGenerating),
      ],
      { concurrency: "unbounded" }
    );

    const byConnection = (id: number) =>
      events.filter(event => event.endsWith(`:${id}`));
    assert.deepStrictEqual(byConnection(1), [
      "acquire:1",
      "generate:1",
      "finalize:1",
      "release:1",
    ]);
    assert.deepStrictEqual(byConnection(2), [
      "acquire:2",
      "generate:2",
      "finalize:2",
      "release:2",
    ]);
  });

describe("defineScopedPlugin with a host-owned generation Scope", () => {
  it.effect(
    "never builds the Layer for a validation-only run",
    validationDoesNotAcquire
  );

  it.effect(
    "releases partially built resources and reports the initialize phase when acquisition fails",
    acquisitionFailureReleasesPartialResources
  );

  it.effect(
    "isolates concurrent generations whose hosts run every hook on a forked fiber",
    concurrentForkingHosts
  );
});
