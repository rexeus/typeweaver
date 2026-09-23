import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { defineSpec } from "@rexeus/typeweaver-core";
import {
  ContextBuilder,
  PluginExecutionError,
  PluginRegistry,
  defineScopedPlugin,
} from "@rexeus/typeweaver-gen";
import type { Plugin } from "@rexeus/typeweaver-gen";
import { layer as nodeFileSystemLayer } from "@effect/platform-node-shared/NodeFileSystem";
import { assert, it } from "@effect/vitest";
import { Context, Data, Deferred, Effect, Exit, Fiber, Layer } from "effect";
import {
  Formatter,
  Generator,
  IndexFileGenerator,
  PluginLoader,
  SpecLoader,
} from "../../../src/services/index.js";
import { emptyNormalizedSpec } from "../../helpers/generatorFixtures.js";

type ResourceEvent = {
  readonly kind: "acquire" | "generate" | "finalize" | "release";
  readonly resourceId: number;
};

type ResourceProbe = {
  readonly id: number;
};

class ProbeLayerBuildError extends Data.TaggedError("ProbeLayerBuildError")<{
  readonly detail: string;
}> {}

const ProbeResource = Context.Service<ResourceProbe>(
  "typeweaver/tests/ProbeResource"
);

const emptyDefinition = defineSpec({
  metadata: { title: "Empty API", version: "1.0.0" },
  resources: {},
});

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
  ) => Effect.Effect<void, ProbeLayerBuildError>;
}) =>
  Layer.effect(
    ProbeResource,
    Effect.acquireRelease(Effect.sync(config.state.acquire), resource =>
      Effect.sync(() => config.state.release(resource))
    ).pipe(Effect.tap(resource => config.afterAcquire(resource)))
  );

const makeScopedProbePlugin = (config: {
  readonly resourceLayer: Layer.Layer<ResourceProbe, ProbeLayerBuildError>;
  readonly onGenerate: (
    resource: ResourceProbe
  ) => Effect.Effect<void, PluginExecutionError>;
  readonly onFinalize: (
    resource: ResourceProbe
  ) => Effect.Effect<void, PluginExecutionError>;
}): Plugin => {
  return defineScopedPlugin({
    name: "scoped-probe",
    layer: config.resourceLayer,
    generate: () => Effect.flatMap(ProbeResource, config.onGenerate),
    finalize: () => Effect.flatMap(ProbeResource, config.onFinalize),
  });
};

const makeGeneratorLayer = (pluginFactory: () => Plugin) => {
  const pluginLoaderLayer = Layer.succeed(PluginLoader, {
    loadAll: params => params.registry.register(pluginFactory()),
  });
  const specLoaderLayer = Layer.succeed(SpecLoader, {
    load: () =>
      Effect.succeed({
        definition: emptyDefinition,
        normalizedSpec: emptyNormalizedSpec(),
      }),
  });
  const formatterLayer = Layer.succeed(Formatter, {
    format: () => Effect.void,
  });
  const indexFileGeneratorLayer = Layer.succeed(IndexFileGenerator, {
    generate: () => Effect.void,
  });
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
    Layer.provideMerge(dependencies, nodeFileSystemLayer)
  );
};

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
