import { Context, Effect, FileSystem, Layer } from "effect";
import { build } from "rolldown";
import {
  SpecBundleError,
  SpecBundleOutputMissingError,
} from "./errors/specErrors.js";
import {
  assertBundleOutputExists,
  makeBuildOptions,
  publishBundle,
  runRolldownBuild,
  isExternalModule,
} from "./specBuild.js";
import {
  createWrapperImportSpecifier,
  createWrapperImportSpecifierWith,
  makeBundlePaths,
  prepareBundleDirectory,
  writeBundleWrapper,
} from "./specWrapper.js";
import type {
  BundleOperation,
  FileUrlConverter,
  FileUrlLike,
  SpecBundlerConfig,
  SpecBundlerDeps,
} from "./specBundlerTypes.js";

export type {
  FileUrlConverter,
  FileUrlLike,
  SpecBundlerConfig,
  SpecBundlerDeps,
};
export {
  createWrapperImportSpecifier,
  createWrapperImportSpecifierWith,
  isExternalModule,
};

const bundleSpec = Effect.fn(function* (
  fileSystem: FileSystem.FileSystem,
  config: SpecBundlerConfig,
  deps: SpecBundlerDeps = {}
) {
  return yield* Effect.scoped(
    Effect.gen(function* () {
      const tempDir = yield* prepareBundleDirectory({ config, fileSystem });
      const paths = yield* Effect.try({
        try: () => makeBundlePaths(config, tempDir, deps),
        catch: cause =>
          new SpecBundleError({ inputFile: config.inputFile, cause }),
      });
      const operation: BundleOperation = { config, deps, fileSystem, paths };
      yield* writeBundleWrapper(operation);
      yield* runRolldownBuild({
        build: deps.build ?? build,
        inputFile: config.inputFile,
        options: makeBuildOptions(
          tempDir,
          paths,
          config.pinExternalImports === true
            ? (config.externalImportBase ?? config.inputFile)
            : undefined
        ),
      });
      yield* assertBundleOutputExists(operation);
      yield* publishBundle(operation);
      return paths.bundledSpecFile;
    })
  );
});

export type SpecBundlerShape = {
  readonly bundle: (
    config: SpecBundlerConfig,
    deps?: SpecBundlerDeps
  ) => Effect.Effect<string, SpecBundleError | SpecBundleOutputMissingError>;
};

const makeSpecBundler: Effect.Effect<
  SpecBundlerShape,
  never,
  FileSystem.FileSystem
> = Effect.gen(function* () {
  const fileSystem = yield* FileSystem.FileSystem;
  const bundle: SpecBundlerShape["bundle"] = Effect.fn(
    "typeweaver.SpecBundler.bundle"
  )((config: SpecBundlerConfig, deps: SpecBundlerDeps = {}) =>
    bundleSpec(fileSystem, config, deps)
  );
  return { bundle } as const;
});

/** Effect-native rolldown facade for isolated spec bundling. */
export class SpecBundler extends Context.Service<
  SpecBundler,
  SpecBundlerShape
>()("typeweaver/SpecBundler") {
  static readonly make = (service: SpecBundlerShape) => service;

  static readonly DefaultWithoutDependencies: Layer.Layer<
    SpecBundler,
    never,
    FileSystem.FileSystem
  > = Layer.effect(SpecBundler, makeSpecBundler);

  static readonly Default: Layer.Layer<
    SpecBundler,
    never,
    FileSystem.FileSystem
  > = SpecBundler.DefaultWithoutDependencies;

  static readonly bundle = (
    config: SpecBundlerConfig,
    deps?: SpecBundlerDeps
  ) => SpecBundler.use(service => service.bundle(config, deps));
}
