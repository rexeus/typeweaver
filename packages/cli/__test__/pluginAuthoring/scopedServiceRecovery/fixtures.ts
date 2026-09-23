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
import { Context, Data, Effect, Layer } from "effect";
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

export class ProbeLayerBuildError extends Data.TaggedError(
  "ProbeLayerBuildError"
)<{
  readonly detail: string;
}> {}

const ProbeResource = Context.Service<ResourceProbe>(
  "typeweaver/tests/ProbeResource"
);

const emptyDefinition = defineSpec({
  metadata: { title: "Empty API", version: "1.0.0" },
  resources: {},
});

export const createWorkspace = (): string =>
  fs.mkdtempSync(path.join(os.tmpdir(), "typeweaver-scoped-plugin-"));

export const removeWorkspace = (workspace: string): void => {
  fs.rmSync(workspace, { recursive: true, force: true });
};

export const collectOwnedArtifacts = (workspace: string): readonly string[] => {
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

export const generation = (workspace: string) =>
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

/**
 * Tracks every probe resource acquisition, use, and release so a test can
 * prove each generation released exactly the identities it acquired.
 */
export const makeProbeState = () => {
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

export const makeResourceLayer = (config: {
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

export const makeScopedProbePlugin = (config: {
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

/**
 * Builds a Generator layer that loads only `pluginFactory()` against an empty
 * spec, with formatting and index generation stubbed out.
 */
export const makeGeneratorLayer = (pluginFactory: () => Plugin) => {
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
