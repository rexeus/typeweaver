import { Effect } from "effect";
import { createPluginContextBuilder } from "./internal/pluginContextBuilder.js";
import type { PluginContextBuilderApi } from "./internal/pluginContextBuilder.js";
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
 * Effect-native facade over `createPluginContextBuilder`. Owns a single
 * builder instance per scope so the generated-files tracker is shared
 * across every plugin within one generation run.
 *
 * Sync helpers exposed via the context records (writeFile, addGeneratedFile,
 * etc.) are preserved as-is for V1 compatibility — Task #6 does not change
 * their behavior.
 */
export class ContextBuilder extends Effect.Service<ContextBuilder>()(
  "typeweaver/ContextBuilder",
  {
    effect: Effect.sync(() => {
      let builder: PluginContextBuilderApi = createPluginContextBuilder();

      const reset: Effect.Effect<void> = Effect.sync(() => {
        builder = createPluginContextBuilder();
      });

      const buildPluginContext = (
        params: PluginContextParams
      ): Effect.Effect<PluginContext> =>
        Effect.sync(() => builder.createPluginContext(params));

      const buildGeneratorContext = (
        params: GeneratorContextParams
      ): Effect.Effect<GeneratorContext> =>
        Effect.sync(() => builder.createGeneratorContext(params));

      const getGeneratedFiles: Effect.Effect<readonly string[]> = Effect.sync(
        () => builder.getGeneratedFiles()
      );

      return {
        reset,
        buildPluginContext,
        buildGeneratorContext,
        getGeneratedFiles,
      } as const;
    }),
    accessors: true,
  }
) {}
