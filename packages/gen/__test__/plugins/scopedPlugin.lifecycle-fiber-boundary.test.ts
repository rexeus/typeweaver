import { assert, it } from "@effect/vitest";
import { Cause, Context, Effect, Exit, Layer } from "effect";
import { describe } from "vitest";
import { createPluginTestKit, defineScopedPlugin } from "../../src/index.js";
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

const makeForkingPlugin = (observed: string[]) =>
  defineScopedPlugin({
    name: "scoped-fiber-boundary",
    layer: Layer.succeed(Session, { id: "session" }),
    generate: () =>
      Effect.flatMap(Session, session =>
        Effect.sync(() => {
          observed.push(session.id);
        })
      ).pipe(Effect.timeout("1 second")),
  });

const forkInsideHookBody = () =>
  Effect.gen(function* () {
    const observed: string[] = [];

    yield* createPluginTestKit({ normalizedSpec: emptySpec }).run(
      makeForkingPlugin(observed)
    );

    assert.deepStrictEqual(observed, ["session"]);
  });

const hostForksHook = () =>
  Effect.gen(function* () {
    const observed: string[] = [];
    const plugin = makeForkingPlugin(observed);
    const kit = createPluginTestKit({ normalizedSpec: emptySpec });
    const pluginContext = kit.buildPluginContext();

    yield* plugin.initialize?.(pluginContext) ?? Effect.void;
    const exit = yield* Effect.exit(
      (plugin.generate?.(kit.buildGeneratorContext()) ?? Effect.void).pipe(
        Effect.timeout("1 second")
      )
    );
    yield* plugin.finalize?.(pluginContext) ?? Effect.void;

    assert.isTrue(Exit.isFailure(exit) && Cause.hasDies(exit.cause));
    assert.deepStrictEqual(observed, []);
  });

describe("defineScopedPlugin lifecycle fiber boundary", () => {
  it.effect(
    "provides retained services to fibers forked inside a hook body",
    forkInsideHookBody
  );

  it.effect(
    "dies when the host runs a hook on a fiber other than the one that initialized it",
    hostForksHook
  );
});
