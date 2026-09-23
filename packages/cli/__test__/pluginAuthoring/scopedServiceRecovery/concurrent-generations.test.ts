import type { Plugin } from "@rexeus/typeweaver-gen";
import { assert, it } from "@effect/vitest";
import { Deferred, Effect, Exit, Fiber } from "effect";
import {
  collectOwnedArtifacts,
  createWorkspace,
  generation,
  makeGeneratorLayer,
  makeProbeState,
  makeResourceLayer,
  makeScopedProbePlugin,
  removeWorkspace,
} from "./fixtures.js";

it.effect(
  "keeps resources from two concurrent generations isolated and releases both identities",
  () =>
    Effect.acquireUseRelease(
      Effect.sync(() => [createWorkspace(), createWorkspace()] as const),
      workspaces =>
        Effect.gen(function* () {
          const state = makeProbeState();
          const bothGenerating = yield* Deferred.make<void>();
          const releaseGeneration = yield* Deferred.make<void>();
          let generatingCount = 0;
          const resourceLayer = makeResourceLayer({
            state,
            afterAcquire: () => Effect.void,
          });
          const pluginFactory = (): Plugin =>
            makeScopedProbePlugin({
              resourceLayer,
              onGenerate: resource =>
                Effect.sync(() => {
                  state.record("generate", resource);
                  generatingCount += 1;
                  return generatingCount;
                }).pipe(
                  Effect.tap(count =>
                    count === 2
                      ? Deferred.succeed(bothGenerating, undefined)
                      : Effect.void
                  ),
                  Effect.andThen(Deferred.await(releaseGeneration))
                ),
              onFinalize: resource =>
                Effect.sync(() => state.record("finalize", resource)),
            });
          const layer = makeGeneratorLayer(pluginFactory);

          yield* Effect.gen(function* () {
            const first = yield* Effect.forkChild(generation(workspaces[0]));
            const second = yield* Effect.forkChild(generation(workspaces[1]));

            yield* Deferred.await(bothGenerating);
            assert.deepStrictEqual(state.eventsByKind("acquire"), [1, 2]);
            assert.deepStrictEqual(state.liveResourceIds(), [1, 2]);

            yield* Deferred.succeed(releaseGeneration, undefined);
            const exits = yield* Fiber.awaitAll([first, second]);

            assert.isTrue(exits.every(Exit.isSuccess));
            assert.deepStrictEqual(state.eventsByKind("release"), [1, 2]);
            assert.deepStrictEqual(state.liveResourceIds(), []);
            for (const workspace of workspaces) {
              assert.deepStrictEqual(collectOwnedArtifacts(workspace), []);
            }
          }).pipe(Effect.provide(layer));
        }),
      workspaces =>
        Effect.sync(() => {
          for (const workspace of workspaces) {
            removeWorkspace(workspace);
          }
        })
    ),
  10_000
);
