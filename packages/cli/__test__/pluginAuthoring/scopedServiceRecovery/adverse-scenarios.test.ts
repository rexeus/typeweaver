import { PluginExecutionError } from "@rexeus/typeweaver-gen";
import type { Plugin } from "@rexeus/typeweaver-gen";
import { assert, describe, it } from "@effect/vitest";
import { Cause, Deferred, Effect, Exit, Fiber } from "effect";
import {
  collectOwnedArtifacts,
  createWorkspace,
  generation,
  makeGeneratorLayer,
  makeProbeState,
  makeResourceLayer,
  makeScopedProbePlugin,
  ProbeLayerBuildError,
  removeWorkspace,
} from "./fixtures.js";

const causeDefects = (cause: Cause.Cause<unknown>): ReadonlyArray<unknown> =>
  cause.reasons.filter(Cause.isDieReason).map(reason => reason.defect);

type AdverseScenario =
  | "layer-build-failure"
  | "initialize-interruption"
  | "downstream-failure"
  | "downstream-defect"
  | "downstream-interruption"
  | "finalizer-defect";

const assertExpectedFailure = (
  scenario: AdverseScenario,
  exit: Exit.Exit<void, unknown>
): void => {
  assert.isTrue(Exit.isFailure(exit));
  if (!Exit.isFailure(exit)) {
    return;
  }

  if (
    scenario === "initialize-interruption" ||
    scenario === "downstream-interruption"
  ) {
    assert.isTrue(Cause.hasInterruptsOnly(exit.cause));
    return;
  }

  if (scenario === "downstream-defect" || scenario === "finalizer-defect") {
    assert.lengthOf(causeDefects(exit.cause), 1);
    return;
  }

  assert.strictEqual(Cause.findErrorOption(exit.cause)._tag, "Some");
};

const runAdverseScenario = (scenario: AdverseScenario) =>
  Effect.acquireUseRelease(
    Effect.sync(createWorkspace),
    workspace =>
      Effect.gen(function* () {
        const state = makeProbeState();
        const entered = yield* Deferred.make<void>();
        const blocked = yield* Deferred.make<void>();
        let armed = true;

        const claim = (target: AdverseScenario): boolean => {
          if (!armed || scenario !== target) {
            return false;
          }
          armed = false;
          return true;
        };

        const resourceLayer = makeResourceLayer({
          state,
          afterAcquire: () =>
            Effect.suspend(() => {
              if (claim("layer-build-failure")) {
                return Effect.fail(
                  new ProbeLayerBuildError({
                    detail: "intentional layer-build failure",
                  })
                );
              }
              if (claim("initialize-interruption")) {
                return Deferred.succeed(entered, undefined).pipe(
                  Effect.andThen(Deferred.await(blocked))
                );
              }
              return Effect.void;
            }),
        });
        const pluginFactory = (): Plugin =>
          makeScopedProbePlugin({
            resourceLayer,
            onGenerate: resource =>
              Effect.sync(() => state.record("generate", resource)).pipe(
                Effect.andThen(
                  Effect.suspend(() => {
                    if (claim("downstream-failure")) {
                      return Effect.fail(
                        new PluginExecutionError({
                          pluginName: "scoped-probe",
                          phase: "generate",
                          cause: new Error("intentional downstream failure"),
                        })
                      );
                    }
                    if (claim("downstream-defect")) {
                      return Effect.die(
                        new Error("intentional downstream defect")
                      );
                    }
                    if (claim("downstream-interruption")) {
                      return Deferred.succeed(entered, undefined).pipe(
                        Effect.andThen(Deferred.await(blocked))
                      );
                    }
                    return Effect.void;
                  })
                )
              ),
            onFinalize: resource =>
              Effect.sync(() => state.record("finalize", resource)).pipe(
                Effect.andThen(
                  Effect.suspend(() =>
                    claim("finalizer-defect")
                      ? Effect.die(new Error("intentional finalizer defect"))
                      : Effect.void
                  )
                )
              ),
          });
        const layer = makeGeneratorLayer(pluginFactory);
        const generate = generation(workspace);

        yield* Effect.gen(function* () {
          const firstFiber = yield* Effect.forkChild(generate);
          const firstExit =
            scenario === "initialize-interruption" ||
            scenario === "downstream-interruption"
              ? yield* Deferred.await(entered).pipe(
                  Effect.andThen(Fiber.interrupt(firstFiber)),
                  Effect.andThen(Fiber.await(firstFiber))
                )
              : yield* Fiber.await(firstFiber);

          assertExpectedFailure(scenario, firstExit);
          assert.deepStrictEqual(state.liveResourceIds(), []);
          assert.deepStrictEqual(collectOwnedArtifacts(workspace), []);

          yield* generate;

          assert.deepStrictEqual(state.eventsByKind("acquire"), [1, 2]);
          assert.deepStrictEqual(state.eventsByKind("release"), [1, 2]);
          assert.deepStrictEqual(state.liveResourceIds(), []);
          assert.deepStrictEqual(collectOwnedArtifacts(workspace), []);
        }).pipe(Effect.provide(layer));
      }),
    workspace => Effect.sync(() => removeWorkspace(workspace))
  );

describe.each<AdverseScenario>([
  "layer-build-failure",
  "initialize-interruption",
  "downstream-failure",
  "downstream-defect",
  "downstream-interruption",
  "finalizer-defect",
])("documented scoped-service ownership: %s", scenario => {
  it.effect(
    "releases the exact acquired resource and permits a fresh generation",
    () => runAdverseScenario(scenario),
    10_000
  );
});
