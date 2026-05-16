import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Effect } from "effect";
import { build } from "rolldown";
import {
  SpecBundleError,
  SpecBundleOutputMissingError,
} from "../generators/spec/errors/index.js";

const WINDOWS_ABSOLUTE_PATH_PATTERN = /^[A-Za-z]:[\\/]/;
const WINDOWS_UNC_PATH_PATTERN = /^\\\\/;

export type SpecBundlerConfig = {
  readonly inputFile: string;
  readonly specOutputDir: string;
};

export type SpecBundlerDeps = {
  readonly build?: typeof build;
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

const bundleAsync = async (
  config: SpecBundlerConfig,
  deps: SpecBundlerDeps = {}
): Promise<string> => {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "typeweaver-spec-loader-")
  );
  const wrapperFile = path.join(tempDir, "spec-entrypoint.ts");
  const bundledSpecFile = path.join(config.specOutputDir, "spec.js");
  const wrapperImportSpecifier = createWrapperImportSpecifier(
    wrapperFile,
    config.inputFile
  );

  fs.writeFileSync(
    wrapperFile,
    [
      `import * as specModule from ${JSON.stringify(wrapperImportSpecifier)};`,
      "const resolvedSpec =",
      '  Reflect.get(specModule, "spec") ??',
      '  Reflect.get(specModule, "default") ??',
      "  specModule;",
      "",
      "export const spec = resolvedSpec;",
      "",
    ].join("\n")
  );

  try {
    await (deps.build ?? build)({
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
        return !source.startsWith(".") && !path.isAbsolute(source);
      },
      output: {
        file: bundledSpecFile,
        format: "esm",
      },
    });
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  if (!(deps.existsSync ?? fs.existsSync)(bundledSpecFile)) {
    throw new SpecBundleOutputMissingError({
      inputFile: config.inputFile,
      bundledSpecFile,
      specOutputDir: config.specOutputDir,
    });
  }

  return bundledSpecFile;
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
    (filePath) =>
      WINDOWS_ABSOLUTE_PATH_PATTERN.test(filePath) ||
      WINDOWS_UNC_PATH_PATTERN.test(filePath)
  );

const resolveRealFilePath = (filePath: string): string => {
  if (!fs.existsSync(filePath)) {
    return filePath;
  }
  return fs.realpathSync.native(filePath);
};

/**
 * Bundles a SpecDefinition entrypoint into a single ESM file via rolldown.
 *
 * The wrapper file allows authors to expose the spec as a default export,
 * a named `spec` export, or the module namespace itself. Filesystem errors
 * from rolldown surface as `SpecBundleError`; a missing post-bundle output
 * surfaces as `SpecBundleOutputMissingError`.
 */
export class SpecBundler extends Effect.Service<SpecBundler>()(
  "typeweaver/SpecBundler",
  {
    succeed: {
      bundle: (
        config: SpecBundlerConfig,
        deps: SpecBundlerDeps = {}
      ): Effect.Effect<
        string,
        SpecBundleError | SpecBundleOutputMissingError
      > =>
        Effect.tryPromise({
          try: () => bundleAsync(config, deps),
          catch: (error) => {
            if (error instanceof SpecBundleOutputMissingError) {
              return error;
            }
            return new SpecBundleError({
              inputFile: config.inputFile,
              cause: error,
            });
          },
        }),
    },
    accessors: true,
  }
) {}
