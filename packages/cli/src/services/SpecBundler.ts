import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  coordinationArtifactMarkerSource,
  SPEC_BUNDLER_TEMP_DIRECTORY_PREFIX,
  TYPEWEAVER_COORDINATION_MARKER_FILE,
} from "@rexeus/typeweaver-gen";
import { FileSystem } from "@effect/platform";
import { Effect } from "effect";
import { build } from "rolldown";
import {
  SpecBundleError,
  SpecBundleOutputMissingError,
} from "./errors/specErrors.js";
import type { BuildOptions, Plugin } from "rolldown";

const WINDOWS_ABSOLUTE_PATH_PATTERN = /^[A-Za-z]:[\\/]/;
const WINDOWS_UNC_PATH_PATTERN = /^\\\\/;

export type SpecBundlerConfig = {
  readonly inputFile: string;
  readonly specOutputDir: string;
  readonly externalImportBase?: string;
  readonly pinExternalImports?: boolean;
};

/** Minimal URL shape so Windows-path tests can inject a converter. */
export type FileUrlLike = {
  readonly href: string;
};

export type FileUrlConverter = (filePath: string) => FileUrlLike;

export type SpecBundlerDeps = {
  readonly build?: (options: BuildOptions) => Promise<unknown>;
  readonly existsSync?: (filePath: string) => boolean;
  readonly realpathSync?: (filePath: string) => string;
  readonly toFileUrl?: FileUrlConverter;
};

export const createWrapperImportSpecifier = (
  wrapperFile: string,
  inputFile: string
): string =>
  createWrapperImportSpecifierWith(
    wrapperFile,
    inputFile,
    fs.realpathSync.native,
    pathToFileURL
  );

/**
 * Computes the specifier used by the generated wrapper to import the user's
 * spec entrypoint.
 *
 * Same-drive/root targets stay relative so normal generation is unchanged.
 * When `path.relative` cannot express a relative path (different Windows
 * drives or UNC roots), a bare absolute filesystem path is invalid to Node
 * ESM, so the target is emitted as a `file://` URL instead.
 */
export const createWrapperImportSpecifierWith = (
  wrapperFile: string,
  inputFile: string,
  realpathSync: (filePath: string) => string,
  toFileUrl: FileUrlConverter = pathToFileURL
): string => {
  const absoluteInputFile = resolveBundledInputFile(inputFile);
  const useWindowsPathSemantics = usesWindowsPathSemantics(
    wrapperFile,
    absoluteInputFile
  );
  const pathModule = useWindowsPathSemantics ? path.win32 : path.posix;
  const wrapperDir = useWindowsPathSemantics
    ? pathModule.dirname(wrapperFile)
    : resolveRealFilePath(pathModule.dirname(wrapperFile), realpathSync);
  const resolvedInputFile = useWindowsPathSemantics
    ? absoluteInputFile
    : resolveRealFilePath(absoluteInputFile, realpathSync);
  const relativeInputFile = pathModule.relative(wrapperDir, resolvedInputFile);

  if (pathModule.isAbsolute(relativeInputFile)) {
    // Cross-drive/cross-root: Node ESM requires a valid file URL, not a bare
    // absolute filesystem path.
    return toFileUrl(resolvedInputFile).href;
  }

  const posixRelative = relativeInputFile.replaceAll(pathModule.sep, "/");
  if (posixRelative.startsWith(".") || posixRelative.startsWith("..")) {
    return posixRelative;
  }

  return `./${posixRelative}`;
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
const resolveRealFilePath = (
  filePath: string,
  realpathSync: (filePath: string) => string
): string => {
  if (!fs.existsSync(filePath)) {
    return filePath;
  }
  return realpathSync(filePath);
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
  tempDir: string,
  deps: SpecBundlerDeps
): BundlePaths => {
  const wrapperFile = path.join(tempDir, "spec-entrypoint.ts");
  return {
    wrapperFile,
    stagedSpecFile: path.join(tempDir, "spec.js"),
    bundledSpecFile: path.join(config.specOutputDir, "spec.js"),
    wrapperImportSpecifier: createWrapperImportSpecifierWith(
      wrapperFile,
      config.inputFile,
      deps.realpathSync ?? fs.realpathSync.native,
      deps.toFileUrl
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
  const tempDir = yield* params.fileSystem
    .makeTempDirectoryScoped({
      directory: params.config.specOutputDir,
      prefix: SPEC_BUNDLER_TEMP_DIRECTORY_PREFIX,
    })
    .pipe(Effect.mapError(mapError));
  yield* params.fileSystem
    .writeFileString(
      path.join(tempDir, TYPEWEAVER_COORDINATION_MARKER_FILE),
      coordinationArtifactMarkerSource("spec-bundler-temp"),
      {
        flag: "wx",
        mode: 0o600,
      }
    )
    .pipe(Effect.mapError(mapError));
  return tempDir;
});

const writeBundleWrapper = Effect.fn(function* (operation: BundleOperation) {
  yield* operation.fileSystem
    .writeFileString(
      operation.paths.wrapperFile,
      buildWrapperSource(operation.paths.wrapperImportSpecifier)
    )
    .pipe(Effect.mapError(makeBundleError(operation.config.inputFile)));
});

/**
 * Classifies a module specifier as external to the bundle. Bundled imports are
 * relative (`./`, `../`), absolute host paths, and `file:` URLs (cross-drive
 * entrypoints). `node:` builtins and bare package specifiers stay external.
 */
export const isExternalModule = (source: string): boolean => {
  if (source.startsWith("node:")) {
    return true;
  }
  // A cross-drive/cross-root entrypoint is emitted as a file URL; it must be
  // bundled, not left external, or Node would import the unbundled source.
  if (source.startsWith("file:")) {
    return false;
  }
  return !source.startsWith(".") && !path.isAbsolute(source);
};

const hasUnpinnedDynamicImport = (value: unknown): boolean => {
  if (Array.isArray(value)) {
    return value.some(hasUnpinnedDynamicImport);
  }
  if (typeof value !== "object" || value === null) {
    return false;
  }
  if (Reflect.get(value, "type") === "ImportExpression") {
    const source = Reflect.get(value, "source");
    const literalValue =
      typeof source === "object" &&
      source !== null &&
      Reflect.get(source, "type") === "Literal"
        ? Reflect.get(source, "value")
        : undefined;
    return !(
      typeof literalValue === "string" &&
      (literalValue.startsWith("file:") || literalValue.startsWith("node:"))
    );
  }
  return Object.values(value).some(hasUnpinnedDynamicImport);
};

const pinExternalImportsPlugin = (externalImportBase: string): Plugin => ({
  name: "typeweaver-pin-external-imports",
  async resolveId(source) {
    if (!isExternalModule(source)) {
      return null;
    }
    if (source.startsWith("node:")) {
      return { id: source, external: true };
    }
    const resolved = await this.resolve(source, externalImportBase, {
      skipSelf: true,
    });
    if (resolved === null) {
      throw new Error(
        `Unable to resolve external module '${source}' from '${externalImportBase}'`
      );
    }
    if (resolved.id.startsWith("node:") || resolved.id.startsWith("file:")) {
      return { id: resolved.id, external: true };
    }
    if (path.isAbsolute(resolved.id)) {
      return { id: pathToFileURL(resolved.id).href, external: true };
    }
    if (resolved.external) {
      throw new Error(
        `External module '${source}' resolved to non-absolute id '${resolved.id}'`
      );
    }

    return { ...resolved, external: false };
  },
  renderChunk(code) {
    if (hasUnpinnedDynamicImport(this.parse(code))) {
      throw new Error(
        "Isolated spec evaluation cannot safely resolve a non-literal dynamic import"
      );
    }
    return null;
  },
});

const makeBuildOptions = (
  tempDir: string,
  paths: BundlePaths,
  externalImportBase: string | undefined
): BuildOptions => {
  const pinExternalImports = externalImportBase !== undefined;
  const options: BuildOptions = {
    cwd: tempDir,
    input: paths.wrapperFile,
    treeshake: true,
    ...(pinExternalImports ? { platform: "node" as const } : {}),
    experimental: {
      attachDebugInfo: "none",
    },
    external: pinExternalImports
      ? source => source.startsWith("node:")
      : isExternalModule,
    output: {
      file: paths.stagedSpecFile,
      format: "esm",
    },
  };
  return pinExternalImports
    ? { ...options, plugins: [pinExternalImportsPlugin(externalImportBase)] }
    : options;
};

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
      const paths = yield* Effect.try({
        try: () => makeBundlePaths(config, tempDir, deps),
        catch: makeBundleError(config.inputFile),
      });
      const operation = { config, deps, fileSystem, paths };

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

/**
 * Bundles a SpecDefinition entrypoint into a single ESM file via rolldown.
 *
 * The wrapper file allows authors to expose the spec as a default export,
 * a named `spec` export, or the module namespace itself. Filesystem errors
 * while resolving the wrapper paths and from rolldown surface as
 * `SpecBundleError`; a missing post-bundle output surfaces as
 * `SpecBundleOutputMissingError`.
 *
 * Rolldown writes into a scoped staging directory beside the final bundle.
 * Its Promise is awaited uninterruptibly because Rolldown does not expose a
 * cancellation signal: releasing the Scope earlier would allow a detached
 * build to keep writing after the caller's output lock has been released.
 * Only a settled, successful build is atomically renamed into place through
 * the Effect `FileSystem`; the scoped wrapper/staging directory is removed on
 * every Exit.
 *
 * The optional `deps` parameter is a deliberate test seam for the three
 * bindings that live outside the `FileSystem` service: rolldown's `build`,
 * wrapper-path realpath resolution, and the post-bundle existence probe.
 * Wrapping these in dedicated service tags would add one-method services
 * with single production implementations; the parameter keeps the seams
 * local to the only call site that needs substitution.
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
