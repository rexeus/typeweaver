import path from "node:path";
import { pathToFileURL } from "node:url";
import { Effect } from "effect";
import { SpecBundleOutputMissingError } from "./errors/specErrors.js";
import { makeBundleError } from "./specBundlerTypes.js";
import type { BundleOperation } from "./specBundlerTypes.js";
import type { BuildOptions, Plugin } from "rolldown";

export const isExternalModule = (source: string): boolean => {
  if (source.startsWith("node:")) return true;
  if (source.startsWith("file:")) return false;
  return !source.startsWith(".") && !path.isAbsolute(source);
};

const hasUnpinnedDynamicImport = (value: unknown): boolean => {
  if (Array.isArray(value)) return value.some(hasUnpinnedDynamicImport);
  if (typeof value !== "object" || value === null) return false;
  if (Reflect.get(value, "type") === "ImportExpression") {
    const source: unknown = Reflect.get(value, "source");
    const literalValue: unknown =
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
    if (!isExternalModule(source)) return null;
    if (source.startsWith("node:")) return { id: source, external: true };
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
        "Isolated spec evaluation cannot safely resolve a dynamic import unless it is a literal node: or file: specifier"
      );
    }
    return null;
  },
});

export const makeBuildOptions = (
  tempDir: string,
  paths: BundleOperation["paths"],
  externalImportBase: string | undefined
): BuildOptions => {
  const pinExternalImports = externalImportBase !== undefined;
  const options: BuildOptions = {
    cwd: tempDir,
    input: paths.wrapperFile,
    treeshake: true,
    ...(pinExternalImports ? { platform: "node" as const } : {}),
    experimental: { attachDebugInfo: "none" },
    external: pinExternalImports
      ? source => source.startsWith("node:")
      : isExternalModule,
    output: { file: paths.stagedSpecFile, format: "esm" },
  };
  return pinExternalImports
    ? { ...options, plugins: [pinExternalImportsPlugin(externalImportBase)] }
    : options;
};

export const runRolldownBuild = Effect.fn(function* (params: {
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

export const assertBundleOutputExists = Effect.fn(function* (
  operation: BundleOperation
) {
  if (yield* bundleOutputExists(operation)) return;
  return yield* new SpecBundleOutputMissingError({
    inputFile: operation.config.inputFile,
    bundledSpecFile: operation.paths.bundledSpecFile,
    specOutputDir: operation.config.specOutputDir,
  });
});

export const publishBundle = Effect.fn(function* (operation: BundleOperation) {
  yield* Effect.uninterruptible(
    operation.fileSystem
      .rename(operation.paths.stagedSpecFile, operation.paths.bundledSpecFile)
      .pipe(Effect.mapError(makeBundleError(operation.config.inputFile)))
  );
});
