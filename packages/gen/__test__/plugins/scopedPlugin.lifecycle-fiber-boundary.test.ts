import { assert, it } from "@effect/vitest";
import { Context, Effect, Layer } from "effect";
import { describe } from "vitest";
import {
  acquirePluginLifecycle,
  createPluginTestKit,
  defineScopedPlugin,
} from "../../src/index.js";
import type { NormalizedSpec } from "../../src/index.js";

type Session = {
  readonly id: string;
};

const Session = Context.Service<Session>(
  "typeweaver/plugin-tests/FiberBoundarySession"
);

const emptySpec: NormalizedSpec = {
  metadata: {
    title: "Scoped Plugin Fiber Boundary Test API",
    version: "1.0.0",
  },
  securitySchemes: [],
  security: { requirements: [], source: "none" },
  resources: [],
  responses: [],
  warnings: [],
};

const makeSessionLayer = (events: string[]) =>
  Layer.effect(
    Session,
    Effect.acquireRelease(
      Effect.sync(() => {
        events.push("acquire");
        return { id: "session" };
      }),
      () =>
        Effect.sync(() => {
          events.push("release");
        })
    )
  );

const recordSession = (events: string[], phase: string) =>
  Effect.flatMap(Session, session =>
    Effect.sync(() => {
      events.push(`${phase}:${session.id}`);
    })
  );

const forkInsideHookBody = () =>
  Effect.gen(function* () {
    const events: string[] = [];
    const plugin = defineScopedPlugin({
      name: "scoped-fiber-boundary",
      layer: makeSessionLayer(events),
      generate: () =>
        recordSession(events, "generate").pipe(Effect.timeout("1 second")),
    });

    yield* createPluginTestKit({ normalizedSpec: emptySpec }).run(plugin);

    assert.deepStrictEqual(events, ["acquire", "generate:session", "release"]);
  });

const withTimeout = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(Effect.timeout("1 second"));

const hostRunsEveryHookUnderTimeout = () =>
  Effect.gen(function* () {
    const events: string[] = [];
    const plugin = defineScopedPlugin({
      name: "scoped-fiber-boundary",
      layer: makeSessionLayer(events),
      initialize: () => recordSession(events, "initialize"),
      generate: () => recordSession(events, "generate"),
      finalize: () => recordSession(events, "finalize"),
    });
    const kit = createPluginTestKit({ normalizedSpec: emptySpec });
    const pluginContext = kit.buildPluginContext();

    yield* Effect.scoped(
      Effect.gen(function* () {
        const hooks = yield* withTimeout(acquirePluginLifecycle(plugin));
        yield* withTimeout(hooks.initialize?.(pluginContext) ?? Effect.void);
        yield* withTimeout(
          hooks.generate?.(kit.buildGeneratorContext()) ?? Effect.void
        );
        yield* withTimeout(hooks.finalize?.(pluginContext) ?? Effect.void);
        assert.deepStrictEqual(events, [
          "acquire",
          "initialize:session",
          "generate:session",
          "finalize:session",
        ]);
      })
    );

    assert.deepStrictEqual(events.at(-1), "release");
  });

describe("defineScopedPlugin lifecycle fiber boundary", () => {
  it.effect(
    "provides acquired services to fibers forked inside a hook body",
    forkInsideHookBody
  );

  it.effect(
    "runs every hook when the host invokes acquisition and hooks under Effect.timeout",
    hostRunsEveryHookUnderTimeout
  );
});
