import path from "node:path";
import type { SpecDefinition } from "@rexeus/typeweaver-core";
import type { NormalizedSpec } from "@rexeus/typeweaver-gen";
import { normalizeSpec } from "@rexeus/typeweaver-gen";
import { FileSystem } from "@effect/platform";
import { Effect } from "effect";
import { SpecOutputWriteError } from "./errors/specErrors.js";
import { SpecBundler } from "./SpecBundler.js";
import { SpecImporter } from "./SpecImporter.js";

export type SpecLoaderConfig = {
  readonly inputFile: string;
  readonly specOutputDir: string;
  readonly externalImportBase?: string;
  readonly isolatedImport?: boolean;
};

export type LoadedSpec = {
  readonly definition: SpecDefinition;
  readonly normalizedSpec: NormalizedSpec;
};

const SPEC_DECLARATION_CONTENT = [
  'import type { SpecDefinition } from "@rexeus/typeweaver-core";',
  "export declare const spec: SpecDefinition;",
  "",
].join("\n");

type SpecLoaderDependencies = {
  readonly bundler: SpecBundler;
  readonly importer: SpecImporter;
  readonly fileSystem: FileSystem.FileSystem;
};

const importIsolatedDefinition = (
  config: SpecLoaderConfig,
  { bundler, importer, fileSystem }: SpecLoaderDependencies
) =>
  Effect.scoped(
    Effect.gen(function* () {
      const importDirectory = yield* fileSystem
        .makeTempDirectoryScoped({
          directory: config.specOutputDir,
          prefix: ".typeweaver-import-",
        })
        .pipe(
          Effect.mapError(
            cause =>
              new SpecOutputWriteError({
                path: config.specOutputDir,
                cause,
              })
          )
        );
      const importBundle = yield* bundler.bundle({
        ...config,
        specOutputDir: importDirectory,
        pinExternalImports: true,
      });
      return yield* importer.importDefinition(importBundle);
    })
  );

const createLoad = ({
  bundler,
  importer,
  fileSystem,
}: SpecLoaderDependencies) =>
  Effect.fn("typeweaver.SpecLoader.load")(function* (config: SpecLoaderConfig) {
    yield* fileSystem
      .makeDirectory(config.specOutputDir, { recursive: true })
      .pipe(
        Effect.mapError(
          cause =>
            new SpecOutputWriteError({
              path: config.specOutputDir,
              cause,
            })
        )
      );

    const bundledSpecFile = yield* bundler.bundle(config);

    const declarationPath = path.join(config.specOutputDir, "spec.d.ts");
    yield* fileSystem
      .writeFileString(declarationPath, SPEC_DECLARATION_CONTENT)
      .pipe(
        Effect.mapError(
          cause => new SpecOutputWriteError({ path: declarationPath, cause })
        )
      );

    const definition =
      config.isolatedImport === true
        ? yield* importIsolatedDefinition(config, {
            bundler,
            importer,
            fileSystem,
          })
        : yield* importer.importDefinition(bundledSpecFile);
    const normalizedSpec = yield* normalizeSpec(definition);

    return { definition, normalizedSpec };
  });

/**
 * End-to-end spec loading: bundle the entrypoint with rolldown, materialize
 * the `spec.d.ts` declaration alongside the bundle, dynamically import the
 * SpecDefinition, and normalize it for downstream plugins.
 *
 * Composes `SpecBundler`, `SpecImporter`, and the gen-side `normalizeSpec`.
 */
export class SpecLoader extends Effect.Service<SpecLoader>()(
  "typeweaver/SpecLoader",
  {
    effect: Effect.gen(function* () {
      const bundler = yield* SpecBundler;
      const importer = yield* SpecImporter;
      const fileSystem = yield* FileSystem.FileSystem;

      const load = createLoad({ bundler, importer, fileSystem });

      return { load } as const;
    }),
    dependencies: [SpecBundler.Default, SpecImporter.Default],
    accessors: true,
  }
) {}
