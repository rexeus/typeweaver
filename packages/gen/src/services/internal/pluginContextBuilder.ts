import fs from "node:fs";
import path from "node:path";
import { pascalCase } from "polycase";
import { relative } from "../../helpers/path.js";
import { resolveSafeGeneratedFilePath } from "../../helpers/pathSafety.js";
import { renderTemplate } from "../../helpers/templateEngine.js";
import { MissingCanonicalResponseError } from "../../plugins/errors/MissingCanonicalResponseError.js";
import type { SafeGeneratedFilePath } from "../../helpers/pathSafety.js";
import type {
  NormalizedResponse,
  NormalizedSpec,
} from "../../NormalizedSpec.js";
import type {
  GeneratorContext,
  PluginContext,
  TypeweaverUserConfig,
} from "../../plugins/contextTypes.js";

/**
 * Per-call tracker over the set of generated file paths. Each
 * `createGeneratorContext` invocation gets its own tracker so concurrent
 * generation runs cannot observe one another's state.
 *
 * `drainPendingWriteLogs` returns (and clears) the paths written via
 * `writeFile` since the previous drain. The Effect-native orchestrator
 * flushes this queue through `Effect.logInfo` after each plugin's
 * `generate` stage — the sync write callback itself runs outside any
 * Effect runtime, so it cannot log through the configured logger directly.
 */
type GeneratedFilesTracker = {
  readonly add: (filePath: string) => void;
  readonly recordWrite: (filePath: string) => void;
  readonly snapshot: () => readonly string[];
  readonly drainPendingWriteLogs: () => readonly string[];
};

const createGeneratedFilesTracker = (): GeneratedFilesTracker => {
  const generatedFiles = new Set<string>();
  let pendingWriteLogs: string[] = [];
  return {
    add: filePath => generatedFiles.add(filePath),
    recordWrite: filePath => {
      generatedFiles.add(filePath);
      pendingWriteLogs.push(filePath);
    },
    snapshot: () => Array.from(generatedFiles).sort(),
    drainPendingWriteLogs: () => {
      const drained = pendingWriteLogs;
      pendingWriteLogs = [];
      return drained;
    },
  };
};

/**
 * Narrowed PathSafety surface: a sync function that validates a requested
 * generated path against path-traversal/symlink-escape attacks and returns
 * the resolved absolute + project-relative pair. Production wiring uses
 * `livePathSafetyShape`; tests can substitute a pure stand-in.
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

/**
 * Production `PathSafetyShape`: the sync path-traversal guard, shared with
 * the Effect-native `PathSafety` service. Throws `UnsafeGeneratedPathError`,
 * which the surrounding `Effect.try` in `Plugin.generate` observes directly.
 */
export const livePathSafetyShape: PathSafetyShape = {
  validateGeneratedPath: params =>
    resolveSafeGeneratedFilePath(params.outputDir, params.requestedPath),
};

/**
 * Production `TemplateRendererShape`: the sync EJS-like renderer, shared
 * with the Effect-native `TemplateRenderer` service.
 */
export const liveTemplateRendererShape: TemplateRendererShape = {
  render: (template, data) =>
    // Plugin authors pass arbitrary template data; the engine scopes its
    // `with(data)` lookup over a plain record. Non-record values have never
    // been supported — the widening cast preserves the existing contract.
    renderTemplate(template, (data ?? {}) as Record<string, unknown>),
};

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
    config: TypeweaverUserConfig;
  }) => PluginContext;
  readonly createGeneratorContext: (params: {
    readonly outputDir: string;
    readonly inputDir: string;
    readonly config: TypeweaverUserConfig;
    readonly normalizedSpec: NormalizedSpec;
    readonly templateDir: string;
    readonly coreDir: string;
    readonly responsesOutputDir: string;
    readonly specOutputDir: string;
  }) => GeneratorContext;
  readonly getGeneratedFiles: () => readonly string[];
  readonly drainPendingWriteLogs: () => readonly string[];
};

/**
 * Factory for sync-surface plugin contexts.
 *
 * The `pathSafety` and `templateRenderer` deps are injected so the
 * security-critical path guard and the rendering engine can both be
 * substituted in tests. Production wiring passes `livePathSafetyShape` /
 * `liveTemplateRendererShape` — the same sync cores that back the
 * Effect-native `PathSafety` and `TemplateRenderer` services, with no
 * `Effect.runSync` bridging in between.
 *
 * Filesystem I/O for the atomic-replace write, directory creation, and
 * template-file reads remains on `node:fs` because the plugin-author API
 * contract is sync end-to-end (ADR 0003/0004). The tradeoff: the I/O here
 * is contained to a well-audited file (this module), every write is gated
 * by `pathSafety.validateGeneratedPath`, and tests can substitute the
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
    config: TypeweaverUserConfig;
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
    readonly config: TypeweaverUserConfig;
    readonly normalizedSpec: NormalizedSpec;
    readonly templateDir: string;
    readonly coreDir: string;
    readonly responsesOutputDir: string;
    readonly specOutputDir: string;
  }): GeneratorContext => {
    const pluginContext = createPluginContext(params);
    const canonicalResponsesByName = new Map<string, NormalizedResponse>(
      params.normalizedSpec.responses.map(response => [response.name, response])
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
      getCanonicalResponseImportPath: config => {
        return relative(
          config.importerDir,
          getCanonicalResponseOutputFile(config.responseName).replace(
            /\.ts$/,
            ".js"
          )
        );
      },
      getSpecImportPath: config => {
        return relative(
          config.importerDir,
          path.join(params.specOutputDir, "spec.js")
        );
      },
      getOperationDefinitionAccessor: config => {
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
        // Queue the `Generated: <path>` log instead of printing here: the
        // sync callback runs outside any Effect runtime, so the orchestrator
        // drains the queue through `Effect.logInfo` after each plugin's
        // `generate` stage — keeping the lines inside the configured logger
        // pipeline (verbose flavor, captured-log tests, future telemetry).
        tracker.recordWrite(safePath.generatedPath);
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
    drainPendingWriteLogs: () => tracker.drainPendingWriteLogs(),
  };
}
