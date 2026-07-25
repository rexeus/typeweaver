import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { defineSpec } from "@rexeus/typeweaver-core";
import {
  ContextBuilder,
  PluginExecutionError,
  PluginRegistry,
  definePlugin,
} from "@rexeus/typeweaver-gen";
import type { Plugin } from "@rexeus/typeweaver-gen";
import { NodeContext } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import {
  Cause,
  Context,
  Deferred,
  Effect,
  Exit,
  Fiber,
  Layer,
  Scope,
} from "effect";
import {
  Formatter,
  Generator,
  IndexFileGenerator,
  PluginLoader,
  SpecLoader,
} from "../src/services/index.js";
import { emptyNormalizedSpec } from "./helpers/generatorFixtures.js";

type AdverseScenario =
  | "layer-build-failure"
  | "initialize-interruption"
  | "downstream-failure"
  | "downstream-defect"
  | "downstream-interruption"
  | "finalizer-defect";

type ResourceEvent = {
  readonly kind: "acquire" | "generate" | "finalize" | "release";
  readonly resourceId: number;
};

type ResourceProbe = {
  readonly id: number;
};

type ProbeRuntime = {
  readonly scope: Scope.CloseableScope;
  readonly services: Context.Context<ResourceProbe>;
};

const ProbeResource = Context.GenericTag<ResourceProbe>(
  "typeweaver/tests/ProbeResource"
);

const emptyDefinition = defineSpec({ resources: {} });

const createWorkspace = (): string =>
  fs.mkdtempSync(path.join(os.tmpdir(), "typeweaver-scoped-plugin-"));

const removeWorkspace = (workspace: string): void => {
  fs.rmSync(workspace, { recursive: true, force: true });
};

const collectOwnedArtifacts = (workspace: string): readonly string[] => {
  const outputDir = path.join(workspace, "generated", "output");
  if (!fs.existsSync(outputDir)) {
    return [];
  }

  const artifacts: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.name.startsWith(".typeweaver-")) {
        artifacts.push(path.relative(outputDir, entryPath));
      }
      if (entry.isDirectory()) {
        visit(entryPath);
      }
    }
  };

  visit(outputDir);
  return artifacts.sort();
};

const generation = (workspace: string) =>
  Generator.generate({
    inputFile: "spec/index.ts",
    outputDir: "generated/output",
    config: {
      input: "spec/index.ts",
      output: "generated/output",
      format: false,
    },
    currentWorkingDirectory: workspace,
  });

const makeProbeState = () => {
  let nextResourceId = 0;
  const liveResourceIds = new Set<number>();
  const events: ResourceEvent[] = [];

  return {
    acquire: (): ResourceProbe => {
      const resource = { id: ++nextResourceId };
      liveResourceIds.add(resource.id);
      events.push({ kind: "acquire", resourceId: resource.id });
      return resource;
    },
    record: (
      kind: Exclude<ResourceEvent["kind"], "acquire" | "release">,
      resource: ResourceProbe
    ): void => {
      events.push({ kind, resourceId: resource.id });
    },
    release: (resource: ResourceProbe): void => {
      liveResourceIds.delete(resource.id);
      events.push({ kind: "release", resourceId: resource.id });
    },
    eventsByKind: (kind: ResourceEvent["kind"]): readonly number[] =>
      events
        .filter(event => event.kind === kind)
        .map(event => event.resourceId),
    liveResourceIds: (): readonly number[] =>
      Array.from(liveResourceIds).sort((left, right) => left - right),
  };
};

type ProbeState = ReturnType<typeof makeProbeState>;

const makeResourceLayer = (config: {
  readonly state: ProbeState;
  readonly afterAcquire: (
    resource: ResourceProbe
  ) => Effect.Effect<void, Error>;
}) =>
  Layer.scoped(
    ProbeResource,
    Effect.acquireRelease(Effect.sync(config.state.acquire), resource =>
      Effect.sync(() => config.state.release(resource))
    ).pipe(Effect.tap(resource => config.afterAcquire(resource)))
  );

const makeScopedProbePlugin = (config: {
  readonly resourceLayer: Layer.Layer<ResourceProbe, Error>;
  readonly onGenerate: (
    resource: ResourceProbe
  ) => Effect.Effect<void, PluginExecutionError>;
  readonly onFinalize: (
    resource: ResourceProbe
  ) => Effect.Effect<void, PluginExecutionError>;
}): Plugin => {
  let runtime: ProbeRuntime | undefined;

  const withResource = <A, E>(
    use: (resource: ResourceProbe) => Effect.Effect<A, E>
  ): Effect.Effect<A, E> =>
    Effect.suspend(() => {
      const current = runtime;
      if (current === undefined) {
        return Effect.dieMessage(
          "scoped probe plugin used before successful initialization"
        );
      }
      return Effect.flatMap(ProbeResource, use).pipe(
        Effect.provide(current.services)
      );
    });

  return definePlugin({
    name: "scoped-probe",

    initialize: () =>
      Effect.acquireUseRelease(
        Scope.make(),
        scope =>
          Layer.buildWithScope(config.resourceLayer, scope).pipe(
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
        Effect.mapError(
          cause =>
            new PluginExecutionError({
              pluginName: "scoped-probe",
              phase: "initialize",
              cause,
            })
        )
      ),

    generate: () => withResource(config.onGenerate),

    finalize: () =>
      Effect.suspend(() => {
        const current = runtime;
        runtime = undefined;
        if (current === undefined) {
          return Effect.void;
        }

        return Effect.flatMap(ProbeResource, config.onFinalize).pipe(
          Effect.provide(current.services),
          Effect.ensuring(Scope.close(current.scope, Exit.void))
        );
      }),
  });
};

const makeGeneratorLayer = (pluginFactory: () => Plugin) => {
  const pluginLoaderLayer = Layer.succeed(
    PluginLoader,
    PluginLoader.make({
      loadAll: params => params.registry.register(pluginFactory()),
    })
  );
  const specLoaderLayer = Layer.succeed(
    SpecLoader,
    SpecLoader.make({
      load: () =>
        Effect.succeed({
          definition: emptyDefinition,
          normalizedSpec: emptyNormalizedSpec(),
        }),
    })
  );
  const formatterLayer = Layer.succeed(
    Formatter,
    Formatter.make({ format: () => Effect.void })
  );
  const indexFileGeneratorLayer = Layer.succeed(
    IndexFileGenerator,
    IndexFileGenerator.make({ generate: () => Effect.void })
  );
  const dependencies = Layer.mergeAll(
    ContextBuilder.Default,
    formatterLayer,
    indexFileGeneratorLayer,
    pluginLoaderLayer,
    PluginRegistry.Default,
    specLoaderLayer
  );

  return Layer.provideMerge(
    Generator.DefaultWithoutDependencies,
    Layer.provideMerge(dependencies, NodeContext.layer)
  );
};

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
    assert.isTrue(Cause.isInterruptedOnly(exit.cause));
    return;
  }

  if (scenario === "downstream-defect" || scenario === "finalizer-defect") {
    assert.lengthOf(Cause.defects(exit.cause), 1);
    return;
  }

  assert.strictEqual(Cause.failureOption(exit.cause)._tag, "Some");
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
                  new Error("intentional layer-build failure")
                );
              }
              if (claim("initialize-interruption")) {
                return Deferred.succeed(entered, undefined).pipe(
                  Effect.zipRight(Deferred.await(blocked))
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
                Effect.zipRight(
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
                        Effect.zipRight(Deferred.await(blocked))
                      );
                    }
                    return Effect.void;
                  })
                )
              ),
            onFinalize: resource =>
              Effect.sync(() => state.record("finalize", resource)).pipe(
                Effect.zipRight(
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
          const firstFiber = yield* Effect.fork(generate);
          const firstExit =
            scenario === "initialize-interruption" ||
            scenario === "downstream-interruption"
              ? yield* Deferred.await(entered).pipe(
                  Effect.zipRight(Fiber.interrupt(firstFiber))
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
                  Effect.zipRight(Deferred.await(releaseGeneration))
                ),
              onFinalize: resource =>
                Effect.sync(() => state.record("finalize", resource)),
            });
          const layer = makeGeneratorLayer(pluginFactory);

          yield* Effect.gen(function* () {
            const first = yield* Effect.fork(generation(workspaces[0]));
            const second = yield* Effect.fork(generation(workspaces[1]));

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
