import { assert, it } from "@effect/vitest";
import { Context, Data, Deferred, Effect, Fiber, Layer, Ref } from "effect";
import { describe, expect, test } from "vitest";
import { createPluginTestKit, defineScopedPlugin } from "../../src/index.js";
import type { NormalizedSpec } from "../../src/index.js";

type ResourceProbe = {
  readonly id: number;
};

const ResourceProbe = Context.GenericTag<ResourceProbe>(
  "typeweaver/plugin-tests/ResourceProbe"
);

class TestPluginError extends Data.TaggedError("TestPluginError")<{
  readonly message: string;
}> {}

const emptySpec: NormalizedSpec = {
  metadata: { title: "Scoped Plugin Test API", version: "1.0.0" },
  securitySchemes: [],
  security: { requirements: [], source: "none" },
  resources: [],
  responses: [],
  warnings: [],
};

const makeResourceLayer = (events: string[]) =>
  Layer.scoped(
    ResourceProbe,
    Effect.acquireRelease(
      Effect.sync(() => {
        const resource = { id: 1 };
        events.push(`acquire:${resource.id}`);
        return resource;
      }),
      resource =>
        Effect.sync(() => {
          events.push(`release:${resource.id}`);
        })
    )
  );

const concurrentScopedRuns = () =>
  Effect.gen(function* () {
    let nextResourceId = 0;
    const acquisitions: number[] = [];
    const releases: number[] = [];
    const observedIds: number[] = [];
    const entered = yield* Ref.make(0);
    const bothEntered = yield* Deferred.make<void>();
    const plugin = defineScopedPlugin({
      name: "scoped-concurrent",
      layer: Layer.scoped(
        ResourceProbe,
        Effect.acquireRelease(
          Effect.sync(() => {
            nextResourceId += 1;
            acquisitions.push(nextResourceId);
            return { id: nextResourceId };
          }),
          resource =>
            Effect.sync(() => {
              releases.push(resource.id);
            })
        )
      ),
      generate: () =>
        Effect.gen(function* () {
          const resource = yield* ResourceProbe;
          observedIds.push(resource.id);
          const enteredCount = yield* Ref.updateAndGet(
            entered,
            count => count + 1
          );
          if (enteredCount === 2) {
            yield* Deferred.succeed(bothEntered, undefined);
          }
          yield* Deferred.await(bothEntered);
        }),
    });
    const first = createPluginTestKit({ normalizedSpec: emptySpec });
    const second = createPluginTestKit({ normalizedSpec: emptySpec });

    yield* Effect.all([first.run(plugin), second.run(plugin)], {
      concurrency: "unbounded",
    });

    assert.deepStrictEqual(acquisitions, [1, 2]);
    assert.deepStrictEqual(
      observedIds.sort((left, right) => left - right),
      [1, 2]
    );
    assert.deepStrictEqual(
      releases.sort((left, right) => left - right),
      [1, 2]
    );
  });

describe("defineScopedPlugin successful lifecycle", () => {
  test("acquires one Layer per run and releases it after successful finalization", () => {
    const events: string[] = [];
    const plugin = defineScopedPlugin({
      name: "scoped-success",
      layer: makeResourceLayer(events),
      initialize: () =>
        Effect.flatMap(ResourceProbe, resource =>
          Effect.sync(() => {
            events.push(`initialize:${resource.id}`);
          })
        ),
      generate: () =>
        Effect.flatMap(ResourceProbe, resource =>
          Effect.sync(() => {
            events.push(`generate:${resource.id}`);
          })
        ),
      finalize: () =>
        Effect.flatMap(ResourceProbe, resource =>
          Effect.sync(() => {
            events.push(`finalize:${resource.id}`);
          })
        ),
    });
    const kit = createPluginTestKit({ normalizedSpec: emptySpec });

    Effect.runSync(kit.run(plugin));

    expect(events).toEqual([
      "acquire:1",
      "initialize:1",
      "generate:1",
      "finalize:1",
      "release:1",
    ]);
  });

  it.effect(
    "isolates one shared plugin instance across concurrent runs",
    concurrentScopedRuns
  );
});

describe("defineScopedPlugin failure recovery", () => {
  test.each(["typed failure", "defect"] as const)(
    "releases the acquired Layer after a downstream %s",
    failureKind => {
      const events: string[] = [];
      const plugin = defineScopedPlugin({
        name: "scoped-failure",
        layer: makeResourceLayer(events),
        generate: () =>
          failureKind === "typed failure"
            ? Effect.fail(new TestPluginError({ message: "typed failure" }))
            : Effect.die(new Error("defect")),
      });
      const kit = createPluginTestKit({ normalizedSpec: emptySpec });

      Effect.runSyncExit(kit.run(plugin));

      expect(events).toEqual(["acquire:1", "release:1"]);
    }
  );

  test("releases the provisional Layer when initialization fails", () => {
    const events: string[] = [];
    const plugin = defineScopedPlugin({
      name: "scoped-initialize-failure",
      layer: makeResourceLayer(events),
      initialize: () =>
        Effect.fail(new TestPluginError({ message: "initialize failed" })),
    });
    const kit = createPluginTestKit({ normalizedSpec: emptySpec });

    Effect.runSyncExit(kit.run(plugin));

    expect(events).toEqual(["acquire:1", "release:1"]);
  });
});

const interruptedGeneration = () =>
  Effect.gen(function* () {
    const events: string[] = [];
    const enteredGenerate = yield* Deferred.make<void>();
    const neverResume = yield* Deferred.make<void>();
    const plugin = defineScopedPlugin({
      name: "scoped-interruption",
      layer: makeResourceLayer(events),
      generate: () =>
        Deferred.succeed(enteredGenerate, undefined).pipe(
          Effect.zipRight(Deferred.await(neverResume))
        ),
    });
    const kit = createPluginTestKit({ normalizedSpec: emptySpec });
    const fiber = yield* Effect.fork(kit.run(plugin));

    yield* Deferred.await(enteredGenerate);
    const exit = yield* Fiber.interrupt(fiber);

    assert.isTrue(exit._tag === "Failure");
    assert.deepStrictEqual(events, ["acquire:1", "release:1"]);
  });

describe("defineScopedPlugin interruption recovery", () => {
  it.effect(
    "releases the acquired Layer when downstream generation is interrupted",
    interruptedGeneration
  );
});
