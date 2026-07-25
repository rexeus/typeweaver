import fs from "node:fs";
import path from "node:path";
import { pascalCase } from "polycase";
import { relative } from "../../helpers/path.js";
import { MissingCanonicalResponseError } from "../../plugins/errors/MissingCanonicalResponseError.js";
import { makeEffectContextIO } from "./pluginContextEffectIO.js";
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
import type {
  FileSystem,
  PathSafetyShape,
  TemplateRendererShape,
} from "./pluginContextEffectIO.js";

export {
  livePathSafetyShape,
  liveTemplateRendererShape,
} from "./pluginContextEffectIO.js";
export type {
  PathSafetyShape,
  TemplateRendererShape,
} from "./pluginContextEffectIO.js";

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

type PluginContextBuilderDeps = {
  readonly pathSafety: PathSafetyShape;
  readonly templateRenderer: TemplateRendererShape;
  readonly syncAtomicFileSystem?: SyncAtomicFileSystem;
  /**
   * Backs the Effect-native context surface (`writeFileEffect`,
   * `renderTemplateEffect`). Captured at construction time so plugin
   * lifecycle stages keep `R = never` (ADR 0003) while their writes route
   * through the platform `FileSystem` service.
   */
  readonly fileSystem: FileSystem.FileSystem;
};

/**
 * Narrow sync filesystem port for the contractually synchronous plugin writer.
 * It stays internal to `@rexeus/typeweaver-gen`: plugin authors continue to
 * consume only `GeneratorContext.writeFile`.
 */
export type SyncAtomicFileSystem = {
  readonly getExistingFileMode: (absolutePath: string) => number | undefined;
  readonly makeTempDirectory: (prefixPath: string) => string;
  readonly writeFileExclusive: (
    filePath: string,
    content: string,
    mode: number
  ) => void;
  readonly chmod: (filePath: string, mode: number) => void;
  readonly rename: (oldPath: string, newPath: string) => void;
  readonly removeDirectory: (dirPath: string) => void;
};

export const liveSyncAtomicFileSystem: SyncAtomicFileSystem = {
  getExistingFileMode: absolutePath => {
    let pathStats: fs.Stats;
    try {
      pathStats = fs.lstatSync(absolutePath);
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        (error.code === "ENOENT" || error.code === "ENOTDIR")
      ) {
        return undefined;
      }
      throw error;
    }

    if (!pathStats.isFile()) {
      return undefined;
    }

    return pathStats.mode & 0o777;
  },
  makeTempDirectory: prefixPath => fs.mkdtempSync(prefixPath),
  writeFileExclusive: (filePath, content, mode) =>
    fs.writeFileSync(filePath, content, {
      flag: "wx",
      mode,
    }),
  chmod: (filePath, mode) => fs.chmodSync(filePath, mode),
  rename: (oldPath, newPath) => fs.renameSync(oldPath, newPath),
  removeDirectory: dirPath =>
    fs.rmSync(dirPath, { recursive: true, force: true }),
};

const writeFileViaTempReplaceWith = (
  fileSystem: SyncAtomicFileSystem,
  config: {
    readonly safePath: SafeGeneratedFilePath;
    readonly content: string;
    readonly onCommit: () => void;
  }
): void => {
  // Sync twin of `writeFileViaTempReplaceEffect` for the contractually
  // sync plugin-author surface (ADR 0003/0004). Same atomic-replace
  // pattern (mkdtemp + write + chmod preservation + rename).
  // Every plugin write still funnels through
  // `pathSafety.validateGeneratedPath(...)`, so path traversal cannot
  // reach this surface.
  const existingFileMode = fileSystem.getExistingFileMode(
    config.safePath.fullPath
  );
  const destinationDir = path.dirname(config.safePath.fullPath);
  const tempDir = fileSystem.makeTempDirectory(
    path.join(destinationDir, ".typeweaver-")
  );
  const tempFile = path.join(tempDir, "generated.tmp");

  try {
    fileSystem.writeFileExclusive(
      tempFile,
      config.content,
      existingFileMode ?? 0o666
    );

    if (existingFileMode !== undefined) {
      fileSystem.chmod(tempFile, existingFileMode);
    }

    // Both operations are synchronous: once rename publishes the destination,
    // record the write before any fallible cleanup can run. A cleanup-only
    // failure may still be reported, but it cannot leave a committed file
    // absent from the generated-file tracker and pending log queue.
    fileSystem.rename(tempFile, config.safePath.fullPath);
    config.onCommit();
  } catch (operationError) {
    try {
      fileSystem.removeDirectory(tempDir);
    } catch {
      // Preserve the writer's original failure: a cleanup error is secondary
      // and must not erase the rename/write defect callers need to diagnose.
    }
    throw operationError;
  }

  fileSystem.removeDirectory(tempDir);
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
 * The sync atomic-replace operations are captured behind
 * `SyncAtomicFileSystem`; production delegates that narrow port to `node:fs`,
 * while tests can inject deterministic rename/cleanup failures. Directory
 * creation and template reads remain direct `node:fs` calls because the
 * plugin-author API is sync end-to-end (ADR 0003/0004). Every write remains
 * gated by `pathSafety.validateGeneratedPath`.
 */
export function createPluginContextBuilder(
  deps: PluginContextBuilderDeps
): PluginContextBuilderApi {
  const tracker = createGeneratedFilesTracker();
  const {
    pathSafety,
    templateRenderer,
    syncAtomicFileSystem = liveSyncAtomicFileSystem,
    fileSystem,
  } = deps;

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
        writeFileViaTempReplaceWith(syncAtomicFileSystem, {
          safePath,
          content,
          onCommit: () => tracker.recordWrite(safePath.generatedPath),
        });
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

      // The Effect-native slice shares the tracker (and thereby the
      // `Generated:` log queue) with the sync helpers above; the
      // `FileSystem` was captured at construction time so lifecycle
      // stages keep `R = never`.
      ...makeEffectContextIO({
        fileSystem,
        pathSafety,
        templateRenderer,
        outputDir: params.outputDir,
        templateDir: params.templateDir,
        trackWrite: generatedPath => tracker.recordWrite(generatedPath),
        trackGenerated: generatedPath => tracker.add(generatedPath),
      }),
    };
  };

  return {
    createPluginContext,
    createGeneratorContext,
    getGeneratedFiles: () => tracker.snapshot(),
    drainPendingWriteLogs: () => tracker.drainPendingWriteLogs(),
  };
}
