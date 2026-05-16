import fs from "node:fs";
import path from "node:path";
import { Effect, Either } from "effect";
import { pascalCase } from "polycase";
import { relative } from "../../helpers/path.js";
import type { SafeGeneratedFilePath } from "../../helpers/pathSafety.js";
import { MissingCanonicalResponseError } from "../../plugins/errors/MissingCanonicalResponseError.js";
import type {
  GeneratorContext,
  PluginConfig,
  PluginContext,
} from "../../plugins/contextTypes.js";
import type {
  NormalizedResponse,
  NormalizedSpec,
} from "../../NormalizedSpec.js";
import type { UnsafeGeneratedPathError } from "../../errors/UnsafeGeneratedPathError.js";

/**
 * Per-call tracker over the set of generated file paths. Each
 * `createGeneratorContext` invocation gets its own tracker so concurrent
 * generation runs cannot observe one another's state.
 */
type GeneratedFilesTracker = {
  readonly add: (filePath: string) => void;
  readonly snapshot: () => readonly string[];
};

const createGeneratedFilesTracker = (): GeneratedFilesTracker => {
  const generatedFiles = new Set<string>();
  return {
    add: (filePath) => generatedFiles.add(filePath),
    snapshot: () => Array.from(generatedFiles).sort(),
  };
};

/**
 * Narrowed PathSafety surface: a sync function that validates a requested
 * generated path against path-traversal/symlink-escape attacks and returns
 * the resolved absolute + project-relative pair. The wrapping caller
 * supplies an implementation that runs the `PathSafety` Effect via
 * `Effect.runSync`; tests can substitute a pure stand-in.
 */
export type PathSafetyShape = {
  readonly validateGeneratedPath: (params: {
    readonly outputDir: string;
    readonly requestedPath: string;
  }) => SafeGeneratedFilePath;
};

/**
 * Narrowed TemplateRenderer surface. Mirrors `PathSafetyShape`.
 */
export type TemplateRendererShape = {
  readonly render: (template: string, data: unknown) => string;
};

type PathSafetyService = {
  readonly validateGeneratedPath: (params: {
    readonly outputDir: string;
    readonly requestedPath: string;
  }) => Effect.Effect<SafeGeneratedFilePath, UnsafeGeneratedPathError>;
};

type TemplateRendererService = {
  readonly render: (
    template: string,
    data: unknown
  ) => Effect.Effect<string>;
};

/**
 * Adapt the `PathSafety` service to the sync shape consumed by the plugin
 * context callbacks. Tagged failures unwrap to the bare error so the
 * surrounding `Effect.try` in `Plugin.generate` observes
 * `UnsafeGeneratedPathError` directly — not a `FiberFailure` wrapper.
 */
export const toPathSafetyShape = (
  pathSafety: PathSafetyService
): PathSafetyShape => ({
  validateGeneratedPath: (params) => {
    const result = Effect.runSync(
      Effect.either(pathSafety.validateGeneratedPath(params))
    );
    if (Either.isLeft(result)) throw result.left;
    return result.right;
  },
});

/**
 * Adapt the `TemplateRenderer` service to the sync shape consumed by the
 * plugin context callbacks.
 */
export const toTemplateRendererShape = (
  templateRenderer: TemplateRendererService
): TemplateRendererShape => ({
  render: (template, data) =>
    Effect.runSync(templateRenderer.render(template, data)),
});

type PluginContextBuilderDeps = {
  readonly pathSafety: PathSafetyShape;
  readonly templateRenderer: TemplateRendererShape;
};

const writeFileViaTempReplace = (config: {
  readonly safePath: SafeGeneratedFilePath;
  readonly content: string;
}): void => {
  // The atomic-replace pattern (mkdtemp + writeFile + rename) plus chmod
  // preservation is not yet expressible through @effect/platform's
  // FileSystem (no `rename`, no `chmod`). We keep the well-audited
  // `node:fs` implementation here. Every plugin write still funnels
  // through `pathSafety.validateGeneratedPath(...)` above, so path
  // traversal cannot reach this surface.
  const existingFileMode = getExistingFileMode(config.safePath.fullPath);
  const destinationDir = path.dirname(config.safePath.fullPath);
  const tempDir = fs.mkdtempSync(path.join(destinationDir, ".typeweaver-"));
  const tempFile = path.join(tempDir, "generated.tmp");

  try {
    fs.writeFileSync(tempFile, config.content, {
      flag: "wx",
      mode: existingFileMode ?? 0o666,
    });

    if (existingFileMode !== undefined) {
      fs.chmodSync(tempFile, existingFileMode);
    }

    fs.renameSync(tempFile, config.safePath.fullPath);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
};

const getExistingFileMode = (absolutePath: string): number | undefined => {
  let pathStats: fs.Stats;
  try {
    pathStats = fs.lstatSync(absolutePath);
  } catch (error) {
    if (
      error instanceof Error &&
      ["ENOENT", "ENOTDIR"].includes(
        (error as Error & { code?: string }).code ?? ""
      )
    ) {
      return undefined;
    }
    throw error;
  }

  if (!pathStats.isFile()) {
    return undefined;
  }

  return pathStats.mode & 0o777;
};

export type PluginContextBuilderApi = {
  readonly createPluginContext: (params: {
    outputDir: string;
    inputDir: string;
    config: PluginConfig;
  }) => PluginContext;
  readonly createGeneratorContext: (params: {
    readonly outputDir: string;
    readonly inputDir: string;
    readonly config: PluginConfig;
    readonly normalizedSpec: NormalizedSpec;
    readonly templateDir: string;
    readonly coreDir: string;
    readonly responsesOutputDir: string;
    readonly specOutputDir: string;
  }) => GeneratorContext;
  readonly getGeneratedFiles: () => readonly string[];
};

/**
 * Factory for sync-surface plugin contexts.
 *
 * The `pathSafety` and `templateRenderer` deps are injected so the
 * security-critical path guard and the rendering engine can both be
 * substituted in tests, and the Effect-native versions of those services
 * (which back the production callers) reuse the exact same algorithms.
 *
 * Filesystem I/O for the atomic-replace write, directory creation, and
 * template-file reads remains on `node:fs` because the plugin-author API
 * contract is sync end-to-end. `@effect/platform`'s `FileSystem` is async
 * by every method, so `Effect.runSync` over it raises an
 * `AsyncFiberException`. The tradeoff: the I/O here is contained to a
 * well-audited file (this module), every write is gated by
 * `pathSafety.validateGeneratedPath`, and tests can substitute the
 * `pathSafety` and `templateRenderer` shapes to exercise the
 * orchestration logic without writing real files.
 */
export function createPluginContextBuilder(
  deps: PluginContextBuilderDeps
): PluginContextBuilderApi {
  const tracker = createGeneratedFilesTracker();
  const { pathSafety, templateRenderer } = deps;

  const createPluginContext = (params: {
    outputDir: string;
    inputDir: string;
    config: PluginConfig;
  }): PluginContext => {
    return {
      outputDir: params.outputDir,
      inputDir: params.inputDir,
      config: params.config,
    };
  };

  const createGeneratorContext = (params: {
    readonly outputDir: string;
    readonly inputDir: string;
    readonly config: PluginConfig;
    readonly normalizedSpec: NormalizedSpec;
    readonly templateDir: string;
    readonly coreDir: string;
    readonly responsesOutputDir: string;
    readonly specOutputDir: string;
  }): GeneratorContext => {
    const pluginContext = createPluginContext(params);
    const canonicalResponsesByName = new Map<string, NormalizedResponse>(
      params.normalizedSpec.responses.map((response) => [
        response.name,
        response,
      ])
    );

    const getResourceOutputDir = (resourceName: string): string => {
      return path.join(params.outputDir, resourceName);
    };

    const getOperationOutputPaths = (config: {
      readonly resourceName: string;
      readonly operationId: string;
    }) => {
      const outputDir = getResourceOutputDir(config.resourceName);
      const fileBase = pascalCase(config.operationId);
      const requestFileName = `${fileBase}Request.ts`;
      const responseFileName = `${fileBase}Response.ts`;
      const requestValidationFileName = `${fileBase}RequestValidator.ts`;
      const responseValidationFileName = `${fileBase}ResponseValidator.ts`;
      const clientFileName = `${fileBase}Client.ts`;

      return {
        outputDir,
        requestFile: path.join(outputDir, requestFileName),
        requestFileName,
        responseFile: path.join(outputDir, responseFileName),
        responseFileName,
        requestValidationFile: path.join(outputDir, requestValidationFileName),
        requestValidationFileName,
        responseValidationFile: path.join(
          outputDir,
          responseValidationFileName
        ),
        responseValidationFileName,
        clientFile: path.join(outputDir, clientFileName),
        clientFileName,
      };
    };

    const getCanonicalResponse = (responseName: string): NormalizedResponse => {
      const response = canonicalResponsesByName.get(responseName);

      if (response === undefined) {
        throw new MissingCanonicalResponseError({ responseName });
      }

      return response;
    };

    const getCanonicalResponseOutputFile = (responseName: string): string => {
      return path.join(
        params.responsesOutputDir,
        `${pascalCase(responseName)}Response.ts`
      );
    };

    return {
      ...pluginContext,
      normalizedSpec: params.normalizedSpec,
      coreDir: params.coreDir,
      responsesOutputDir: params.responsesOutputDir,
      specOutputDir: params.specOutputDir,
      getCanonicalResponse,
      getCanonicalResponseOutputFile,
      getCanonicalResponseImportPath: (config) => {
        return relative(
          config.importerDir,
          getCanonicalResponseOutputFile(config.responseName).replace(
            /\.ts$/,
            ".js"
          )
        );
      },
      getSpecImportPath: (config) => {
        return relative(
          config.importerDir,
          path.join(params.specOutputDir, "spec.js")
        );
      },
      getOperationDefinitionAccessor: (config) => {
        return (
          `getOperationDefinition(` +
          `spec, ` +
          `${JSON.stringify(config.resourceName)}, ` +
          `${JSON.stringify(config.operationId)}` +
          `)`
        );
      },
      getOperationOutputPaths,
      getResourceOutputDir,

      writeFile: (relativePath: string, content: string) => {
        const safePath = pathSafety.validateGeneratedPath({
          outputDir: params.outputDir,
          requestedPath: relativePath,
        });

        fs.mkdirSync(path.dirname(safePath.fullPath), { recursive: true });
        writeFileViaTempReplace({ safePath, content });
        tracker.add(safePath.generatedPath);

        // The sync `writeFile` callback runs inside `Effect.runSync` deep
        // in plugin code; `Effect.logInfo` from inside `runSync` does not
        // route through the production logger because no layer is in
        // scope. `console.info` is the byte-stable choice for this
        // sync-only surface, and it matches what the rest of the CLI
        // logger emits at INFO.
        console.info(`Generated: ${safePath.generatedPath}`);
      },

      renderTemplate: (templatePath: string, data: unknown) => {
        const fullTemplatePath = path.isAbsolute(templatePath)
          ? templatePath
          : path.join(params.templateDir, templatePath);

        const template = fs.readFileSync(fullTemplatePath, "utf8");
        return templateRenderer.render(template, data);
      },

      addGeneratedFile: (relativePath: string) => {
        const safePath = pathSafety.validateGeneratedPath({
          outputDir: params.outputDir,
          requestedPath: relativePath,
        });

        tracker.add(safePath.generatedPath);
      },

      getGeneratedFiles: () => {
        return [...tracker.snapshot()];
      },
    };
  };

  return {
    createPluginContext,
    createGeneratorContext,
    getGeneratedFiles: () => tracker.snapshot(),
  };
}
