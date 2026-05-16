import fs from "node:fs";
import path from "node:path";
import { TemplateRenderer } from "@rexeus/typeweaver-gen";
import { Effect } from "effect";
import { generateIndexFiles } from "./internal/indexFileGeneration.js";
import { IndexFileGenerationError } from "./errors/IndexFileGenerationError.js";

export type IndexFileGenerationParams = {
  readonly templateDir: string;
  readonly outputDir: string;
  readonly generatedFiles: readonly string[];
  readonly writeFile: (relativePath: string, content: string) => void;
};

/**
 * Effect-native facade over the pure barrel-computation logic. Owns the
 * EJS template read, delegates rendering to `TemplateRenderer`, and routes
 * every `index.ts` write through the supplied `writeFile` callback — so
 * per-domain and root barrels follow the same atomic-replace + tracking
 * contract as plugin-written files.
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

      const generate = (
        params: IndexFileGenerationParams
      ): Effect.Effect<void, IndexFileGenerationError> =>
        Effect.gen(function* () {
          const templateFilePath = path.join(params.templateDir, "Index.ejs");
          const template = yield* Effect.try({
            try: () => fs.readFileSync(templateFilePath, "utf8"),
            catch: (cause) =>
              new IndexFileGenerationError({
                outputDir: params.outputDir,
                cause,
              }),
          });

          yield* Effect.try({
            try: () =>
              generateIndexFiles({
                generatedFiles: params.generatedFiles,
                writeFile: params.writeFile,
                renderTemplate: (data) =>
                  Effect.runSync(templateRenderer.render(template, data)),
              }),
            catch: (cause) =>
              new IndexFileGenerationError({
                outputDir: params.outputDir,
                cause,
              }),
          });
        });

      return { generate } as const;
    }),
    dependencies: [TemplateRenderer.Default],
    accessors: true,
  }
) {}
