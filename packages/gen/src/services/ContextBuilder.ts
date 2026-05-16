import { Effect } from "effect";
import { createPluginContextBuilder } from "./internal/pluginContextBuilder.js";
import type {
  GeneratorContext,
  PluginConfig,
  PluginContext,
} from "../plugins/contextTypes.js";
import type { NormalizedSpec } from "../NormalizedSpec.js";

export type PluginContextParams = {
  readonly outputDir: string;
  readonly inputDir: string;
  readonly config: PluginConfig;
};

export type GeneratorContextParams = PluginContextParams & {
  readonly normalizedSpec: NormalizedSpec;
  readonly templateDir: string;
  readonly coreDir: string;
  readonly responsesOutputDir: string;
  readonly specOutputDir: string;
};

/**
 * Result of building a generator context. The accompanying `getGeneratedFiles`
 * snapshot is bound to the same per-call builder as `context` — concurrent
 * `generate(...)` invocations cannot leak file-tracking state between runs.
 */
export type BuiltGeneratorContext = {
  readonly context: GeneratorContext;
  readonly getGeneratedFiles: () => readonly string[];
};

/**
 * Effect-native facade over `createPluginContextBuilder`. Each call returns a
 * fresh, isolated builder so overlapping generation runs cannot observe one
 * another's tracker state — eliminating the singleton-builder race that the
 * previous `reset()`-based design exposed.
 *
 * Sync helpers exposed via the context records (writeFile, addGeneratedFile,
 * etc.) are preserved for plugin-author compatibility; their `Effect.try`
 * boundary inside `Plugin.generate` continues to catch any throws.
 */
export class ContextBuilder extends Effect.Service<ContextBuilder>()(
  "typeweaver/ContextBuilder",
  {
    succeed: {
      buildPluginContext: (
        params: PluginContextParams
      ): Effect.Effect<PluginContext> =>
        Effect.sync(() =>
          createPluginContextBuilder().createPluginContext(params)
        ),

      buildGeneratorContext: (
        params: GeneratorContextParams
      ): Effect.Effect<BuiltGeneratorContext> =>
        Effect.sync(() => {
          const builder = createPluginContextBuilder();
          const context = builder.createGeneratorContext(params);
          return {
            context,
            getGeneratedFiles: builder.getGeneratedFiles,
          };
        }),
    },
    accessors: true,
  }
) {}
