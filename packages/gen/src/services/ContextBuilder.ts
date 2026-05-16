import { Effect } from "effect";
import {
  createPluginContextBuilder,
  toPathSafetyShape,
  toTemplateRendererShape,
} from "./internal/pluginContextBuilder.js";
import { PathSafety } from "./PathSafety.js";
import { TemplateRenderer } from "./TemplateRenderer.js";
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
 * The injected `FileSystem`, `PathSafety`, and `TemplateRenderer` services
 * route every sync `writeFile` / `addGeneratedFile` / `renderTemplate` call
 * through the same Effect-native plumbing the rest of the pipeline uses.
 */
export class ContextBuilder extends Effect.Service<ContextBuilder>()(
  "typeweaver/ContextBuilder",
  {
    effect: Effect.gen(function* () {
      const pathSafetyService = yield* PathSafety;
      const templateRendererService = yield* TemplateRenderer;

      const pathSafety = toPathSafetyShape(pathSafetyService);
      const templateRenderer = toTemplateRendererShape(
        templateRendererService
      );

      const buildPluginContext = (
        params: PluginContextParams
      ): Effect.Effect<PluginContext> =>
        Effect.sync(() =>
          createPluginContextBuilder({
            pathSafety,
            templateRenderer,
          }).createPluginContext(params)
        );

      const buildGeneratorContext = (
        params: GeneratorContextParams
      ): Effect.Effect<BuiltGeneratorContext> =>
        Effect.sync(() => {
          const builder = createPluginContextBuilder({
            pathSafety,
            templateRenderer,
          });
          const context = builder.createGeneratorContext(params);
          return {
            context,
            getGeneratedFiles: builder.getGeneratedFiles,
          };
        });

      return { buildPluginContext, buildGeneratorContext } as const;
    }),
    dependencies: [PathSafety.Default, TemplateRenderer.Default],
    accessors: true,
  }
) {}
