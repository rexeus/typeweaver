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
          Effect.scoped(
            Effect.gen(function* () {
              yield* fileSystem
                .makeDirectory(config.specOutputDir, { recursive: true })
                .pipe(
                  Effect.mapError(
                    cause =>
                      new SpecBundleError({
                        inputFile: config.inputFile,
                        cause,
                      })
                  )
                );

              const tempDir = yield* fileSystem
                .makeTempDirectoryScoped({
                  directory: config.specOutputDir,
                  prefix: ".typeweaver-spec-loader-",
                })
                .pipe(
                  Effect.mapError(
                    cause =>
                      new SpecBundleError({
                        inputFile: config.inputFile,
                        cause,
                      })
                  )
                );

              const wrapperFile = path.join(tempDir, "spec-entrypoint.ts");
              const stagedSpecFile = path.join(tempDir, "spec.js");
              const bundledSpecFile = path.join(
                config.specOutputDir,
                "spec.js"
              );
              const wrapperImportSpecifier = createWrapperImportSpecifier(
                wrapperFile,
                config.inputFile
              );

              yield* fileSystem
                .writeFileString(
                  wrapperFile,
                  buildWrapperSource(wrapperImportSpecifier)
                )
                .pipe(
                  Effect.mapError(
                    cause =>
                      new SpecBundleError({
                        inputFile: config.inputFile,
                        cause,
                      })
                  )
                );

              yield* Effect.uninterruptible(
                Effect.tryPromise({
                  try: () =>
                    (deps.build ?? build)({
                      cwd: tempDir,
                      input: wrapperFile,
                      treeshake: true,
                      experimental: {
                        attachDebugInfo: "none",
                      },
                      external: (source: string) => {
                        if (source.startsWith("node:")) {
                          return true;
                        }
                        return (
                          !source.startsWith(".") && !path.isAbsolute(source)
                        );
                      },
                      output: {
                        file: stagedSpecFile,
                        format: "esm",
                      },
                    }),
                  catch: cause =>
                    new SpecBundleError({
                      inputFile: config.inputFile,
                      cause,
                    }),
                })
              );

              const bundleExists =
                deps.existsSync !== undefined
                  ? deps.existsSync(stagedSpecFile)
                  : yield* fileSystem.exists(stagedSpecFile).pipe(
                      Effect.mapError(
                        cause =>
                          new SpecBundleError({
                            inputFile: config.inputFile,
                            cause,
                          })
                      )
                    );

              if (!bundleExists) {
                return yield* new SpecBundleOutputMissingError({
                  inputFile: config.inputFile,
                  bundledSpecFile,
                  specOutputDir: config.specOutputDir,
                });
              }

              // Node's rename callback cannot be cancelled. Keep this atomic
              // publication step uninterruptible so Scope/lock release cannot
              // race a rename that is still mutating the final output path.
              yield* Effect.uninterruptible(
                fileSystem.rename(stagedSpecFile, bundledSpecFile).pipe(
                  Effect.mapError(
                    cause =>
                      new SpecBundleError({
                        inputFile: config.inputFile,
                        cause,
                      })
                  )
                )
              );

              return bundledSpecFile;
            })
          )
      );

      return { bundle } as const;
    }),
    accessors: true,
  }
) {}
