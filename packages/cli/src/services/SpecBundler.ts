import fs from "node:fs";
import path from "node:path";
import { FileSystem } from "@effect/platform";
import { Effect } from "effect";
import { build } from "rolldown";
import {
  SpecBundleError,
  SpecBundleOutputMissingError,
} from "./errors/specErrors.js";
import type { BuildOptions } from "rolldown";

const WINDOWS_ABSOLUTE_PATH_PATTERN = /^[A-Za-z]:[\\/]/;
const WINDOWS_UNC_PATH_PATTERN = /^\\\\/;

export type SpecBundlerConfig = {
  readonly inputFile: string;
  readonly specOutputDir: string;
};

export type SpecBundlerDeps = {
  readonly build?: (options: BuildOptions) => Promise<unknown>;
  readonly existsSync?: (filePath: string) => boolean;
};

export const createWrapperImportSpecifier = (
  wrapperFile: string,
  inputFile: string
): string => {
  const absoluteInputFile = resolveBundledInputFile(inputFile);
  const useWindowsPathSemantics = usesWindowsPathSemantics(
    wrapperFile,
    absoluteInputFile
  );
  const pathModule = useWindowsPathSemantics ? path.win32 : path.posix;
  const wrapperDir = useWindowsPathSemantics
    ? pathModule.dirname(wrapperFile)
    : resolveRealFilePath(pathModule.dirname(wrapperFile));
  const resolvedInputFile = useWindowsPathSemantics
    ? absoluteInputFile
    : resolveRealFilePath(absoluteInputFile);
  const relativeInputFile = pathModule
    .relative(wrapperDir, resolvedInputFile)
    .replaceAll(pathModule.sep, "/");

  if (relativeInputFile.startsWith(".") || relativeInputFile.startsWith("..")) {
    return relativeInputFile;
  }

  return `./${relativeInputFile}`;
};

const resolveBundledInputFile = (inputFile: string): string => {
  if (path.isAbsolute(inputFile)) {
    return inputFile;
  }
  if (WINDOWS_ABSOLUTE_PATH_PATTERN.test(inputFile)) {
    return path.win32.normalize(inputFile);
  }
  if (WINDOWS_UNC_PATH_PATTERN.test(inputFile)) {
    return path.win32.normalize(inputFile);
  }
  return path.resolve(inputFile);
};

const usesWindowsPathSemantics = (...filePaths: string[]): boolean =>
  filePaths.some(
    filePath =>
      WINDOWS_ABSOLUTE_PATH_PATTERN.test(filePath) ||
      WINDOWS_UNC_PATH_PATTERN.test(filePath)
  );

/**
 * Resolves the real path of a file synchronously. Used inside
 * `createWrapperImportSpecifier` which is shared with sync path utilities
 * — the FileSystem service is async-Effect and cannot satisfy that call
 * site without restructuring the entire bundler. The sync `fs.realpathSync`
 * is acceptable here because it runs at bundle time on user-supplied input
 * paths only.
 */
const resolveRealFilePath = (filePath: string): string => {
  if (!fs.existsSync(filePath)) {
    return filePath;
  }
  return fs.realpathSync.native(filePath);
};

const buildWrapperSource = (wrapperImportSpecifier: string): string =>
  [
    `import * as specModule from ${JSON.stringify(wrapperImportSpecifier)};`,
    "const resolvedSpec =",
    '  Reflect.get(specModule, "spec") ??',
    '  Reflect.get(specModule, "default") ??',
    "  specModule;",
    "",
    "export const spec = resolvedSpec;",
    "",
  ].join("\n");

type BundlePaths = {
  readonly bundledSpecFile: string;
  readonly stagedSpecFile: string;
  readonly wrapperFile: string;
  readonly wrapperImportSpecifier: string;
};

type BundleOperation = {
  readonly config: SpecBundlerConfig;
  readonly deps: SpecBundlerDeps;
  readonly fileSystem: FileSystem.FileSystem;
  readonly paths: BundlePaths;
};

const makeBundleError =
  (inputFile: string) =>
  (cause: unknown): SpecBundleError =>
    new SpecBundleError({ inputFile, cause });

const makeBundlePaths = (
  config: SpecBundlerConfig,
  tempDir: string
): BundlePaths => {
  const wrapperFile = path.join(tempDir, "spec-entrypoint.ts");
  return {
    wrapperFile,
    stagedSpecFile: path.join(tempDir, "spec.js"),
    bundledSpecFile: path.join(config.specOutputDir, "spec.js"),
    wrapperImportSpecifier: createWrapperImportSpecifier(
      wrapperFile,
      config.inputFile
    ),
  };
};

const prepareBundleDirectory = Effect.fn(function* (params: {
  readonly config: SpecBundlerConfig;
  readonly fileSystem: FileSystem.FileSystem;
}) {
  const mapError = makeBundleError(params.config.inputFile);
  yield* params.fileSystem
    .makeDirectory(params.config.specOutputDir, { recursive: true })
    .pipe(Effect.mapError(mapError));
  return yield* params.fileSystem
    .makeTempDirectoryScoped({
      directory: params.config.specOutputDir,
      prefix: ".typeweaver-spec-loader-",
    })
    .pipe(Effect.mapError(mapError));
});

const writeBundleWrapper = Effect.fn(function* (operation: BundleOperation) {
  yield* operation.fileSystem
    .writeFileString(
      operation.paths.wrapperFile,
      buildWrapperSource(operation.paths.wrapperImportSpecifier)
    )
    .pipe(Effect.mapError(makeBundleError(operation.config.inputFile)));
});

const isExternalModule = (source: string): boolean => {
  if (source.startsWith("node:")) {
    return true;
  }
  return !source.startsWith(".") && !path.isAbsolute(source);
};

const makeBuildOptions = (
  tempDir: string,
  paths: BundlePaths
): BuildOptions => ({
  cwd: tempDir,
  input: paths.wrapperFile,
  treeshake: true,
  experimental: {
    attachDebugInfo: "none",
  },
  external: isExternalModule,
  output: {
    file: paths.stagedSpecFile,
    format: "esm",
  },
});

const runRolldownBuild = Effect.fn(function* (params: {
  readonly build: (options: BuildOptions) => Promise<unknown>;
  readonly inputFile: string;
  readonly options: BuildOptions;
}) {
  yield* Effect.uninterruptible(
    Effect.tryPromise({
      try: () => params.build(params.options),
      catch: makeBundleError(params.inputFile),
    })
  );
});

const bundleOutputExists = Effect.fn(function* (operation: BundleOperation) {
  const existsSync = operation.deps.existsSync;
  if (existsSync !== undefined) {
    return yield* Effect.sync(() => existsSync(operation.paths.stagedSpecFile));
  }
  return yield* operation.fileSystem
    .exists(operation.paths.stagedSpecFile)
    .pipe(Effect.mapError(makeBundleError(operation.config.inputFile)));
});

const assertBundleOutputExists = Effect.fn(function* (
  operation: BundleOperation
) {
  if (yield* bundleOutputExists(operation)) {
    return;
  }
  return yield* new SpecBundleOutputMissingError({
    inputFile: operation.config.inputFile,
    bundledSpecFile: operation.paths.bundledSpecFile,
    specOutputDir: operation.config.specOutputDir,
  });
});

const publishBundle = Effect.fn(function* (operation: BundleOperation) {
  yield* Effect.uninterruptible(
    operation.fileSystem
      .rename(operation.paths.stagedSpecFile, operation.paths.bundledSpecFile)
      .pipe(Effect.mapError(makeBundleError(operation.config.inputFile)))
  );
});

const bundleSpec = Effect.fn(function* (
  fileSystem: FileSystem.FileSystem,
  config: SpecBundlerConfig,
  deps: SpecBundlerDeps = {}
) {
  return yield* Effect.scoped(
    Effect.gen(function* () {
      const tempDir = yield* prepareBundleDirectory({ config, fileSystem });
      const paths = makeBundlePaths(config, tempDir);
      const operation = { config, deps, fileSystem, paths };

      yield* writeBundleWrapper(operation);
      yield* runRolldownBuild({
        build: deps.build ?? build,
        inputFile: config.inputFile,
        options: makeBuildOptions(tempDir, paths),
      });
      yield* assertBundleOutputExists(operation);
      yield* publishBundle(operation);

      return paths.bundledSpecFile;
    })
  );
});

/**
 * Bundles a SpecDefinition entrypoint into a single ESM file via rolldown.
 *
 * The wrapper file allows authors to expose the spec as a default export,
 * a named `spec` export, or the module namespace itself. Filesystem errors
 * from rolldown surface as `SpecBundleError`; a missing post-bundle output
 * surfaces as `SpecBundleOutputMissingError`.
 *
 * Rolldown writes into a scoped staging directory beside the final bundle.
 * Its Promise is awaited uninterruptibly because Rolldown does not expose a
 * cancellation signal: releasing the Scope earlier would allow a detached
 * build to keep writing after the caller's output lock has been released.
 * Only a settled, successful build is atomically renamed into place through
 * the Effect `FileSystem`; the scoped wrapper/staging directory is removed on
 * every Exit.
 *
 * The optional `deps` parameter is a deliberate test seam for the two
 * bindings that live outside the `FileSystem` service: rolldown's `build`
 * and the post-bundle existence probe. Wrapping rolldown in a dedicated
 * service tag would add a one-method service with a single production
 * implementation; the parameter keeps the seam local to the only call
 * site that needs substitution.
 */
export class SpecBundler extends Effect.Service<SpecBundler>()(
  "typeweaver/SpecBundler",
  {
    effect: Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;

      const bundle: (
        config: SpecBundlerConfig,
        deps?: SpecBundlerDeps
      ) => Effect.Effect<
        string,
        SpecBundleError | SpecBundleOutputMissingError
      > = Effect.fn("typeweaver.SpecBundler.bundle")(
        (config: SpecBundlerConfig, deps: SpecBundlerDeps = {}) =>
          bundleSpec(fileSystem, config, deps)
      );

      return { bundle } as const;
    }),
    accessors: true,
  }
) {}
