import fs from "node:fs";
import path from "node:path";
import { TemplateRenderer } from "@rexeus/typeweaver-gen";
import { Effect } from "effect";
import { IndexFileGenerationError } from "./errors/IndexFileGenerationError.js";
import { planIndexFiles } from "./internal/indexFileGeneration.js";

export type IndexFileGenerationParams = {
  readonly templateDir: string;
  readonly outputDir: string;
  readonly generatedFiles: readonly string[];
  readonly writeFile: (relativePath: string, content: string) => void;
};

/**
 * Effect-native facade over the pure barrel-planning logic. Owns the EJS
 * template read, renders each planned barrel through the Effect-native
 * `TemplateRenderer` (typed `TemplateRenderError` instead of a defect on
 * malformed templates), and routes every `index.ts` write through the
 * supplied `writeFile` callback — so per-domain and root barrels follow
 * the same atomic-replace + tracking contract as plugin-written files.
 *
 * The previous imperative `generateIndexFiles` helper wrote barrels via
 * raw `fs.writeFileSync` and did not register them with the generated-files
 * tracker; this service eliminates that gap.
 */
export class IndexFileGenerator extends Effect.Service<IndexFileGenerator>()(
  "typeweaver/IndexFileGenerator",
  {
    effect: Effect.gen(function* () {
      const templateRenderer = yield* TemplateRenderer;

      const generate: (
        params: IndexFileGenerationParams
      ) => Effect.Effect<void, IndexFileGenerationError> = Effect.fn(
        "typeweaver.IndexFileGenerator.generate"
      )(function* (params: IndexFileGenerationParams) {
        const templateFilePath = path.join(params.templateDir, "Index.ejs");
        const template = yield* Effect.try({
          try: () => fs.readFileSync(templateFilePath, "utf8"),
          catch: cause =>
            new IndexFileGenerationError({
              outputDir: params.outputDir,
              cause,
            }),
        });

        for (const planned of planIndexFiles(params.generatedFiles)) {
          const content = yield* templateRenderer
            .render(template, planned.data)
            .pipe(
              Effect.mapError(
                cause =>
                  new IndexFileGenerationError({
                    outputDir: params.outputDir,
                    cause,
                  })
              )
            );

          yield* Effect.try({
            try: () => params.writeFile(planned.path, content),
            catch: cause =>
              new IndexFileGenerationError({
                outputDir: params.outputDir,
                cause,
              }),
          });
        }
      });

      return { generate } as const;
    }),
    dependencies: [TemplateRenderer.Default],
    accessors: true,
  }
) {}
