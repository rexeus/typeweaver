import { PluginExecutionError } from "@rexeus/typeweaver-gen";
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

type TwoPluginScenario = {
  readonly failSecondAcquisition: boolean;
  readonly blockSecondGenerate: Effect.Effect<void>;
};

/**
 * Registers the scoped plugins `scoped-a` and `scoped-b`, which the registry
 * orders alphabetically, sharing one probe state so resource ids record the
 * acquisition order across both plugins.
 */
const makeTwoPluginGeneration = (scenario: TwoPluginScenario) => {
  const state = makeProbeState();
  const firstLayer = makeResourceLayer({
    state,
    afterAcquire: () => Effect.void,
  });
  const secondLayer = makeResourceLayer({
    state,
    afterAcquire: () =>
      scenario.failSecondAcquisition
        ? Effect.fail(
            new ProbeLayerBuildError({ detail: "second plugin refused" })
          )
        : Effect.void,
  });
  const record =
    (kind: "generate" | "finalize") => (resource: { readonly id: number }) =>
      Effect.sync(() => state.record(kind, resource));
  const layer = makeGeneratorLayer(
    () =>
      makeScopedProbePlugin({
        name: "scoped-a",
        resourceLayer: firstLayer,
        onGenerate: record("generate"),
        onFinalize: record("finalize"),
      }),
    () =>
      makeScopedProbePlugin({
        name: "scoped-b",
        resourceLayer: secondLayer,
        onGenerate: resource =>
          record("generate")(resource).pipe(
            Effect.andThen(scenario.blockSecondGenerate)
          ),
        onFinalize: record("finalize"),
      })
  );
  return { state, layer };
};

const withWorkspace = <A, E, R>(
  use: (workspace: string) => Effect.Effect<A, E, R>
) =>
  Effect.acquireUseRelease(Effect.sync(createWorkspace), use, workspace =>
    Effect.sync(() => removeWorkspace(workspace))
  );

const releasesInReverseOrderAfterFinalize = () =>
  withWorkspace(workspace => {
    const { state, layer } = makeTwoPluginGeneration({
      failSecondAcquisition: false,
      blockSecondGenerate: Effect.void,
    });
    return Effect.gen(function* () {
      yield* generation(workspace);

      assert.deepStrictEqual(state.timeline(), [
        "acquire:1",
        "acquire:2",
        "generate:1",
        "generate:2",
        "finalize:2",
        "finalize:1",
        "release:2",
        "release:1",
      ]);
      assert.deepStrictEqual(collectOwnedArtifacts(workspace), []);
    }).pipe(Effect.provide(layer));
  });

const releasesBothWhenGenerateIsInterrupted = () =>
  withWorkspace(workspace =>
    Effect.gen(function* () {
      const entered = yield* Deferred.make<void>();
      const blocked = yield* Deferred.make<void>();
      const { state, layer } = makeTwoPluginGeneration({
        failSecondAcquisition: false,
        blockSecondGenerate: Deferred.succeed(entered, undefined).pipe(
          Effect.andThen(Deferred.await(blocked))
        ),
      });

      yield* Effect.gen(function* () {
        const fiber = yield* Effect.forkChild(generation(workspace));
        yield* Deferred.await(entered);
        yield* Fiber.interrupt(fiber);
        const exit = yield* Fiber.await(fiber);

        assert.isTrue(
          Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)
        );
        assert.deepStrictEqual(state.timeline(), [
          "acquire:1",
          "acquire:2",
          "generate:1",
          "generate:2",
          "finalize:2",
          "finalize:1",
          "release:2",
          "release:1",
        ]);
        assert.deepStrictEqual(state.liveResourceIds(), []);
      }).pipe(Effect.provide(layer));
    })
  );

const releasesPartialAcquisitionOfTheSecondPlugin = () =>
  withWorkspace(workspace => {
    const { state, layer } = makeTwoPluginGeneration({
      failSecondAcquisition: true,
      blockSecondGenerate: Effect.void,
    });
    return Effect.gen(function* () {
      const exit = yield* Effect.exit(generation(workspace));

      assert.isTrue(Exit.isFailure(exit));
      if (Exit.isFailure(exit)) {
        const failure = Cause.findErrorOption(exit.cause);
        assert.isTrue(
          failure._tag === "Some" &&
            failure.value instanceof PluginExecutionError &&
            failure.value.pluginName === "scoped-b" &&
            failure.value.phase === "initialize"
        );
      }
      // A Layer whose construction fails releases what it acquired before the
      // failure escapes the build; the first plugin still finalizes first.
      assert.deepStrictEqual(state.timeline(), [
        "acquire:1",
        "acquire:2",
        "release:2",
        "finalize:1",
        "release:1",
      ]);
      assert.deepStrictEqual(state.liveResourceIds(), []);
    }).pipe(Effect.provide(layer));
  });

describe("two scoped plugins in one generation", () => {
  it.effect(
    "acquires in registration order and releases in reverse order after every finalize",
    releasesInReverseOrderAfterFinalize,
    10_000
  );

  it.effect(
    "finalizes and releases both plugins when generate is interrupted",
    releasesBothWhenGenerateIsInterrupted,
    10_000
  );

  it.effect(
    "releases the partially acquired second plugin and finalizes the first when its acquisition fails",
    releasesPartialAcquisitionOfTheSecondPlugin,
    10_000
  );
});
