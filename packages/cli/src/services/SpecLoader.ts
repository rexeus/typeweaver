import path from "node:path";
import type { SpecDefinition } from "@rexeus/typeweaver-core";
import type {
  NormalizationError,
  NormalizedSpec,
} from "@rexeus/typeweaver-gen";
import { normalizeSpec } from "@rexeus/typeweaver-gen";
import { Context, Effect, FileSystem, Layer } from "effect";
import {
  InvalidSpecEntrypointError,
  SpecBundleError,
  SpecBundleOutputMissingError,
  SpecOutputWriteError,
} from "./errors/specErrors.js";
import { SpecBundler } from "./SpecBundler.js";
import { SpecImporter } from "./SpecImporter.js";
import type { SpecBundlerShape } from "./SpecBundler.js";
import type { SpecImporterShape } from "./SpecImporter.js";

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

export type SpecLoaderShape = {
  readonly load: (
    config: SpecLoaderConfig
  ) => Effect.Effect<
    LoadedSpec,
    | SpecBundleError
    | SpecBundleOutputMissingError
    | SpecOutputWriteError
    | InvalidSpecEntrypointError
    | NormalizationError
  >;
};

const SPEC_DECLARATION_CONTENT = [
  'import type { SpecDefinition } from "@rexeus/typeweaver-core";',
  "export declare const spec: SpecDefinition;",
  "",
].join("\n");

type SpecLoaderDependencies = {
  readonly bundler: SpecBundlerShape;
  readonly importer: SpecImporterShape;
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
const makeSpecLoader: Effect.Effect<
  SpecLoaderShape,
  never,
  SpecBundler | SpecImporter | FileSystem.FileSystem
> = Effect.gen(function* () {
  const bundler = yield* SpecBundler;
  const importer = yield* SpecImporter;
  const fileSystem = yield* FileSystem.FileSystem;

  const load = createLoad({ bundler, importer, fileSystem });

  return { load } as const;
});

export class SpecLoader extends Context.Service<SpecLoader, SpecLoaderShape>()(
  "typeweaver/SpecLoader"
) {
  static readonly make = (service: SpecLoaderShape) => service;

  static readonly DefaultWithoutDependencies: Layer.Layer<
    SpecLoader,
    never,
    SpecBundler | SpecImporter | FileSystem.FileSystem
  > = Layer.effect(SpecLoader, makeSpecLoader);

  static readonly Default: Layer.Layer<
    SpecLoader,
    never,
    FileSystem.FileSystem
  > = SpecLoader.DefaultWithoutDependencies.pipe(
    Layer.provide(SpecBundler.Default),
    Layer.provide(SpecImporter.Default)
  );

  static readonly load = (config: SpecLoaderConfig) =>
    SpecLoader.use(service => service.load(config));
}
