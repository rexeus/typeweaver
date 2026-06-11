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
 * `context.writeFile` since the previous drain. The orchestrator flushes
 * it through `Effect.logInfo` after each plugin's `generate` stage so the
 * `Generated: <path>` lines flow through the configured logger pipeline.
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
 * The builder consumes the sync cores (`livePathSafetyShape`,
 * `liveTemplateRendererShape`) directly — the same algorithms that back the
 * Effect-native `PathSafety` and `TemplateRenderer` services, without any
 * `Effect.runSync` bridging. The plugin-author surface stays sync end-to-end
 * (ADR 0003); Effect-native callers use the service facades instead.
 */
export class ContextBuilder extends Effect.Service<ContextBuilder>()(
  "typeweaver/ContextBuilder",
  {
    succeed: {
      buildPluginContext: (
        params: PluginContextParams
      ): Effect.Effect<PluginContext> =>
        Effect.sync(() =>
          createPluginContextBuilder({
            pathSafety: livePathSafetyShape,
            templateRenderer: liveTemplateRendererShape,
          }).createPluginContext(params)
        ),

      buildGeneratorContext: (
        params: GeneratorContextParams
      ): Effect.Effect<BuiltGeneratorContext> =>
        Effect.sync(() => {
          const builder = createPluginContextBuilder({
            pathSafety: livePathSafetyShape,
            templateRenderer: liveTemplateRendererShape,
          });
          const context = builder.createGeneratorContext(params);
          return {
            context,
            getGeneratedFiles: builder.getGeneratedFiles,
            drainPendingWriteLogs: builder.drainPendingWriteLogs,
          };
        }),
    },
    accessors: true,
  }
) {}
