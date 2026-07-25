import { FileSystem } from "@effect/platform";
import { Effect } from "effect";
import {
  createPluginContextBuilder,
  livePathSafetyShape,
  liveTemplateRendererShape,
} from "./internal/pluginContextBuilder.js";
import type { NormalizedSpec } from "../NormalizedSpec.js";
import type {
  GeneratorContext,
  PluginContext,
  TypeweaverUserConfig,
} from "../plugins/contextTypes.js";

export type PluginContextParams = {
  readonly outputDir: string;
  readonly inputDir: string;
  readonly config: TypeweaverUserConfig;
};

export type GeneratorContextParams = PluginContextParams & {
  readonly normalizedSpec: NormalizedSpec;
  readonly templateDir: string;
  readonly coreDir: string;
  readonly responsesOutputDir: string;
  readonly specOutputDir: string;
};

/**
 * Result of building a generator context. The accompanying
 * `getGeneratedFiles` snapshot and `drainPendingWriteLogs` queue are bound
 * to the same per-call builder as `context` — concurrent `generate(...)`
 * invocations cannot leak file-tracking state between runs.
 *
 * `drainPendingWriteLogs` returns (and clears) the paths written via
 * `context.writeFile` / `context.writeFileEffect` since the previous
 * drain. The orchestrator flushes it through `Effect.logInfo` after each
 * plugin's `generate` stage so the `Generated: <path>` lines flow through
 * the configured logger pipeline.
 */
export type BuiltGeneratorContext = {
  readonly context: GeneratorContext;
  readonly getGeneratedFiles: () => readonly string[];
  readonly drainPendingWriteLogs: () => readonly string[];
};

/**
 * Effect-native facade over `createPluginContextBuilder`. Each call returns a
 * fresh, isolated builder so overlapping generation runs cannot observe one
 * another's tracker state — eliminating the singleton-builder race that the
 * previous `reset()`-based design exposed.
 *
 * The sync plugin-author callbacks consume the sync cores
 * (`livePathSafetyShape`, `liveTemplateRendererShape`) directly — the same
 * algorithms that back the Effect-native `PathSafety` and `TemplateRenderer`
 * services, without any `Effect.runSync` bridging. The Effect-native context
 * surface (`writeFileEffect`, `renderTemplateEffect`) closes over the
 * platform `FileSystem` service captured here, so plugin lifecycle stages
 * keep `R = never` (ADR 0003) while their I/O routes through the service.
 *
 * The `FileSystem` requirement is the platform-agnostic tag from
 * `@effect/platform` — consumers provide `NodeContext.layer` in production
 * and `InMemoryFileSystem` in tests.
 */
export class ContextBuilder extends Effect.Service<ContextBuilder>()(
  "typeweaver/ContextBuilder",
  {
    effect: Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;

      const buildPluginContext = (
        params: PluginContextParams
      ): Effect.Effect<PluginContext> =>
        // Pure builder/closure allocation over already-captured services; no
        // filesystem operation or user callback runs inside this sync region.
        Effect.sync(() =>
          createPluginContextBuilder({
            pathSafety: livePathSafetyShape,
            templateRenderer: liveTemplateRendererShape,
            fileSystem,
          }).createPluginContext(params)
        );

      const buildGeneratorContext = (
        params: GeneratorContextParams
      ): Effect.Effect<BuiltGeneratorContext> =>
        // Pure per-generation tracker and closure allocation. Expected I/O
        // begins only when the returned context operations are executed.
        Effect.sync(() => {
          const builder = createPluginContextBuilder({
            pathSafety: livePathSafetyShape,
            templateRenderer: liveTemplateRendererShape,
            fileSystem,
          });
          const context = builder.createGeneratorContext(params);
          return {
            context,
            getGeneratedFiles: builder.getGeneratedFiles,
            drainPendingWriteLogs: builder.drainPendingWriteLogs,
          };
        });

      return { buildPluginContext, buildGeneratorContext } as const;
    }),
    accessors: true,
  }
) {}
